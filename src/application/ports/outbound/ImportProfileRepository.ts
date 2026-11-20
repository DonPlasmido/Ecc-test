import type { ImportProfile } from '@/domain/import/ImportProfile';

export type { ImportProfile } from '@/domain/import/ImportProfile';

/** Mapeos de columnas recordados por firma de cabecera. */
export interface ImportProfileRepository {
  find(headerSignature: string): Promise<ImportProfile | null>;
  /** Alta o reemplazo por `headerSignature`. */
  save(profile: ImportProfile): Promise<void>;
}
