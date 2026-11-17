import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { DB_NAME, DB_VERSION } from '@/infrastructure/indexeddb/schema';
import { openDatabase } from '@/infrastructure/indexeddb/openDatabase';
import { uniqueDbName } from './fixtures';

describe('schema + openDatabase', () => {
  it('exposes the documented database name and version', () => {
    expect(DB_NAME).toBe('cuentas-claras');
    expect(DB_VERSION).toBe(1);
  });

  it('creates every store with its key path', async () => {
    const db = await openDatabase(uniqueDbName());
    const names = [...db.objectStoreNames].sort();
    expect(names).toEqual(
      ['accounts', 'budgets', 'categories', 'importBatches', 'importProfiles', 'meta', 'rules', 'transactions'].sort(),
    );
    const tx = db.transaction(['transactions', 'importProfiles', 'meta'], 'readonly');
    expect(tx.objectStore('transactions').keyPath).toBe('id');
    expect(tx.objectStore('importProfiles').keyPath).toBe('headerSignature');
    expect(tx.objectStore('meta').keyPath).toBe('key');
    db.close();
  });

  it('creates the transaction indexes, with a unique byDedupKey', async () => {
    const db = await openDatabase(uniqueDbName());
    const store = db.transaction('transactions').store;
    expect([...store.indexNames].sort()).toEqual(
      ['byAccountDate', 'byCategoryDate', 'byDate', 'byDedupKey', 'byImportBatch'].sort(),
    );
    expect(store.index('byDedupKey').unique).toBe(true);
    expect(store.index('byDate').unique).toBe(false);
    expect(store.index('byAccountDate').keyPath).toEqual(['accountId', 'date']);
    expect(store.index('byCategoryDate').keyPath).toEqual(['categoryId', 'date']);
    expect(store.index('byImportBatch').keyPath).toBe('importBatchId');
    db.close();
  });

  it('creates the secondary indexes of the catalog stores', async () => {
    const db = await openDatabase(uniqueDbName());
    const tx = db.transaction(['rules', 'budgets', 'importBatches'], 'readonly');
    expect(tx.objectStore('rules').index('byPriority').keyPath).toBe('priority');
    expect(tx.objectStore('budgets').index('byCategory').keyPath).toBe('categoryId');
    expect(tx.objectStore('importBatches').index('byImportedAt').keyPath).toBe('importedAt');
    db.close();
  });

  it('records the schema version in meta', async () => {
    const db = await openDatabase(uniqueDbName());
    expect(await db.get('meta', 'schemaVersion')).toEqual({ key: 'schemaVersion', value: DB_VERSION });
    db.close();
  });

  it('keeps data when the database is reopened', async () => {
    const name = uniqueDbName();
    const first = await openDatabase(name);
    await first.put('meta', { key: 'lastBackupAt', value: '2024-01-01T00:00:00.000Z' });
    first.close();
    const second = await openDatabase(name);
    expect((await second.get('meta', 'lastBackupAt'))?.value).toBe('2024-01-01T00:00:00.000Z');
    second.close();
  });

  it('rejects when the stored database is newer than the supported schema', async () => {
    const name = uniqueDbName();
    const newer = await openDB(name, DB_VERSION + 1);
    newer.close();
    await expect(openDatabase(name)).rejects.toThrow();
  });

  it('closes its connection when another tab requests a version change', async () => {
    const name = uniqueDbName();
    const db = await openDatabase(name);
    const upgraded = await openDB(name, DB_VERSION + 1);
    expect(() => db.transaction('meta')).toThrow();
    upgraded.close();
  });
});
