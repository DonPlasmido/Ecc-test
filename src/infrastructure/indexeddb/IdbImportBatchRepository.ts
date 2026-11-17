import type { ImportBatchRepository } from '@/application/ports/outbound/ImportBatchRepository';
import type { ImportBatch } from '@/domain/import/ImportBatch';
import type { CuentasClarasDatabase } from './schema';

/** Lectura de lotes de importación, ordenados por `importedAt` (y `id` en empate). */
export class IdbImportBatchRepository implements ImportBatchRepository {
  constructor(private readonly db: CuentasClarasDatabase) {}

  async list(): Promise<readonly ImportBatch[]> {
    return this.db.getAllFromIndex('importBatches', 'byImportedAt');
  }
}
