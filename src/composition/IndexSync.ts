import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import type { TransactionIndex } from '@/application/read-model/TransactionIndex';
import type { WritableTransactionIndexStore } from '@/application/read-model/TransactionIndexStore';
import { domainError } from '@/domain/shared/DomainError';
import type { TransactionId } from '@/domain/transaction/Transaction';

/**
 * Mantiene el índice en memoria alineado con el repositorio. Las escrituras de los casos de uso avisan
 * con `notifyDataChanged` (sin detalle), así que se reconcilia: upsert de todo lo que hay y borrado de lo
 * que ya no existe. Las pasadas se serializan y las avisadas durante una pasada se agrupan en una más.
 */
export class IndexSync {
  private readonly known = new Set<string>();
  private running: Promise<void> = Promise.resolve();
  private pending = false;
  private active = false;

  constructor(
    private readonly repository: TransactionRepository,
    private readonly index: TransactionIndex,
    private readonly store: WritableTransactionIndexStore,
  ) {}

  /** Hidratación inicial con progreso en el store. */
  async hydrate(): Promise<void> {
    let loaded = 0;
    this.store.setHydration({ status: 'hydrating', loaded });
    try {
      await this.reconcile((count) => {
        loaded += count;
        this.store.setHydration({ status: 'hydrating', loaded });
      });
      this.store.setHydration({ status: 'ready' });
    } catch {
      this.store.setHydration({ status: 'failed', error: domainError('storage.unavailable') });
    }
  }

  /** Callback para `onDataChanged`: programa una reconciliación. */
  readonly notifyDataChanged = (): void => {
    this.pending = true;
    if (this.active) return;
    this.active = true;
    this.running = this.drain();
  };

  /** Resuelve cuando no queda ninguna reconciliación pendiente. */
  async whenIdle(): Promise<void> {
    while (this.active) await this.running;
  }

  private async drain(): Promise<void> {
    try {
      while (this.pending) {
        this.pending = false;
        try {
          await this.reconcile(() => undefined);
        } catch {
          this.store.setHydration({ status: 'failed', error: domainError('storage.unavailable') });
        }
      }
    } finally {
      this.active = false;
    }
  }

  private async reconcile(onBatch: (count: number) => void): Promise<void> {
    const seen = new Set<string>();
    await this.repository.scan((batch) => {
      this.index.applyUpserts(batch);
      for (const tx of batch) seen.add(tx.id);
      onBatch(batch.length);
    });
    const removed = [...this.known].filter((id) => !seen.has(id));
    if (removed.length > 0) this.index.applyDeletes(removed as TransactionId[]);
    this.known.clear();
    for (const id of seen) this.known.add(id);
  }
}
