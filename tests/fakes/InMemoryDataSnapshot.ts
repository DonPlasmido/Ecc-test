import { BACKUP_FORMAT_VERSION, type BackupSnapshot } from '@/application/backup/BackupSnapshot';
import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { DataSnapshotPort } from '@/application/ports/outbound/DataSnapshotPort';
import { compareKeys, copy, createInMemoryState, valuesByKey, type InMemoryState } from './InMemoryState';

const SCHEMA_VERSION = 1;
const systemClock: Pick<ClockPort, 'now'> = { now: () => new Date().toISOString() };

function indexBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T> {
  return new Map(items.map((item) => [key(item), copy(item)]));
}

/** Fake en memoria de `DataSnapshotPort`: replaceAll valida y solo entonces sustituye el estado. */
export class InMemoryDataSnapshot implements DataSnapshotPort {
  constructor(
    private readonly state: InMemoryState,
    private readonly clock: Pick<ClockPort, 'now'> = systemClock,
  ) {}

  exportAll(): Promise<BackupSnapshot> {
    const s = this.state;
    const byPriority = [...s.rules.values()].sort((a, b) => compareKeys(a.priority, b.priority) || compareKeys(a.id, b.id));
    const byImportedAt = [...s.importBatches.values()].sort(
      (a, b) => compareKeys(a.importedAt, b.importedAt) || compareKeys(a.id, b.id),
    );
    return Promise.resolve({
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: this.clock.now(),
      settings: s.settings ? copy(s.settings) : null,
      accounts: valuesByKey(s.accounts),
      categories: valuesByKey(s.categories),
      rules: copy(byPriority),
      budgets: valuesByKey(s.budgets),
      importBatches: copy(byImportedAt),
      importProfiles: valuesByKey(s.importProfiles),
      transactions: valuesByKey(s.transactions),
    });
  }

  replaceAll(snapshot: BackupSnapshot): Promise<void> {
    const next = createInMemoryState();
    next.transactions = indexBy(snapshot.transactions, (t) => t.id);
    const keys = new Set<string>();
    for (const t of next.transactions.values()) {
      if (keys.has(t.dedupKey)) return Promise.reject(new Error(`duplicate dedupKey: ${t.dedupKey}`));
      keys.add(t.dedupKey);
    }
    next.accounts = indexBy(snapshot.accounts, (a) => a.id);
    next.categories = indexBy(snapshot.categories, (c) => c.id);
    next.rules = indexBy(snapshot.rules, (r) => r.id);
    next.budgets = indexBy(snapshot.budgets, (b) => b.id);
    next.importBatches = indexBy(snapshot.importBatches, (b) => b.id);
    next.importProfiles = indexBy(snapshot.importProfiles, (p) => p.headerSignature);
    next.settings = snapshot.settings ? copy(snapshot.settings) : null;
    Object.assign(this.state, next);
    return Promise.resolve();
  }
}
