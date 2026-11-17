import type { AccountId } from '@/domain/account/Account';
import type { ColumnMapping } from '@/domain/import/ColumnMapping';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import type { RawTable } from '@/domain/import/RawTable';
import type { RowError } from '@/domain/import/RowError';
import type { StatementFile } from '@/domain/import/StatementFile';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';

/** Filas de la tabla cruda que se envían a la UI en la vista previa. */
export const IMPORT_PREVIEW_ROWS = 50;

/** Vista previa de un extracto parseado (no escribe nada). */
export interface ImportPreview {
  /** Referencia a la tabla completa retenida en memoria. */
  readonly previewId: string;
  /** Primeras `IMPORT_PREVIEW_ROWS` filas. */
  readonly table: RawTable;
  readonly suggestedMapping: ColumnMapping;
  readonly confidence: number;
  /** `true` si el mapeo vino de un `ImportProfile`. */
  readonly rememberedMapping: boolean;
}

/** Entrada de la confirmación de importación. */
export interface CommitImportInput {
  readonly previewId: string;
  readonly accountId: AccountId;
  readonly mapping: ColumnMapping;
}

/** Resumen de una importación confirmada. */
export interface ImportResult {
  readonly batchId: ImportBatchId;
  readonly inserted: number;
  readonly duplicates: number;
  readonly autoCategorized: number;
  readonly rowErrors: readonly RowError[];
}

/** Importar extracto en dos pasos: vista previa y confirmación. */
export interface ImportStatement {
  preview(file: StatementFile): Promise<Result<ImportPreview, DomainError>>;
  commit(input: CommitImportInput): Promise<Result<ImportResult, DomainError>>;
}
