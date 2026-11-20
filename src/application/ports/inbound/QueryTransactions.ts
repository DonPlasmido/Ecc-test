import type { AccountId } from '@/domain/account/Account';
import type { CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { Money } from '@/domain/money/Money';
import type { AmountSign } from '@/domain/rule/Rule';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';

/** Filas por página que pide la lista virtualizada. */
export const TRANSACTION_PAGE_SIZE = 100;

/** Filtro de la lista de movimientos (todos los campos son opcionales). */
export interface TransactionFilter {
  /** Se normaliza igual que `normalizedDescription`. */
  readonly text?: string;
  readonly categoryIds?: readonly CategoryId[];
  readonly accountIds?: readonly AccountId[];
  readonly from?: IsoDate;
  readonly to?: IsoDate;
  readonly sign?: AmountSign;
  readonly minCents?: number;
  readonly maxCents?: number;
}

/** Orden de la lista. */
export type TransactionSortKey = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc';

/** Entrada de la búsqueda. */
export interface SearchTransactionsInput {
  readonly filter: TransactionFilter;
  readonly sort: TransactionSortKey;
}

/** Resultado de la búsqueda (las filas se piden después por páginas). */
export interface SearchTransactionsOutput {
  readonly resultId: string;
  readonly total: number;
  readonly sum: Money;
}

/** Página de un resultado de búsqueda. */
export interface PageTransactionsInput {
  readonly resultId: string;
  readonly offset: number;
  readonly limit: number;
}

/** Campos editables por el usuario. */
export interface TransactionPatch {
  readonly description?: string;
  readonly note?: string;
}

/** Edición de un movimiento. */
export interface UpdateTransactionInput {
  readonly id: TransactionId;
  readonly patch: TransactionPatch;
}

/** Consulta y edición de movimientos. */
export interface QueryTransactions {
  /** Fase 1 (en memoria): cuenta y fija el orden. */
  search(input: SearchTransactionsInput): Promise<SearchTransactionsOutput>;
  /** Fase 2: trae de IndexedDB las filas visibles, en el orden fijado. */
  page(input: PageTransactionsInput): Promise<readonly Transaction[]>;
  update(input: UpdateTransactionInput): Promise<Result<Transaction, DomainError>>;
}
