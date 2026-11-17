import type { ImportBatch, ImportBatchId } from '@/domain/import/ImportBatch';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';

/** Tamaño de lote por defecto de `scan` (hidratación del índice). */
export const DEFAULT_SCAN_BATCH_SIZE = 5_000;

/** Persistencia de movimientos. */
export interface TransactionRepository {
  /** Conserva el orden pedido; omite ids inexistentes. */
  getByIds(ids: readonly TransactionId[]): Promise<readonly Transaction[]>;
  /** Recorre todo por lotes; resuelve con el total leído. */
  scan(onBatch: (batch: readonly Transaction[]) => void, batchSize?: number): Promise<number>;
  /** Subconjunto de `keys` que ya existe (consulta en lote). */
  existingDedupKeys(keys: readonly DedupKey[]): Promise<ReadonlySet<DedupKey>>;
  /** Inserta movimientos y registra el lote en UNA transacción (todo o nada). */
  insertImport(batch: ImportBatch, txs: readonly Transaction[]): Promise<void>;
  updateMany(txs: readonly Transaction[]): Promise<void>;
  /** Deshace una importación; devuelve los ids borrados. */
  deleteByImportBatch(batchId: ImportBatchId): Promise<readonly TransactionId[]>;
}
