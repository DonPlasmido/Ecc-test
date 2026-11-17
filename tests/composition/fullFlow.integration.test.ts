import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardData } from '@/application/ports/inbound/BuildDashboard';
import type { AppContainer } from '@/composition/container.types';
import { createContainer } from '@/composition/createContainer';
import type { AccountId } from '@/domain/account/Account';
import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import { Money as MoneyOps, type Money } from '@/domain/money/Money';
import type { Transaction } from '@/domain/transaction/Transaction';
import { uniqueDbName } from '../infrastructure/indexeddb/fixtures';

const PASSWORD = 'una-contrasena-larga-123';
const SUBSCRIPTIONS = 'cat-subscriptions' as CategoryId;
const FAST_CIPHER = { iterations: 1000, iterationLimits: { min: 1, max: 5000 } } as const;
const ALL_TIME = { from: '2026-01' as YearMonth, to: '2026-12' as YearMonth };

const open: AppContainer[] = [];

async function newContainer(dbName: string = uniqueDbName('flow')): Promise<AppContainer> {
  const container = await createContainer({ dbName, cipherOptions: FAST_CIPHER });
  open.push(container);
  await container.whenIndexIdle();
  return container;
}

afterEach(() => {
  for (const c of open.splice(0)) c.dispose();
});

