import type { ImportProfileRepository } from '@/application/ports/outbound/ImportProfileRepository';
import type { ImportProfile } from '@/domain/import/ImportProfile';
import { copy, type InMemoryState } from './InMemoryState';

/** Fake en memoria de `ImportProfileRepository`. */
export class InMemoryImportProfileRepository implements ImportProfileRepository {
  constructor(private readonly state: InMemoryState) {}

  find(headerSignature: string): Promise<ImportProfile | null> {
    const found = this.state.importProfiles.get(headerSignature);
    return Promise.resolve(found ? copy(found) : null);
  }

  save(profile: ImportProfile): Promise<void> {
    this.state.importProfiles.set(profile.headerSignature, copy(profile));
    return Promise.resolve();
  }
}
