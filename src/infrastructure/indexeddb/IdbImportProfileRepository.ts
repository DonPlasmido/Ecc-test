import type { ImportProfileRepository } from '@/application/ports/outbound/ImportProfileRepository';
import type { ImportProfile } from '@/domain/import/ImportProfile';
import type { CuentasClarasDatabase } from './schema';

/** Perfiles de importación por firma de cabecera. */
export class IdbImportProfileRepository implements ImportProfileRepository {
  constructor(private readonly db: CuentasClarasDatabase) {}

  async find(headerSignature: string): Promise<ImportProfile | null> {
    return (await this.db.get('importProfiles', headerSignature)) ?? null;
  }

  async save(profile: ImportProfile): Promise<void> {
    await this.db.put('importProfiles', profile);
  }
}