function sample(name: string): { name: string; bytes: ArrayBuffer } {
  const buf = readFileSync(resolve(__dirname, '../../public/samples', name));
  return { name, bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
}

async function importSample(c: AppContainer, fileName: string, accountId: AccountId) {
  const preview = await c.importStatement.preview(sample(fileName));
  if (!preview.ok) throw new Error(`preview failed: ${preview.error.code}`);
  const committed = await c.importStatement.commit({
    previewId: preview.value.previewId,
    accountId,
    mapping: preview.value.suggestedMapping,
  });
  if (!committed.ok) throw new Error(`commit failed: ${committed.error.code}`);
  await c.whenIndexIdle();
  return committed.value;
}

async function allTransactions(c: AppContainer): Promise<readonly Transaction[]> {
  const { resultId, total } = await c.queryTransactions.search({ filter: {}, sort: 'dateAsc' });
  const rows = await c.queryTransactions.page({ resultId, offset: 0, limit: total });
  // Orden estable por id: el orden entre movimientos de la misma fecha no forma parte del contrato.
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

/** El orden de saldos y de categorías depende del orden de hidratación; se compara ordenado. */
function normalizeDashboard(d: DashboardData): DashboardData {
  return {
    ...d,
    spendingByCategory: [...d.spendingByCategory].sort((a, b) => a.categoryId.localeCompare(b.categoryId)),
    balances: [...d.balances].sort((a, b) => a.accountId.localeCompare(b.accountId)),
  };
}

async function normalizedDashboard(c: AppContainer): Promise<DashboardData> {
  return normalizeDashboard(await c.buildDashboard.execute(ALL_TIME));
}

async function createAccount(c: AppContainer, name: string): Promise<AccountId> {
  const saved = await c.manageCatalog.saveAccount({ name, ibanLast4: null });
  if (!saved.ok) throw new Error('account');
  return saved.value.id;
}

describe('composition root: full flow over IndexedDB', () => {
  it('seeds default categories on first start and requests persistence', async () => {
    const c = await newContainer();
    const categories = await c.manageCatalog.listCategories();
    expect(categories.some((x) => x.id === UNCATEGORIZED)).toBe(true);
    expect(categories.some((x) => x.id === SUBSCRIPTIONS)).toBe(true);
    expect(c.indexStore.getSnapshot().hydration.status).toBe('ready');
  });

  it('does not duplicate seeded categories when reopening the same database', async () => {
    const dbName = uniqueDbName('flow');
    const first = await newContainer(dbName);
    const count = (await first.manageCatalog.listCategories()).length;
    first.dispose();
    const second = await newContainer(dbName);
    expect((await second.manageCatalog.listCategories()).length).toBe(count);
  });

  it('imports, dedups, learns rules, budgets, dashboards and round-trips an encrypted backup', async () => {
    const c = await newContainer();
    const bbva = await createAccount(c, 'BBVA');
    const caixa = await createAccount(c, 'CaixaBank');

    const first = await importSample(c, 'bbva.csv', bbva);
    expect(first.inserted).toBeGreaterThan(0);
    expect(first.duplicates).toBe(0);
    const second = await importSample(c, 'caixabank.csv', caixa);
    expect(second.inserted).toBeGreaterThan(0);
    const total = first.inserted + second.inserted;
    expect(c.indexStore.getSnapshot().size).toBe(total);

    const again = await importSample(c, 'bbva.csv', bbva);
    expect(again.inserted).toBe(0);
    expect(again.duplicates).toBe(first.inserted);
    expect(c.indexStore.getSnapshot().size).toBe(total);

    const versionBefore = c.indexStore.getSnapshot().version;
    const before = await allTransactions(c);
    const netflix = before.find((t) => t.normalizedDescription.includes('NETFLIX'));
    expect(netflix).toBeDefined();
    const corrected = await c.learnRuleFromCorrection.correct({ transactionId: netflix!.id, categoryId: SUBSCRIPTIONS });
    expect(corrected.ok).toBe(true);
    await c.whenIndexIdle();
    expect(c.indexStore.getSnapshot().version).toBeGreaterThan(versionBefore);
    if (!corrected.ok || corrected.value.suggestion === null) throw new Error('no suggestion');
    const accepted = await c.learnRuleFromCorrection.accept({ suggestion: corrected.value.suggestion, applyToExisting: true });
    expect(accepted.ok).toBe(true);
    await c.whenIndexIdle();
    expect((await c.manageCatalog.listRules()).length).toBe(1);

    const afterLearning = await allTransactions(c);
    expect(afterLearning.find((t) => t.id === netflix!.id)?.categoryId).toBe(SUBSCRIPTIONS);
    const inSubscriptions = afterLearning.filter((t) => t.categoryId === SUBSCRIPTIONS);
    expect(inSubscriptions.length).toBeGreaterThanOrEqual(1);
    const indexed = await c.queryTransactions.search({ filter: { categoryIds: [SUBSCRIPTIONS] }, sort: 'dateAsc' });
    expect(indexed.total).toBe(inSubscriptions.length);

    expect(total).toBe(100);
    expect(corrected.value.affectedCount).toBe(5);
    expect(accepted.ok && accepted.value.recategorized).toBe(5);
    expect(afterLearning.filter((t) => t.categorySource === 'rule')).toHaveLength(5);
    expect(afterLearning.filter((t) => t.categoryId !== UNCATEGORIZED)).toHaveLength(6);
    const budget = await c.manageCatalog.saveBudget({
      categoryId: SUBSCRIPTIONS,
      monthlyLimit: limitOf(1000),
      startMonth: '2026-08' as YearMonth,
      endMonth: null,
    });
    expect(budget.ok).toBe(true);
    const evaluations = await c.evaluateBudgets.execute({ month: '2026-08' as YearMonth });
    expect(evaluations).toHaveLength(1);

    const dashboard = await c.buildDashboard.execute(ALL_TIME);
    expect(dashboard.monthly.some((m) => m.expense.cents !== 0)).toBe(true);

    const exported = await c.exportEncryptedBackup.execute({ password: PASSWORD });
    if (!exported.ok) throw new Error('export');
    expect((await c.settings.get())?.lastBackupAt).toBeDefined();

    // Borrar: una copia de una base vacía reemplaza todo y el índice se vacía.
    const empty = await newContainer();
    const emptyBackup = await empty.exportEncryptedBackup.execute({ password: PASSWORD });
    if (!emptyBackup.ok) throw new Error('empty export');
    const wiped = await c.importEncryptedBackup.execute({ bytes: emptyBackup.value.bytes, password: PASSWORD });
    expect(wiped.ok).toBe(true);
    await c.whenIndexIdle();
    expect(c.indexStore.getSnapshot().size).toBe(0);
    expect(await allTransactions(c)).toHaveLength(0);

    // Restaurar en el mismo contenedor y en una base nueva: mismos datos.
    const restored = await c.importEncryptedBackup.execute({ bytes: exported.value.bytes, password: PASSWORD });
    expect(restored.ok).toBe(true);
    await c.whenIndexIdle();
    const fresh = await newContainer();
    const imported = await fresh.importEncryptedBackup.execute({ bytes: exported.value.bytes, password: PASSWORD });
    expect(imported.ok).toBe(true);
    await fresh.whenIndexIdle();

    for (const target of [c, fresh]) {
      expect(target.indexStore.getSnapshot().size).toBe(total);
      expect(await allTransactions(target)).toEqual(afterLearning);
      expect(await target.manageCatalog.listRules()).toEqual(await c.manageCatalog.listRules());
      expect(await target.manageCatalog.listBudgets()).toHaveLength(1);
      expect(await normalizedDashboard(target)).toEqual(normalizeDashboard(dashboard));
    }
  });

  it('returns wrong-password errors without touching data', async () => {
    const c = await newContainer();
    const backup = await c.exportEncryptedBackup.execute({ password: PASSWORD });
    if (!backup.ok) throw new Error('export');
    const result = await c.importEncryptedBackup.execute({ bytes: backup.value.bytes, password: 'otra-contrasena-123' });
    expect(result.ok).toBe(false);
  });
});

function limitOf(cents: number): Money {
  const money = MoneyOps.ofCents(cents);
  if (!money.ok) throw new Error("money");
  return money.value;
}
