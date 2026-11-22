import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_PREVIEW_ROWS, type ImportResult } from '@/application/ports/inbound/ImportStatement';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import { ImportStatementUseCase } from '@/application/use-cases/ImportStatementUseCase';
import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category';
import type { ColumnMapping } from '@/domain/import/ColumnMapping';
import type { StatementFile } from '@/domain/import/StatementFile';
import type { AccountId } from '@/domain/account/Account';
import { headerSignature } from '@/domain/import/detectColumnMapping';
import { ACCOUNT, rule, table } from '../../domain/builders';
import { InMemoryStatementParser } from '../../fakes/InMemoryStatementParser';
import { createWorld, type World } from '../harness';

const HEADER = ['Fecha', 'Concepto', 'Importe', 'Saldo'];
const FILE: StatementFile = { name: 'extracto.csv', bytes: new ArrayBuffer(0) };
const GROCERIES = 'cat-groceries' as CategoryId;

let w: World;
let onDataChanged: ReturnType<typeof vi.fn<() => void>>;

function build(rows: readonly (readonly string[])[], parser?: InMemoryStatementParser, transactions: TransactionRepository = w.transactions) {
  const p = parser ?? InMemoryStatementParser.returning(table([HEADER, ...rows]));
  return new ImportStatementUseCase({
    parser: p,
    transactions,
    profiles: w.profiles,
    rules: w.rules,
    categories: w.categories,
    accounts: w.accounts,
    clock: w.clock,
    ids: w.ids,
    onDataChanged,
  });
}

