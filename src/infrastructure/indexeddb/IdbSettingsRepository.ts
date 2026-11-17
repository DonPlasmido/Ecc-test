import type { AppSettings } from '@/application/backup/BackupSnapshot';
import type { SettingsRepository } from '@/application/ports/outbound/SettingsRepository';
import { META_SETTINGS_KEY, type CuentasClarasDatabase } from './schema';

/** Ajustes de la app en la store `meta` (misma clave que lee y reemplaza `IdbDataSnapshot`). */
export class IdbSettingsRepository implements SettingsRepository {
  constructor(private readonly db: CuentasClarasDatabase) {}

  async get(): Promise<AppSettings | null> {
    const record = await this.db.get('meta', META_SETTINGS_KEY);
    return (record?.value as AppSettings | undefined) ?? null;
  }

  async save(settings: AppSettings): Promise<void> {
    await this.db.put('meta', { key: META_SETTINGS_KEY, value: settings });
  }
}
