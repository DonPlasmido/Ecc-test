import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_FORMAT_VERSION, type BackupSnapshot } from '@/application/backup/BackupSnapshot';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import { makeAccount, makeBatch, makeBudget, makeCategory, makeProfile, makeRule, makeTransaction } from '../fixtures';
import { EXPORTED_AT, type World, type WorldFactory } from './worlds';

function fullSnapshot(): BackupSnapshot {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: 1,
    exportedAt: EXPORTED_AT,
    settings: { locale: 'es', theme: 'dark' },
    accounts: [makeAccount('a1')],
    categories: [makeCategory('c1')],
    rules: [makeRule('r1', 1)],
    budgets: [makeBudget('b1', 'c1')],
    importBatches: [makeBatch()],
    importProfiles: [makeProfile('sig')],
    transactions: [makeTransaction(0), makeTransaction(1)],
  };
}

export function dataSnapshotContract(label: string, create: WorldFactory): void {
  describe(`DataSnapshotPort contract (${label})`, () => {
    let world: World;
    beforeEach(async () => {
      world = await create();
    });
    afterEach(() => world.dispose());

    it('exports an empty snapshot with version metadata', async () => {
      expect(await world.snapshot.exportAll()).toEqual({
        formatVersion: BACKUP_FORMAT_VERSION,
        schemaVersion: 1,
        exportedAt: EXPORTED_AT,
        settings: null,
        accounts: [],
        categories: [],
        rules: [],
        budgets: [],
        importBatches: [],
        importProfiles: [],
        transactions: [],
      });
    });

    it('round-trips a full snapshot', async () => {
      await world.snapshot.replaceAll(fullSnapshot());
      expect(await world.snapshot.exportAll()).toEqual(fullSnapshot());
    });

    it('makes the restored data visible through the repositories', async () => {
      await world.snapshot.replaceAll(fullSnapshot());
      expect(await world.accounts.list()).toEqual(fullSnapshot().accounts);
      expect(await world.budgets.list()).toEqual(fullSnapshot().budgets);
      expect(await world.transactions.scan(() => undefined)).toBe(2);
      expect(await world.importProfiles.find('sig')).not.toBeNull();
    });

    it('replaces previous data instead of merging', async () => {
      await world.accounts.save(makeAccount('old'));
      await world.transactions.insertImport(makeBatch({ id: 'old-batch' as never }), [makeTransaction(50)]);
      await world.snapshot.replaceAll(fullSnapshot());
      const exported = await world.snapshot.exportAll();
      expect(exported.accounts.map((a) => a.id)).toEqual(['a1']);
      expect(exported.transactions.map((t) => t.id)).toEqual(['tx-0000000', 'tx-0000001']);
      expect(exported.importBatches.map((b) => b.id)).toEqual(['batch-1']);
    });

    it('clears the settings when the snapshot has none', async () => {
      await world.snapshot.replaceAll(fullSnapshot());
      await world.snapshot.replaceAll({ ...fullSnapshot(), settings: null });
      expect((await world.snapshot.exportAll()).settings).toBeNull();
    });

    it('restores an empty snapshot, wiping everything', async () => {
      await world.snapshot.replaceAll(fullSnapshot());
      await world.snapshot.replaceAll({ ...fullSnapshot(), settings: null, accounts: [], categories: [], rules: [], budgets: [], importBatches: [], importProfiles: [], transactions: [] });
      expect((await world.snapshot.exportAll()).transactions).toEqual([]);
    });

    it('is atomic: an invalid snapshot leaves the previous data intact', async () => {
      await world.snapshot.replaceAll(fullSnapshot());
      const clash = makeTransaction(9, { dedupKey: makeTransaction(0).dedupKey });
      const bad = { ...fullSnapshot(), accounts: [makeAccount('zzz')], transactions: [makeTransaction(0), clash] };
      await expect(world.snapshot.replaceAll(bad)).rejects.toThrow();
      expect(await world.snapshot.exportAll()).toEqual(fullSnapshot());
    });

    it('accepts transactions whose dedup keys differ only by occurrence', async () => {
      const base = makeTransaction(0);
      const twin = makeTransaction(1, { dedupKey: base.dedupKey.replace('#0', '#1') as DedupKey });
      await world.snapshot.replaceAll({ ...fullSnapshot(), transactions: [base, twin] });
      expect((await world.snapshot.exportAll()).transactions).toHaveLength(2);
    });
  });
}
