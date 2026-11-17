import type { ImportBatchRepository } from '@/application/ports/outbound/ImportBatchRepository';
import type { ImportBatch } from '@/domain/import/ImportBatch';
import { compareKeys, copy, type InMemoryState } from './InMemoryState';

/** Fake en memoria de `ImportBatchRepository` (orden: `importedAt`, luego `id`). */
export class InMemoryImportBatchRepository implements ImportBatchRepository {
  constructor(private readonly state: InMemoryState) {}

  list(): Promise<readonly ImportBatch[]> {
    const sorted = [...this.state.importBatches.values()].sort(
      (a, b) => compareKeys(a.importedAt, b.importedAt) || compareKeys(a.id, b.id),
    );
    return Promise.resolve(sorted.map(copy));
  }
}
