import { describe, expect, it } from 'vitest';
import { IdbTransactionRepository } from '@/infrastructure/indexeddb/IdbTransactionRepository';
import { openDatabase } from '@/infrastructure/indexeddb/openDatabase';
import type { Transaction } from '@/domain/transaction/Transaction';
import { makeBatch, makeTransaction, uniqueDbName } from './fixtures';

const COUNT = 100_000;

/** Solo registra tiempos (fake-indexeddb en Node); nunca falla por duración. */
describe('performance with 100,000 transactions (informational)', () => {
  it('inserts and fully scans 100k rows', async () => {
    const db = await openDatabase(uniqueDbName());
    const repo = new IdbTransactionRepository(db);
    const txs: Transaction[] = Array.from({ length: COUNT }, (_, i) => makeTransaction(i));

    const insertStart = performance.now();
    await repo.insertImport(makeBatch({ rowCount: COUNT, inserted: COUNT }), txs);
    const insertMs = performance.now() - insertStart;

    let blocks = 0;
    const scanStart = performance.now();
    const total = await repo.scan(() => {
      blocks += 1;
    });
    const scanMs = performance.now() - scanStart;

    const keysStart = performance.now();
    const found = await repo.existingDedupKeys(txs.slice(0, 5_000).map((t) => t.dedupKey));
    const keysMs = performance.now() - keysStart;

    console.warn(
      `[perf] insert ${COUNT}: ${insertMs.toFixed(0)} ms | scan: ${scanMs.toFixed(0)} ms (${blocks} blocks) | existingDedupKeys(5000): ${keysMs.toFixed(0)} ms`,
    );
    expect(total).toBe(COUNT);
    expect(found.size).toBe(5_000);
    db.close();
  }, 600_000);
});
