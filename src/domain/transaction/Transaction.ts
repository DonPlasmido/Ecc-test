import type { AccountId } from '@/domain/account/Account';
import type { CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import type { Money } from '@/domain/money/Money';
import type { RuleId } from '@/domain/rule/Rule';
import type { Brand } from '@/domain/shared/brand';
import type { DedupKey } from '@/domain/transaction/DedupKey';

/** Identificador de movimiento. */
export type TransactionId = Brand<string, 'TransactionId'>;

/** Origen de la categoría asignada; `'manual'` nunca la pisa una regla. */
export type CategorySource = 'none' | 'rule' | 'manual';

/** Movimiento bancario persistido. */
export interface Transaction {
  readonly id: TransactionId;
  readonly accountId: AccountId;
  /** Fecha de operación. */
  readonly date: IsoDate;
  readonly valueDate: IsoDate | null;
  /** Negativo = gasto. */
  readonly amount: Money;
  /** "Saldo" del extracto, si existe. */
  readonly balance: Money | null;
  /** Inmutable, tal cual del banco. */
  readonly rawDescription: string;
  /** Editable por el usuario. */
  readonly description: string;
  /** `normalizeText(rawDescription)`: base de reglas, búsqueda y dedup. */
  readonly normalizedDescription: string;
  readonly categoryId: CategoryId;
  readonly categorySource: CategorySource;
  readonly ruleId: RuleId | null;
  readonly note: string;
  readonly dedupKey: DedupKey;
  readonly importBatchId: ImportBatchId;
  /** ISO datetime. */
  readonly createdAt: string;
  /** ISO datetime. */
  readonly updatedAt: string;
}

/** Fila normalizada de un extracto, aún sin id, dedup ni categoría. */
export interface TransactionDraft {
  readonly accountId: AccountId;
  readonly date: IsoDate;
  readonly valueDate: IsoDate | null;
  readonly amount: Money;
  readonly balance: Money | null;
  readonly rawDescription: string;
  readonly normalizedDescription: string;
  /** Línea 1-based del archivo de origen (para mensajes y vista previa). */
  readonly sourceLine: number;
}

// TODO(domain): funciones puras en este archivo (devuelven copia nueva).
// export function recategorize(tx: Transaction, categoryId: CategoryId,
//   source: CategorySource, ruleId: RuleId | null, now: string): Transaction;
// export function withDescription(tx: Transaction, description: string, now: string): Transaction;
// export function withNote(tx: Transaction, note: string, now: string): Transaction;
