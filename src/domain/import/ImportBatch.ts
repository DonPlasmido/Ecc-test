import type { AccountId } from '@/domain/account/Account';
import type { Brand } from '@/domain/shared/brand';
import type { ColumnMapping } from '@/domain/import/ColumnMapping';

/** Identificador de lote de importación. */
export type ImportBatchId = Brand<string, 'ImportBatchId'>;

/** Registro de una importación confirmada (permite deshacerla). */
export interface ImportBatch {
  readonly id: ImportBatchId;
  readonly accountId: AccountId;
  readonly fileName: string;
  /** ISO datetime. */
  readonly importedAt: string;
  readonly rowCount: number;
  readonly inserted: number;
  readonly duplicates: number;
  readonly mapping: ColumnMapping;
}
