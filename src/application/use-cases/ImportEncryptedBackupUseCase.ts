import { migrateSnapshot } from '@/application/backup/migrateSnapshot';
import type {
  ImportBackupInput,
  ImportBackupOutput,
  ImportEncryptedBackup,
} from '@/application/ports/inbound/ImportEncryptedBackup';
import type { BackupCipherPort } from '@/application/ports/outbound/BackupCipherPort';
import type { DataSnapshotPort } from '@/application/ports/outbound/DataSnapshotPort';
import { quotaErrorOrRethrow } from '@/application/use-cases/storageErrors';
import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { err, ok, type Result } from '@/domain/shared/Result';

export interface ImportEncryptedBackupDeps {
  readonly snapshot: DataSnapshotPort;
  readonly cipher: BackupCipherPort;
  readonly onDataChanged?: () => void;
}

function parseJson(bytes: Uint8Array): Result<unknown, DomainError> {
  try {
    return ok(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown);
  } catch {
    return err(domainError('backup.invalidSnapshot'));
  }
}

/** Descifra, valida y reemplaza todos los datos; ante cualquier fallo previo no escribe nada. */
export class ImportEncryptedBackupUseCase implements ImportEncryptedBackup {
  constructor(private readonly deps: ImportEncryptedBackupDeps) {}

  async execute(input: ImportBackupInput): Promise<Result<ImportBackupOutput, DomainError>> {
    const decrypted = await this.deps.cipher.decrypt(input.bytes, input.password);
    if (!decrypted.ok) return decrypted;
    const json = parseJson(decrypted.value);
    if (!json.ok) return json;
    const migrated = migrateSnapshot(json.value);
    if (!migrated.ok) return migrated;
    try {
      await this.deps.snapshot.replaceAll(migrated.value);
    } catch (error) {
      return quotaErrorOrRethrow(error);
    }
    this.deps.onDataChanged?.();
    return ok({ transactions: migrated.value.transactions.length, exportedAt: migrated.value.exportedAt });
  }
}
