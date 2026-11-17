import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import { DEFAULT_SCAN_BATCH_SIZE } from '@/application/ports/outbound/TransactionRepository';
import type { ImportBatch, ImportBatchId } from '@/domain/import/ImportBatch';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';
import { transactionFromRecord, transactionToRecord } from './mappers';
import type { CuentasClarasDatabase } from './schema';

/** Persistencia de movimientos sobre IndexedDB (`idb`). */
export class IdbTransactionRepository implements TransactionRepository {
  constructor(private readonly db: CuentasClarasDatabase) {}

  async getByIds(ids: readonly TransactionId[]): Promise<readonly Transaction[]> {
    if (ids.length === 0) return [];
    const tx = this.db.transaction('transactions', 'readonly');
    const records = await Promise.all(ids.map((id) => tx.store.get(id)));
    await tx.done;
    const found: Transaction[] = [];
    for (const record of records) if (record) found.push(transactionFromRecord(record));
    return found;
  }

  /**
   * Lee por tramos de clave primaria (`getAll(range, n)`), más rápido que un cursor fila a fila
   * (arquitectura §8). Una sola transacción readonly: lectura consistente.
   */
  async scan(onBatch: (batch: readonly Transaction[]) => void, batchSize = DEFAULT_SCAN_BATCH_SIZE): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new RangeError(`batchSize must be a positive integer, got ${batchSize}`);
    }
    const tx = this.db.transaction('transactions', 'readonly');
    let total = 0;
    let range: IDBKeyRange | undefined;
    for (;;) {
      const records = await tx.store.getAll(range, batchSize);
      const last = records[records.length - 1];
      if (!last) break;
      onBatch(records.map(transactionFromRecord));
      total += records.length;
      if (records.length < batchSize) break;
      range = IDBKeyRange.lowerBound(last.id, true);
    }
    await tx.done;
    return total;
  }

  async existingDedupKeys(keys: readonly DedupKey[]): Promise<ReadonlySet<DedupKey>> {
    const unique = [...new Set(keys)];
    if (unique.length === 0) return new Set();
    const tx = this.db.transaction('transactions', 'readonly');
    const index = tx.store.index('byDedupKey');
    const hits = await Promise.all(unique.map((key) => index.getKey(key)));
    await tx.done;
    return new Set(unique.filter((_, i) => hits[i] !== undefined));
  }

  async insertImport(batch: ImportBatch, txs: readonly Transaction[]): Promise<void> {
    const tx = this.db.transaction(['transactions', 'importBatches'], 'readwrite');
    const transactions = tx.objectStore('transactions');
    const writes: Promise<unknown>[] = [tx.objectStore('importBatches').add(batch)];
    for (const t of txs) writes.push(transactions.add(transactionToRecord(t)));
    await this.commit(tx, writes);
  }

  async updateMany(txs: readonly Transaction[]): Promise<void> {
    if (txs.length === 0) return;
    const tx = this.db.transaction('transactions', 'readwrite');
    await this.commit(
      tx,
      txs.map((t) => tx.store.put(transactionToRecord(t))),
    );
  }

  async deleteByImportBatch(batchId: ImportBatchId): Promise<readonly TransactionId[]> {
    const tx = this.db.transaction(['transactions', 'importBatches'], 'readwrite');
    const ids = await tx.objectStore('transactions').index('byImportBatch').getAllKeys(batchId);
    const deletes: Promise<unknown>[] = ids.map((id) => tx.objectStore('transactions').delete(id));
    deletes.push(tx.objectStore('importBatches').delete(batchId));
    await this.commit(tx, deletes);
    return ids as TransactionId[];
  }

  /** Espera todas las escrituras y el cierre; ante cualquier fallo aborta (todo o nada). */
  private async commit(
    tx: { done: Promise<void>; abort(): void },
    writes: readonly Promise<unknown>[],
  ): Promise<void> {
    try {
      await Promise.all([...writes, tx.done]);
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // la transacción ya estaba abortada o terminada
      }
      throw error;
    }
  }
}
