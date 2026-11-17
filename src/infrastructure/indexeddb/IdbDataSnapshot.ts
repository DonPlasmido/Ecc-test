import { BACKUP_FORMAT_VERSION, type AppSettings, type BackupSnapshot } from '@/application/backup/BackupSnapshot';
import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { DataSnapshotPort } from '@/application/ports/outbound/DataSnapshotPort';
import { budgetFromRecord, budgetToRecord, transactionFromRecord, transactionToRecord } from './mappers';
import { DB_VERSION, META_SETTINGS_KEY, type CuentasClarasDatabase } from './schema';

const DATA_STORES = [
  'transactions',
  'accounts',
  'categories',
  'rules',
  'budgets',
  'importBatches',
  'importProfiles',
] as const;

const systemClock: Pick<ClockPort, 'now'> = { now: () => new Date().toISOString() };

/** Exportación y reemplazo atómicos de todos los datos. */
export class IdbDataSnapshot implements DataSnapshotPort {
  constructor(
    private readonly db: CuentasClarasDatabase,
    private readonly clock: Pick<ClockPort, 'now'> = systemClock,
  ) {}

  async exportAll(): Promise<BackupSnapshot> {
    const tx = this.db.transaction([...DATA_STORES, 'meta'], 'readonly');
    const transactions = await tx.objectStore('transactions').getAll();
    const accounts = await tx.objectStore('accounts').getAll();
    const categories = await tx.objectStore('categories').getAll();
    const rules = await tx.objectStore('rules').index('byPriority').getAll();
    const budgets = await tx.objectStore('budgets').getAll();
    const importBatches = await tx.objectStore('importBatches').index('byImportedAt').getAll();
    const importProfiles = await tx.objectStore('importProfiles').getAll();
    const settings = await tx.objectStore('meta').get(META_SETTINGS_KEY);
    await tx.done;
    return {
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: DB_VERSION,
      exportedAt: this.clock.now(),
      settings: (settings?.value as AppSettings | undefined) ?? null,
      accounts,
      categories,
      rules,
      budgets: budgets.map(budgetFromRecord),
      importBatches,
      importProfiles,
      transactions: transactions.map(transactionFromRecord),
    };
  }

  async replaceAll(snapshot: BackupSnapshot): Promise<void> {
    const tx = this.db.transaction([...DATA_STORES, 'meta'], 'readwrite');
    const writes: Promise<unknown>[] = DATA_STORES.map((name) => tx.objectStore(name).clear());
    writes.push(tx.objectStore('meta').delete(META_SETTINGS_KEY));
    for (const t of snapshot.transactions) writes.push(tx.objectStore('transactions').put(transactionToRecord(t)));
    for (const a of snapshot.accounts) writes.push(tx.objectStore('accounts').put(a));
    for (const c of snapshot.categories) writes.push(tx.objectStore('categories').put(c));
    for (const r of snapshot.rules) writes.push(tx.objectStore('rules').put(r));
    for (const b of snapshot.budgets) writes.push(tx.objectStore('budgets').put(budgetToRecord(b)));
    for (const b of snapshot.importBatches) writes.push(tx.objectStore('importBatches').put(b));
    for (const p of snapshot.importProfiles) writes.push(tx.objectStore('importProfiles').put(p));
    if (snapshot.settings) writes.push(tx.objectStore('meta').put({ key: META_SETTINGS_KEY, value: snapshot.settings }));
    try {
      await Promise.all([...writes, tx.done]);
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // ya abortada
      }
      throw error;
    }
  }
}
