import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';

/** Entrada de la restauración. */
export interface ImportBackupInput {
  readonly bytes: Uint8Array;
  readonly password: string;
}

/** Resumen de la restauración. */
export interface ImportBackupOutput {
  readonly transactions: number;
  /** ISO datetime de la exportación original. */
  readonly exportedAt: string;
}

/** Reemplaza todos los datos en una única transacción IDB (tras confirmación en la UI). */
export interface ImportEncryptedBackup {
  execute(input: ImportBackupInput): Promise<Result<ImportBackupOutput, DomainError>>;
}