async function importRows(rows: readonly (readonly string[])[]): Promise<ImportResult> {
  const useCase = build(rows);
  const preview = await useCase.preview(FILE);
  if (!preview.ok) throw new Error(preview.error.code);
  const result = await useCase.commit({ previewId: preview.value.previewId, accountId: ACCOUNT, mapping: preview.value.suggestedMapping });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

const COFFEE = ['15/01/2026', 'CAFE BAR', '-2,50', ''];
const SALARY = ['28/01/2026', 'NOMINA EMPRESA', '1500,00', ''];
const GROCERY = ['20/01/2026', 'COMPRA MERCADONA', '-35,10', ''];

beforeEach(() => {
  w = createWorld();
  onDataChanged = vi.fn<() => void>();
});

describe('ImportStatementUseCase.preview', () => {
  it('suggests the detected mapping and writes nothing', async () => {
    const result = await build([COFFEE, SALARY]).preview(FILE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.suggestedMapping.headerRowIndex).toBe(0);
    expect(result.value.suggestedMapping.columns).toEqual(['date', 'description', 'amount', 'balance']);
    expect(result.value.rememberedMapping).toBe(false);
    expect(result.value.confidence).toBeGreaterThan(0.5);
    expect(result.value.previewId).not.toBe('');
    expect(w.state.transactions.size).toBe(0);
    expect(w.state.importBatches.size).toBe(0);
    expect(w.state.importProfiles.size).toBe(0);
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  it('sends only the first rows of the table to the UI', async () => {
    const rows = Array.from({ length: 80 }, () => COFFEE);

    const result = await build(rows).preview(FILE);

    expect(result.ok && result.value.table.rows).toHaveLength(IMPORT_PREVIEW_ROWS);
  });

  it('rejects unsupported file formats', async () => {
    const parser = InMemoryStatementParser.returning(table([HEADER]), ['xlsx']);

    const result = await build([], parser).preview(FILE);

    expect(result).toEqual({ ok: false, error: { code: 'import.unsupportedFormat' } });
    expect(parser.parsedNames).toEqual([]);
  });

  it('propagates parser failures', async () => {
    const result = await build([], InMemoryStatementParser.failing('import.corruptFile')).preview(FILE);

    expect(result).toEqual({ ok: false, error: { code: 'import.corruptFile' } });
  });

  it('rejects a table without rows as an empty file', async () => {
    const result = await build([], InMemoryStatementParser.returning(table([]))).preview(FILE);

    expect(result).toEqual({ ok: false, error: { code: 'import.emptyFile' } });
  });

  it('reuses the remembered mapping of a known header signature', async () => {
    const remembered: ColumnMapping = { headerRowIndex: 0, columns: ['date', 'description', 'amount', 'ignore'], amountConvention: 'signed' };
    await w.profiles.save({ headerSignature: headerSignature(HEADER), mapping: remembered, accountId: ACCOUNT });

    const result = await build([COFFEE]).preview(FILE);

    expect(result.ok && result.value.rememberedMapping).toBe(true);
    expect(result.ok && result.value.suggestedMapping).toEqual(remembered);
  });

  it('flags ambiguous dates when every date could be dd/mm or mm/dd', async () => {
    const result = await build([['03/04/2026', 'CAFE', '-1,00', ''], ['05/06/2026', 'CAFE', '-1,00', '']]).preview(FILE);

    expect(result.ok && result.value.ambiguousDates).toBe(true);
  });

  it('does not flag dates when at least one is unambiguous', async () => {
    const result = await build([['03/04/2026', 'CAFE', '-1,00', ''], COFFEE]).preview(FILE);

    expect(result.ok && result.value.ambiguousDates).toBe(false);
  });

  it('keeps the table of unrecognised headers working with a headerless mapping', async () => {
    const parser = InMemoryStatementParser.returning(table([['15/01/2026', 'CAFE', '-2,50']]));

    const result = await build([], parser).preview(FILE);

    expect(result.ok && result.value.rememberedMapping).toBe(false);
  });
});

describe('ImportStatementUseCase.commit', () => {
  it('fails with import.previewNotFound for an unknown preview', async () => {
    const result = await build([COFFEE]).commit({ previewId: 'nope', accountId: ACCOUNT, mapping: { headerRowIndex: 0, columns: [], amountConvention: 'signed' } });

    expect(result).toEqual({ ok: false, error: { code: 'import.previewNotFound' } });
  });

  it('fails with import.accountNotFound and writes nothing', async () => {
    const useCase = build([COFFEE]);
    const preview = await useCase.preview(FILE);
    if (!preview.ok) throw new Error('preview');

    const result = await useCase.commit({ previewId: preview.value.previewId, accountId: 'ghost' as AccountId, mapping: preview.value.suggestedMapping });

    expect(result).toEqual({ ok: false, error: { code: 'import.accountNotFound' } });
    expect(w.state.transactions.size).toBe(0);
  });

  it('rejects a mapping without a date column and keeps the preview usable', async () => {
    const useCase = build([COFFEE]);
    const preview = await useCase.preview(FILE);
    if (!preview.ok) throw new Error('preview');
    const bad: ColumnMapping = { ...preview.value.suggestedMapping, columns: ['ignore', 'description', 'amount', 'balance'] };

    const rejected = await useCase.commit({ previewId: preview.value.previewId, accountId: ACCOUNT, mapping: bad });
    const retried = await useCase.commit({ previewId: preview.value.previewId, accountId: ACCOUNT, mapping: preview.value.suggestedMapping });

    expect(rejected).toEqual({ ok: false, error: { code: 'import.missingDateColumn', details: { field: 'date' } } });
    expect(retried.ok).toBe(true);
  });

  it('inserts new movements with ids, dedup keys, batch and uncategorized defaults', async () => {
    const result = await importRows([COFFEE, SALARY]);

    expect(result).toMatchObject({ inserted: 2, duplicates: 0, autoCategorized: 0, rowErrors: [] });
    const txs = [...w.state.transactions.values()];
    expect(txs).toHaveLength(2);
    expect(txs[0]).toMatchObject({ accountId: ACCOUNT, categoryId: UNCATEGORIZED, categorySource: 'none', ruleId: null, note: '', importBatchId: result.batchId, createdAt: w.clock.now() });
    expect(txs.map((t) => t.dedupKey).every((k) => k.includes('#0'))).toBe(true);
    expect(w.state.importBatches.get(result.batchId)).toMatchObject({ accountId: ACCOUNT, fileName: 'extracto.csv', rowCount: 2, inserted: 2, duplicates: 0, importedAt: w.clock.now() });
    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  it('categorizes with the rules by priority and counts auto-categorized rows', async () => {
    await w.rules.save(rule({ id: 'r1' as never, pattern: 'MERCADONA', categoryId: GROCERIES }));

    const result = await importRows([COFFEE, GROCERY]);

    expect(result.autoCategorized).toBe(1);
    const grocery = [...w.state.transactions.values()].find((t) => t.normalizedDescription === 'COMPRA MERCADONA');
    expect(grocery).toMatchObject({ categoryId: GROCERIES, categorySource: 'rule', ruleId: 'r1' });
  });

  it('reports invalid rows with their line and imports the valid ones', async () => {
    const result = await importRows([COFFEE, ['31/02/2026', 'MAL', '-1,00', ''], ['16/01/2026', 'OTRO', 'abc', ''], SALARY]);

    expect(result.inserted).toBe(2);
    expect(result.rowErrors.map((e) => e.line)).toEqual([3, 4]);
    expect(w.state.transactions.size).toBe(2);
  });

  it('inserts nothing new when the same statement is imported again', async () => {
    await importRows([COFFEE, SALARY, GROCERY]);

    const again = await importRows([COFFEE, SALARY, GROCERY]);

    expect(again).toMatchObject({ inserted: 0, duplicates: 3 });
    expect(w.state.transactions.size).toBe(3);
    expect(w.state.importBatches.size).toBe(1);
  });

  it('only inserts the non-overlapping rows of an overlapping statement', async () => {
    await importRows([COFFEE, SALARY]);

    const result = await importRows([SALARY, GROCERY, ['30/01/2026', 'OTRA COSA', '-9,99', '']]);

    expect(result).toMatchObject({ inserted: 2, duplicates: 1 });
    expect(w.state.transactions.size).toBe(4);
  });

  it('keeps two identical same-day operations and counts them as a multiset', async () => {
    const first = await importRows([COFFEE, COFFEE]);
    const second = await importRows([COFFEE, COFFEE]);
    const third = await importRows([COFFEE, COFFEE, COFFEE]);

    expect([first.inserted, second.inserted, third.inserted]).toEqual([2, 0, 1]);
    expect(w.state.transactions.size).toBe(3);
  });

  it('remembers the mapping per header signature for the next import', async () => {
    await importRows([COFFEE]);

    const profile = await w.profiles.find(headerSignature(HEADER));

    expect(profile).toMatchObject({ accountId: ACCOUNT, mapping: { headerRowIndex: 0, columns: ['date', 'description', 'amount', 'balance'] } });
    const next = await build([COFFEE]).preview(FILE);
    expect(next.ok && next.value.rememberedMapping).toBe(true);
  });

  it('does not remember a mapping when the file has no header row', async () => {
    const parser = InMemoryStatementParser.returning(table([['15/01/2026', 'CAFE BAR', '-2,50']]));
    const useCase = build([], parser);
    const preview = await useCase.preview(FILE);
    if (!preview.ok) throw new Error('preview');

    await useCase.commit({ previewId: preview.value.previewId, accountId: ACCOUNT, mapping: preview.value.suggestedMapping });

    expect(w.state.importProfiles.size).toBe(0);
  });

  it('is single-use: a committed preview cannot be committed twice', async () => {
    const useCase = build([COFFEE]);
    const preview = await useCase.preview(FILE);
    if (!preview.ok) throw new Error('preview');
    const input = { previewId: preview.value.previewId, accountId: ACCOUNT, mapping: preview.value.suggestedMapping };

    await useCase.commit(input);
    const second = await useCase.commit(input);

    expect(second).toEqual({ ok: false, error: { code: 'import.previewNotFound' } });
  });

  it('leaves the database untouched when the write fails with a quota error', async () => {
    await importRows([COFFEE]);
    const before = structuredClone(w.state);
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    const failing = { existingDedupKeys: (k: never) => w.transactions.existingDedupKeys(k), insertImport: () => Promise.reject(quota) } as unknown as TransactionRepository;
    const useCase = build([SALARY, GROCERY], undefined, failing);
    const preview = await useCase.preview(FILE);
    if (!preview.ok) throw new Error('preview');

    const result = await useCase.commit({ previewId: preview.value.previewId, accountId: ACCOUNT, mapping: preview.value.suggestedMapping });

    expect(result).toEqual({ ok: false, error: { code: 'storage.quotaExceeded' } });
    expect(w.state).toEqual(before);
    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  it('rethrows unexpected write failures', async () => {
    const failing = { existingDedupKeys: (k: never) => w.transactions.existingDedupKeys(k), insertImport: () => Promise.reject(new Error('disk')) } as unknown as TransactionRepository;
    const useCase = build([COFFEE], undefined, failing);
    const preview = await useCase.preview(FILE);
    if (!preview.ok) throw new Error('preview');

    await expect(useCase.commit({ previewId: preview.value.previewId, accountId: ACCOUNT, mapping: preview.value.suggestedMapping })).rejects.toThrow('disk');
  });

  it('works without the onDataChanged callback', async () => {
    const useCase = new ImportStatementUseCase({
      parser: InMemoryStatementParser.returning(table([HEADER, COFFEE])),
      transactions: w.transactions,
      profiles: w.profiles,
      rules: w.rules,
      categories: w.categories,
      accounts: w.accounts,
      clock: w.clock,
      ids: w.ids,
    });
    const preview = await useCase.preview(FILE);
    if (!preview.ok) throw new Error('preview');

    const result = await useCase.commit({ previewId: preview.value.previewId, accountId: ACCOUNT, mapping: preview.value.suggestedMapping });

    expect(result.ok).toBe(true);
  });
});

describe('ImportStatementUseCase.commit cuando falla guardar el perfil (silent-failures ALTA-3)', () => {
  it('la importación ya guardada se informa como éxito y se avisa al índice', async () => {
    vi.spyOn(w.profiles, 'save').mockRejectedValue(new Error('quota'))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await importRows([COFFEE, SALARY])

    expect(result.inserted).toBe(2)
    expect(w.state.transactions.size).toBe(2)
    expect(onDataChanged).toHaveBeenCalled()
  })
})
