import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppSettings } from '@/application/backup/BackupSnapshot';
import type { SettingsRepository } from '@/application/ports/outbound/SettingsRepository';
import { IdbDataSnapshot } from '@/infrastructure/indexeddb/IdbDataSnapshot';
import { IdbSettingsRepository } from '@/infrastructure/indexeddb/IdbSettingsRepository';
import { openDatabase } from '@/infrastructure/indexeddb/openDatabase';
import { InMemorySettingsRepository } from '../../fakes/InMemorySettingsRepository';
import { createInMemoryState } from '../../fakes/InMemoryState';
import { uniqueDbName } from './fixtures';

interface SettingsWorld {
  readonly settings: SettingsRepository;
  dispose(): void;
}

const factories: ReadonlyArray<readonly [string, () => Promise<SettingsWorld>]> = [
  [
    'IndexedDB',
    async () => {
      const db = await openDatabase(uniqueDbName());
      return { settings: new IdbSettingsRepository(db), dispose: () => db.close() };
    },
  ],
  [
    'in-memory fake',
    () => Promise.resolve({ settings: new InMemorySettingsRepository(createInMemoryState()), dispose: () => undefined }),
  ],
];

const DARK: AppSettings = { locale: 'en', theme: 'dark', lastBackupAt: '2026-01-02T03:04:05.000Z' };

for (const [label, create] of factories) {
  describe(`SettingsRepository contract (${label})`, () => {
    let world: SettingsWorld;
    beforeEach(async () => {
      world = await create();
    });
    afterEach(() => world.dispose());

    it('returns null when nothing has been saved', async () => {
      expect(await world.settings.get()).toBeNull();
    });

    it('round-trips saved settings', async () => {
      await world.settings.save(DARK);
      expect(await world.settings.get()).toEqual(DARK);
    });

    it('replaces previous settings on save', async () => {
      await world.settings.save(DARK);
      await world.settings.save({ locale: 'es', theme: 'light' });
      expect(await world.settings.get()).toEqual({ locale: 'es', theme: 'light' });
    });

    it('returns copies, not shared references', async () => {
      await world.settings.save(DARK);
      const first = (await world.settings.get()) as { locale: string };
      first.locale = 'mutated';
      expect((await world.settings.get())?.locale).toBe('en');
    });
  });
}

describe('IdbSettingsRepository with IdbDataSnapshot', () => {
  it('exports saved settings in the snapshot and keeps them after replaceAll', async () => {
    const db = await openDatabase(uniqueDbName());
    const repo = new IdbSettingsRepository(db);
    const snapshot = new IdbDataSnapshot(db, { now: () => '2026-01-01T00:00:00.000Z' });
    await repo.save(DARK);
    const exported = await snapshot.exportAll();
    expect(exported.settings).toEqual(DARK);
    await snapshot.replaceAll({ ...exported, settings: { locale: 'es', theme: 'system' } });
    expect(await repo.get()).toEqual({ locale: 'es', theme: 'system' });
    db.close();
  });
});
