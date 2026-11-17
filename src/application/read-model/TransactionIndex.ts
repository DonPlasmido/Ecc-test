import type {
  TransactionFilter,
  TransactionSortKey,
} from '@/application/ports/inbound/QueryTransactions';
import type { AccountId } from '@/domain/account/Account';
import type { CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Money } from '@/domain/money/Money';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';

/** Ingresos y gastos agregados de una celda mes × categoría. */
export interface IncomeExpenseTotals {
  readonly income: Money;
  readonly expense: Money;
}

/** Totales por mes y categoría. */
export type MonthCategoryTotals = ReadonlyMap<YearMonth, ReadonlyMap<CategoryId, IncomeExpenseTotals>>;

/** Predicado de bajo nivel sobre columnas del índice (sin crear objetos). */
export type IndexRowPredicate = (
  normalizedDescription: string,
  cents: number,
  accountIdx: number,
) => boolean;

/**
 * Índice columnar en memoria (ADR-0009). Sin E/S; mutable por dentro de forma encapsulada,
 * hacia fuera solo resultados inmutables y `version`.
 */
export interface TransactionIndex {
  /** Durante el arranque, por lotes. */
  hydrate(batch: readonly Transaction[]): void;
  applyUpserts(txs: readonly Transaction[]): void;
  applyDeletes(ids: readonly TransactionId[]): void;
  /** Posiciones ordenadas de las filas que cumplen el filtro. */
  filter(f: TransactionFilter, sort: TransactionSortKey): Uint32Array;
  idsAt(positions: Uint32Array, offset: number, limit: number): readonly TransactionId[];
  sumAt(positions: Uint32Array): Money;
  totalsByMonthAndCategory(
    from: YearMonth,
    to: YearMonth,
    accountIds?: readonly AccountId[],
  ): MonthCategoryTotals;
  countMatching(predicate: IndexRowPredicate): number;
  readonly size: number;
  /** Se incrementa en cada cambio. */
  readonly version: number;
}

// TODO(application): implementación en este archivo o en ColumnarTransactionIndex.ts.
// export function createTransactionIndex(): TransactionIndex; // equivale a TransactionIndex.empty()
