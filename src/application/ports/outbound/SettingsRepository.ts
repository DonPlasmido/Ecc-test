import type { AppSettings } from '@/application/backup/BackupSnapshot';

/** Ajustes de la aplicación (store `meta`). */
export interface SettingsRepository {
  get(): Promise<AppSettings | null>;
  save(settings: AppSettings): Promise<void>;
}
