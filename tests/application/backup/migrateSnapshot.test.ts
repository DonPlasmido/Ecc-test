import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT_VERSION } from '@/application/backup/BackupSnapshot';
import { migrateSnapshot } from '@/application/backup/migrateSnapshot';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import type { YearMonth } from '@/domain/date/YearMonth';
import { ACCOUNT, money, rule, tx } from '../../domain/builders';
import { createWorld } from '../harness';

async function validRaw(): Promise<Record<string, unknown>> {
  const w = createWorld();
  w.state.transactions.set('tx-1', tx());
  w.state.rules.set('rule-1', rule());
  const budget: Budget = {
    id: 'b-1' as BudgetId,
    categoryId: rule().categoryId,
    monthlyLimit: money(10_000),
    startMonth: '2026-01' as YearMonth,
    endMonth: null,
  };
  w.state.budgets.set(budget.id, budget);
  return JSON.parse(JSON.stringify(await w.snapshot.exportAll())) as Record<string, unknown>;
}

function codeOf(result: ReturnType<typeof migrateSnapshot>): string | undefined {
  return result.ok ? undefined : result.error.code;
}

describe('migrateSnapshot', () => {
  it('accepts a valid current-version snapshot unchanged', async () => {
    const raw = await validRaw();

    const result = migrateSnapshot(raw);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.transactions).toHaveLength(1);
      expect(result.value.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    }
  });

  it.each([null, undefined, 42, 'text', [], true])('rejects non-object input %j', (input) => {
    expect(codeOf(migrateSnapshot(input))).toBe('backup.invalidSnapshot');
  });

  it('rejects a format version newer than supported', async () => {
    const raw = { ...(await validRaw()), formatVersion: BACKUP_FORMAT_VERSION + 1 };

    expect(codeOf(migrateSnapshot(raw))).toBe('backup.unsupportedVersion');
  });

  it.each([0, -1, 1.5, '1', null])('rejects a malformed format version %j', async (version) => {
    const raw = { ...(await validRaw()), formatVersion: version };

    expect(codeOf(migrateSnapshot(raw))).toBe('backup.invalidSnapshot');
  });

  it.each(['accounts', 'categories', 'rules', 'budgets', 'importBatches', 'importProfiles', 'transactions'])(
    'rejects a snapshot whose %s is not an array',
    async (key) => {
      const raw = { ...(await validRaw()), [key]: {} };

      expect(codeOf(migrateSnapshot(raw))).toBe('backup.invalidSnapshot');
    },
  );

  it('rejects a transaction with fractional cents', async () => {
    const raw = await validRaw();
    const bad = { ...tx(), amount: { cents: 1.5 } };

    expect(codeOf(migrateSnapshot({ ...raw, transactions: [bad] }))).toBe('backup.invalidSnapshot');
  });

  it('rejects a transaction with an impossible date', async () => {
    const raw = await validRaw();

    expect(codeOf(migrateSnapshot({ ...raw, transactions: [{ ...tx(), date: '2026-02-31' }] }))).toBe('backup.invalidSnapshot');
  });

  it('rejects a transaction with an unknown category source', async () => {
    const raw = await validRaw();

    expect(codeOf(migrateSnapshot({ ...raw, transactions: [{ ...tx(), categorySource: 'magic' }] }))).toBe('backup.invalidSnapshot');
  });

  it('rejects a transaction pointing to a missing account', async () => {
    const raw = await validRaw();

    expect(codeOf(migrateSnapshot({ ...raw, transactions: [{ ...tx(), accountId: 'ghost' }] }))).toBe('backup.invalidSnapshot');
  });

  it('rejects a transaction pointing to a missing category', async () => {
    const raw = await validRaw();

    expect(codeOf(migrateSnapshot({ ...raw, transactions: [{ ...tx(), categoryId: 'ghost' }] }))).toBe('backup.invalidSnapshot');
  });

  it('rejects duplicated dedup keys and duplicated ids', async () => {
    const raw = await validRaw();
    const dupKey = [tx(), tx({ id: 'tx-2' as never })];
    const dupId = [tx(), tx({ dedupKey: 'other#0' as never })];

    expect(codeOf(migrateSnapshot({ ...raw, transactions: dupKey }))).toBe('backup.invalidSnapshot');
    expect(codeOf(migrateSnapshot({ ...raw, transactions: dupId }))).toBe('backup.invalidSnapshot');
  });

  it('rejects an invalid rule operator and an invalid budget range', async () => {
    const raw = await validRaw();

    expect(codeOf(migrateSnapshot({ ...raw, rules: [{ ...rule(), operator: 'regex' }] }))).toBe('backup.invalidSnapshot');
    expect(codeOf(migrateSnapshot({ ...raw, budgets: [{ id: 'b', categoryId: 'x', monthlyLimit: { cents: 1 }, startMonth: '2026-13', endMonth: null }] }))).toBe('backup.invalidSnapshot');
  });

  it('rejects records that are not objects and invalid settings', async () => {
    const raw = await validRaw();

    expect(codeOf(migrateSnapshot({ ...raw, accounts: [1] }))).toBe('backup.invalidSnapshot');
    expect(codeOf(migrateSnapshot({ ...raw, settings: { locale: 'fr', theme: 'dark' } }))).toBe('backup.invalidSnapshot');
    expect(codeOf(migrateSnapshot({ ...raw, exportedAt: 5 }))).toBe('backup.invalidSnapshot');
  });

  it('accepts settings, null settings and an orphan-free uncategorized sentinel', async () => {
    const raw = await validRaw();

    expect(migrateSnapshot({ ...raw, settings: { locale: 'es', theme: 'dark', lastBackupAt: '2026-01-01T00:00:00.000Z' } }).ok).toBe(true);
    expect(migrateSnapshot({ ...raw, settings: null }).ok).toBe(true);
    expect(ACCOUNT).toBeDefined();
  });

  const mapping = { headerRowIndex: 0, columns: ['date', 'description', 'amount'], amountConvention: 'signed' };
  const batch = { id: 'b', accountId: ACCOUNT, fileName: 'f.csv', importedAt: 'x', rowCount: 1, inserted: 1, duplicates: 0, mapping };
  const profile = { headerSignature: 'FECHA', mapping, accountId: null };

  it('accepts well-formed import batches and profiles', async () => {
    const raw = await validRaw();

    expect(migrateSnapshot({ ...raw, importBatches: [batch], importProfiles: [profile] }).ok).toBe(true);
  });

  it.each([
    ['batch with a non-integer header row', { importBatches: [{ ...batch, mapping: { ...mapping, headerRowIndex: 0.5 } }] }],
    ['batch with an unknown convention', { importBatches: [{ ...batch, mapping: { ...mapping, amountConvention: 'x' } }] }],
    ['batch with unknown column roles', { importBatches: [{ ...batch, mapping: { ...mapping, columns: ['nope'] } }] }],
    ['batch with non-array columns', { importBatches: [{ ...batch, mapping: { ...mapping, columns: 'date' } }] }],
    ['batch with a non numeric count', { importBatches: [{ ...batch, rowCount: 'many' }] }],
    ['duplicated batch ids', { importBatches: [batch, batch] }],
    ['profile with a bad mapping', { importProfiles: [{ ...profile, mapping: null }] }],
    ['profile with a numeric account', { importProfiles: [{ ...profile, accountId: 3 }] }],
    ['duplicated profile signatures', { importProfiles: [profile, profile] }],
    ['account with another currency', { accounts: [{ id: 'a', name: 'n', ibanLast4: null, currency: 'USD', createdAt: 'x' }] }],
    ['duplicated account ids', { accounts: [{ id: 'a', name: 'n', ibanLast4: null, currency: 'EUR', createdAt: 'x' }, { id: 'a', name: 'n', ibanLast4: null, currency: 'EUR', createdAt: 'x' }] }],
    ['category with an unknown kind', { categories: [{ id: 'c', name: 'n', nameKey: null, kind: 'other', color: 'x', archived: false }] }],
    ['category with a non boolean archived flag', { categories: [{ id: 'c', name: 'n', nameKey: null, kind: 'expense', color: 'x', archived: 'no' }] }],
    ['rule with a non numeric priority', { rules: [{ ...rule(), priority: Number.NaN }] }],
    ['budget with a non object limit', { budgets: [{ id: 'b', categoryId: 'x', monthlyLimit: 5, startMonth: '2026-01', endMonth: null }] }],
    ['budget with an invalid end month', { budgets: [{ id: 'b', categoryId: 'x', monthlyLimit: { cents: 5 }, startMonth: '2026-01', endMonth: '2026-99' }] }],
    ['transaction with an invalid value date', { transactions: [{ ...tx(), valueDate: '2026-13-01' }] }],
    ['transaction with an unsafe balance', { transactions: [{ ...tx(), balance: { cents: 2 ** 60 } }] }],
    ['transaction with a numeric description', { transactions: [{ ...tx(), description: 7 }] }],
    ['settings with an unknown theme', { settings: { locale: 'es', theme: 'neon' } }],
    ['settings with a non text lastBackupAt', { settings: { locale: 'es', theme: 'dark', lastBackupAt: 1 } }],
    ['missing schema version', { schemaVersion: undefined }],
  ])('rejects %s', async (_name, patch) => {
    const raw = await validRaw();

    expect(codeOf(migrateSnapshot({ ...raw, ...patch }))).toBe('backup.invalidSnapshot');
  });

  it('reports the offending field but never the value', async () => {
    const raw = await validRaw();

    const result = migrateSnapshot({ ...raw, transactions: [{ ...tx(), description: 7 }] });

    expect(result).toEqual({ ok: false, error: { code: 'backup.invalidSnapshot', details: { field: 'transactions[0].description' } } });
  });

  it('rethrows unexpected errors instead of masking them', () => {
    const hostile = { get formatVersion(): number { throw new Error('getter exploded'); } };

    expect(() => migrateSnapshot(hostile)).toThrow('getter exploded');
  });
});
