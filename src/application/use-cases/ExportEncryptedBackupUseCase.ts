import type { AppSettings } from '@/application/backup/BackupSnapshot';
import {
  BACKUP_FILE_EXTENSION,
  MIN_BACKUP_PASSWORD_LENGTH,
  type EncryptedBackupFile,
  type ExportBackupInput,
  type ExportEncryptedBackup,
} from '@/application/ports/inbound/ExportEncryptedBackup';
import type { BackupCipherPort } from '@/application/ports/outbound/BackupCipherPort';
import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { DataSnapshotPort } from '@/application/ports/outbound/DataSnapshotPort';
import type { SettingsRepository } from '@/application/ports/outbound/SettingsRepository';
import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { err, ok, type Result } from '@/domain/shared/Result';

const DEFAULT_SETTINGS: AppSettings = { locale: 'es', theme: 'system' };

export interface ExportEncryptedBackupDeps {
  readonly snapshot: DataSnapshotPort;
  readonly cipher: BackupCipherPort;
  readonly clock: ClockPort;
  readonly settings: SettingsRepository;
}

/** Exporta todos los datos como JSON cifrado con contraseña y anota `lastBackupAt`. */
export class ExportEncryptedBackupUseCase implements ExportEncryptedBackup {
  constructor(private readonly deps: ExportEncryptedBackupDeps) {}

  async execute(input: ExportBackupInput): Promise<Result<EncryptedBackupFile, DomainError>> {
    if (input.password.length < MIN_BACKUP_PASSWORD_LENGTH) {
      return err(domainError('backup.weakPassword', { expected: MIN_BACKUP_PASSWORD_LENGTH }));
    }
    const { snapshot, cipher, clock, settings } = this.deps;
    const data = await snapshot.exportAll();
    const bytes = await cipher.encrypt(new TextEncoder().encode(JSON.stringify(data)), input.password);
    const current = (await settings.get()) ?? DEFAULT_SETTINGS;
    await settings.save({ ...current, lastBackupAt: clock.now() });
    return ok({ fileName: `cuentas-claras-${clock.today()}${BACKUP_FILE_EXTENSION}`, bytes });
  }
}
