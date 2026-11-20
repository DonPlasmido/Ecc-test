import type { BackupSnapshot } from '@/application/backup/BackupSnapshot';

/** Exportación y reemplazo atómicos de todos los datos. */
export interface DataSnapshotPort {
  /** Lectura consistente (una transacción readonly). */
  exportAll(): Promise<BackupSnapshot>;
  /** Clear + put en una única transacción readwrite. */
  replaceAll(snapshot: BackupSnapshot): Promise<void>;
}
