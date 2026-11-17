import { DEFAULT_SCAN_BATCH_SIZE, type TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import type { ImportBatch, ImportBatchId } from '@/domain/import/ImportBatch';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';
import { copy, valuesByKey, type InMemoryState } from './InMemoryState';

/** Fake en memoria de `TransactionRepository`, con la misma atomicidad y restricciones que IndexedDB. */
export class InMemoryTransactionRepository implements TransactionRepository {
  constructor(private readonly state: InMemoryState) {}

  getByIds(ids: readonly TransactionId[]): Promise<readonly Transaction[]> {
    const found: Transaction[] = [];
    for (const id of ids) {
      const tx = this.state.transactions.get(id);
      if (tx) found.push(copy(tx));
    }
    return Promise.resolve(found);
  }

  scan(onBatch: (batch: readonly Transaction[]) => void, batchSize = DEFAULT_SCAN_BATCH_SIZE): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      return Promise.reject(new RangeError(`batchSize must be a positive integer, got ${batchSize}`));
    }
    try {
      const all = valuesByKey(this.state.transactions);
      for (let i = 0; i < all.length; i += batchSize) onBatch(all.slice(i, i + batchSize));
      return Promise.resolve(all.length);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  existingDedupKeys(keys: readonly DedupKey[]): Promise<ReadonlySet<DedupKey>> {
    const existing = new Set<string>();
    for (const tx of this.state.transactions.values()) existing.add(tx.dedupKey);
    return Promise.resolve(new Set(keys.filter((k) => existing.has(k))));
  }

  insertImport(batch: ImportBatch, txs: readonly Transaction[]): Promise<void> {
    const taken = new Set<string>();
    for (const tx of this.state.transactions.values()) taken.add(tx.dedupKey);
    const ids = new Set<string>();
    const problem = this.firstInsertProblem(batch, txs, taken, ids);
    if (problem) return Promise.reject(new Error(problem));
    this.state.importBatches.set(batch.id, copy(batch));
    for (const tx of txs) this.state.transactions.set(tx.id, copy(tx));
    return Promise.resolve();
  }

  updateMany(txs: readonly Transaction[]): Promise<void> {
    const owner = new Map<string, string>();
    for (const tx of this.state.transactions.values()) owner.set(tx.dedupKey, tx.id);
    const next = new Map<string, Transaction>();
    for (const tx of txs) next.set(tx.id, tx);
    for (const tx of next.values()) {
      const current = this.state.transactions.get(tx.id);
      if (current) owner.delete(current.dedupKey);
    }
    const claimed = new Set<string>(owner.keys());
    for (const tx of next.values()) {
      if (claimed.has(tx.dedupKey)) return Promise.reject(new Error(`dedupKey conflict: ${tx.dedupKey}`));
      claimed.add(tx.dedupKey);
    }
    for (const tx of next.values()) this.state.transactions.set(tx.id, copy(tx));
    return Promise.resolve();
  }

  deleteByImportBatch(batchId: ImportBatchId): Promise<readonly TransactionId[]> {
    const removed: TransactionId[] = [];
    for (const tx of valuesByKey(this.state.transactions)) {
      if (tx.importBatchId !== batchId) continue;
      this.state.transactions.delete(tx.id);
      removed.push(tx.id);
    }
    this.state.importBatches.delete(batchId);
    return Promise.resolve(removed);
  }

  private firstInsertProblem(
    batch: ImportBatch,
    txs: readonly Transaction[],
    takenKeys: Set<string>,
    seenIds: Set<string>,
  ): string | null {
    if (this.state.importBatches.has(batch.id)) return `duplicate batch id: ${batch.id}`;
    for (const tx of txs) {
      if (this.state.transactions.has(tx.id) || seenIds.has(tx.id)) return `duplicate transaction id: ${tx.id}`;
      if (takenKeys.has(tx.dedupKey)) return `duplicate dedupKey: ${tx.dedupKey}`;
      seenIds.add(tx.id);
      takenKeys.add(tx.dedupKey);
    }
    return null;
  }
}
