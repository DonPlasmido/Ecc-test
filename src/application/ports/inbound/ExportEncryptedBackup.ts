import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';

/** Longitud mínima de la contraseña de la copia (no hay recuperación). */
export const MIN_BACKUP_PASSWORD_LENGTH = 12;

/** Extensión del archivo de copia cifrada. */
export const BACKUP_FILE_EXTENSION = '.ccbackup';

/** Entrada de la exportación. La contraseña nunca se guarda ni se registra. */
export interface ExportBackupInput {
  readonly password: string;
}

/** Archivo cifrado listo para descargar. */
export interface EncryptedBackupFile {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/** Exporta todos los datos en una copia cifrada con contraseña. */
export interface ExportEncryptedBackup {
  execute(input: ExportBackupInput): Promise<Result<EncryptedBackupFile, DomainError>>;
}
