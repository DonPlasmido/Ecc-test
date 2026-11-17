import type { AppSettings } from '@/application/backup/BackupSnapshot';
import type { SettingsRepository } from '@/application/ports/outbound/SettingsRepository';
import { copy, type InMemoryState } from './InMemoryState';

/** Fake en memoria de `SettingsRepository` (comparte `state.settings` con el snapshot). */
export class InMemorySettingsRepository implements SettingsRepository {
  constructor(private readonly state: InMemoryState) {}

  get(): Promise<AppSettings | null> {
    return Promise.resolve(this.state.settings ? copy(this.state.settings) : null);
  }

  save(settings: AppSettings): Promise<void> {
    this.state.settings = copy(settings);
    return Promise.resolve();
  }
}
