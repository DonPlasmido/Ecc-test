import type { TransactionDraft } from '@/domain/transaction/Transaction';
import type { RowError } from '@/domain/import/RowError';
import type { RowWarning } from '@/domain/import/RowWarning';

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
  /** Avisos de filas aceptadas (no se rechazan). */
  readonly warnings: readonly RowWarning[];
}
