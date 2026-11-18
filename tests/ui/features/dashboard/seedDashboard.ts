import type { AppContainer } from '@/composition/container.types';
import { createTestContainer } from '@/composition/createTestContainer';
import type { Account, AccountId } from '@/domain/account/Account';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import type { Cents } from '@/domain/money/Money';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';
import {
  InMemoryAccountRepository,
  InMemoryBudgetRepository,
  InMemoryCategoryRepository,
} from '../../../fakes/InMemoryCatalogRepositories';
import { createInMemoryState } from '../../../fakes/InMemoryState';
import { InMemoryTransactionRepository } from '../../../fakes/InMemoryTransactionRepository';

export const CHECKING = 'acc-checking' as AccountId;
export const SAVINGS = 'acc-savings' as AccountId;

const cat = (slug: string) => `cat-${slug}` as CategoryId;

type Row = readonly [account: AccountId, date: string, cents: number, category: CategoryId, balance?: number];

/**
 * Libro sintético con sumas conocidas (AC-025): marzo 2026 es el último mes con movimientos.
 * - Marzo: nómina +2.000,00; supermercado 250,00 + 150,00; restaurantes 120,50; transporte 60,06;
 *   sin categoría 10,00 → gastos 590,56 €, ahorro 1.409,44 €.
 * - Febrero: nómina +2.000,00; supermercado 300,00 → marzo gasta un 97 % más (+290,56 €).
 * - Octubre 2025: ocio 45,00. Resto de los 12 meses, sin movimientos (deben salir a 0).
 * - Cuenta corriente: el último movimiento trae saldo (3.210,99 €). Ahorro: sin saldo → «estimado».
 */
const ROWS: readonly Row[] = [
  [CHECKING, '2025-10-12', -4500, cat('leisure')],
  [CHECKING, '2026-02-01', 200_000, cat('salary')],
  [CHECKING, '2026-02-10', -30_000, cat('groceries')],
  [CHECKING, '2026-03-01', 200_000, cat('salary')],
  [CHECKING, '2026-03-03', -25_000, cat('groceries')],
  [CHECKING, '2026-03-09', -15_000, cat('groceries')],
  [CHECKING, '2026-03-12', -12_050, cat('restaurants')],
  [CHECKING, '2026-03-14', -6006, cat('transport'), 321_099],
  [SAVINGS, '2026-03-05', -1000, UNCATEGORIZED],
];

function transaction([accountId, date, cents, categoryId, balance]: Row, index: number): Transaction {
  return {
    id: `tx-${index}` as TransactionId,
    accountId,
    date: date as IsoDate,
    valueDate: null,
    amount: { cents: cents as Cents },
    balance: balance === undefined ? null : { cents: balance as Cents },
    rawDescription: `MOVIMIENTO ${index}`,
    description: `Movimiento ${index}`,
    normalizedDescription: `movimiento ${index}`,
    categoryId,
    categorySource: 'rule',
    ruleId: null,
    note: '',
    dedupKey: `dk-${index}` as DedupKey,
    importBatchId: 'batch-1' as ImportBatchId,
    createdAt: '2026-03-15T00:00:00.000Z',
    updatedAt: '2026-03-15T00:00:00.000Z',
  };
}

const ACCOUNTS: readonly Account[] = [
  { id: CHECKING, name: 'Cuenta nómina', ibanLast4: '1234', currency: 'EUR', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: SAVINGS, name: 'Ahorro', ibanLast4: null, currency: 'EUR', createdAt: '2026-01-01T00:00:00.000Z' },
];

function budget(id: string, slug: string, limitCents: number): Budget {
  return {
    id: id as BudgetId,
    categoryId: cat(slug),
    monthlyLimit: { cents: limitCents as Cents },
    startMonth: '2026-01' as YearMonth,
    endMonth: null,
  };
}

/** Supermercado se supera (400/350), restaurantes cerca (120,50/140) y transporte va bien (60,06/500). */
const BUDGETS: readonly Budget[] = [
  budget('bud-transport', 'transport', 50_000),
  budget('bud-groceries', 'groceries', 35_000),
  budget('bud-restaurants', 'restaurants', 14_000),
];

type SeedOptions = { readonly hasBudgets?: boolean };

/** Contenedor de test (casos de uso reales) sembrado con el libro sintético. */
export function createSeededContainer({ hasBudgets = true }: SeedOptions = {}): Promise<AppContainer> {
  const state = createInMemoryState();
  ROWS.forEach((row, index) => state.transactions.set(`tx-${index}`, transaction(row, index)));
  ACCOUNTS.forEach((account) => state.accounts.set(account.id, account));
  if (hasBudgets) BUDGETS.forEach((item) => state.budgets.set(item.id, item));
  return createTestContainer({
    transactions: new InMemoryTransactionRepository(state),
    accounts: new InMemoryAccountRepository(state),
    categories: new InMemoryCategoryRepository(state),
    budgets: new InMemoryBudgetRepository(state),
  });
}
