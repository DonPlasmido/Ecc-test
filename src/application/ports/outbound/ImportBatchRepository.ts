import type { ImportBatch } from '@/domain/import/ImportBatch';

export type { ImportBatch } from '@/domain/import/ImportBatch';

/** Lectura de lotes de importación (la escritura va en `TransactionRepository.insertImport`). */
export interface ImportBatchRepository {
  list(): Promise<readonly ImportBatch[]>;
}
