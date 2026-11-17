import type { TransactionDraft } from '@/domain/transaction/Transaction';
import type { RowError } from '@/domain/import/RowError';

/** Filas iniciales en las que se busca la cabecera. */
export const HEADER_SEARCH_ROWS = 20;

/** Papel asignado a cada columna del extracto. */
export type ColumnRole =
  | 'date'
  | 'valueDate'
  | 'description'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'balance'
  | 'ignore';

/** Convención de importe: una columna con signo o columnas Debe/Haber. */
export type AmountConvention = 'signed' | 'debitCredit';

/** Mapeo de columnas de un extracto. */
export interface ColumnMapping {
  readonly headerRowIndex: number;
  /** Papel por índice de columna. */
  readonly columns: readonly ColumnRole[];
  readonly amountConvention: AmountConvention;
}

/** Resultado de la detección automática. */
export interface ColumnMappingDetection {
  readonly mapping: ColumnMapping;
  /** Confianza entre 0 y 1. */
  readonly confidence: number;
}

/** Salida de `normalizeRows`. */
export interface NormalizedRows {
  readonly drafts: readonly TransactionDraft[];
  readonly rowErrors: readonly RowError[];
}

// TODO(domain): un archivo por función, según docs/architecture.md §4 y §5.3.
// detectHeaderRow.ts:     export function detectHeaderRow(table: RawTable): number;
// detectColumnMapping.ts: export function detectColumnMapping(table: RawTable): ColumnMappingDetection;
//                         export function validateMapping(m: ColumnMapping): Result<ColumnMapping, DomainError>;
//                         export function headerSignature(headers: readonly string[]): string;
// normalizeRows.ts:       export function normalizeRows(table: RawTable, m: ColumnMapping,
//                           accountId: AccountId): NormalizedRows;
