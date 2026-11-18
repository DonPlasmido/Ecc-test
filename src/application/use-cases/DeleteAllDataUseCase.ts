import type { DeleteAllData } from '@/application/ports/inbound/DeleteAllData';
import type { DataSnapshotPort } from '@/application/ports/outbound/DataSnapshotPort';
import { quotaErrorOrRethrow } from '@/application/use-cases/storageErrors';
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories';
import type { DomainError } from '@/domain/shared/DomainError';
import { ok, type Result } from '@/domain/shared/Result';

export interface DeleteAllDataDeps {
  readonly snapshot: DataSnapshotPort;
  readonly onDataChanged?: () => void;
}

/** Vacía todas las stores con `replaceAll` (atómico) y repone las categorías por defecto. */
export class DeleteAllDataUseCase implements DeleteAllData {
  constructor(private readonly deps: DeleteAllDataDeps) {}

  async execute(): Promise<Result<void, DomainError>> {
    const { snapshot } = this.deps;
    // Se parte de la instantánea actual solo para conservar sus versiones de formato y esquema.
    const current = await snapshot.exportAll();
    try {
      await snapshot.replaceAll({
        ...current,
        settings: null,
        accounts: [],
        categories: DEFAULT_CATEGORIES,
        rules: [],
        budgets: [],
        importBatches: [],
        importProfiles: [],
        transactions: [],
      });
    } catch (error) {
      return quotaErrorOrRethrow(error);
    }
    this.deps.onDataChanged?.();
    return ok(undefined);
  }
}
