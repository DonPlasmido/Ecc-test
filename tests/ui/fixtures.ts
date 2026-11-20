import type { AccountId } from '@/domain/account/Account';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import type { Cents, Money } from '@/domain/money/Money';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';

export const money = (cents: number): Money => ({ cents: cents as Cents });

export const groceries: Category = {
  id: 'cat-groceries' as CategoryId,
  name: 'Supermercado',
  nameKey: 'categories.groceries',
  kind: 'expense',
  color: 'chart-1',
  archived: false,
};

export const customCategory: Category = {
  id: 'cat-custom' as CategoryId,
  name: 'Mascotas',
  nameKey: null,
  kind: 'expense',
  color: 'cat-6',
  archived: false,
};

/** Movimiento sintético determinista para la fila `index`. */
export function makeTransaction(index: number): Transaction {
  const day = String((index % 28) + 1).padStart(2, '0');
  return {
    id: `tx-${index}` as TransactionId,
    accountId: 'acc-1' as AccountId,
    date: `2026-03-${day}` as IsoDate,
    valueDate: null,
    amount: money(index % 2 === 0 ? -(1000 + index) : 50_000),
    balance: null,
    rawDescription: `MOVIMIENTO ${index}`,
    description: `Movimiento ${index}`,
    normalizedDescription: `movimiento ${index}`,
    categoryId: groceries.id,
    categorySource: 'rule',
    ruleId: null,
    note: '',
    dedupKey: `dk-${index}` as DedupKey,
    importBatchId: 'batch-1' as ImportBatchId,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };
}
