import type { DataChange } from '@/application/ports/outbound/DataChange';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import type { TransactionIndex } from '@/application/read-model/TransactionIndex';
import type { WritableTransactionIndexStore } from '@/application/read-model/TransactionIndexStore';
import { domainError } from '@/domain/shared/DomainError';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';

/**
 * Mantiene el índice en memoria alineado con el repositorio. Las escrituras de los casos de uso avisan
 * con `notifyDataChanged` (sin detalle), así que se reconcilia: upsert de todo lo que hay y borrado de lo
 * que ya no existe. Las pasadas se serializan y las avisadas durante una pasada se agrupan en una más.
 */
/** Esperas entre reintentos de una reconciliación fallida (IndexedDB abortada, otra pestaña…). */
const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [200, 1000, 3000];

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class IndexSync {
  private readonly known = new Set<string>();
  private running: Promise<void> = Promise.resolve();
  private pending = false;
  /** Hay avisos sin detalle pendientes: hace falta una reconciliación completa. */
  private pendingFull = false;
  private pendingUpserts: Transaction[] = [];
  private active = false;

  constructor(
    private readonly repository: TransactionRepository,
    private readonly index: TransactionIndex,
    private readonly store: WritableTransactionIndexStore,
    private readonly retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
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
    } catch (error: unknown) {
      this.fail('hydrate', error);
      // Reintento en segundo plano: si va bien, el store vuelve a 'ready'.
      this.notifyDataChanged();
    }
  }

  /**
   * Callback para `onDataChanged`. Con `change.upserted` solo se aplican esos movimientos al índice (sin
   * recorrer el repositorio); sin detalle se programa una reconciliación completa.
   */
  readonly notifyDataChanged = (change?: DataChange): void => {
    if (change === undefined) this.pendingFull = true;
    else for (const tx of change.upserted) this.pendingUpserts.push(tx);
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
        if (this.pendingFull) {
          this.pendingFull = false;
          this.pendingUpserts = [];
          await this.reconcileWithRetry();
        } else {
          this.applyPendingUpserts();
        }
      }
    } finally {
      this.active = false;
    }
  }

  /**
   * Una pasada con reintentos acotados. Una pasada correcta recalcula los borrados contra el conjunto
   * completo (`known` solo se actualiza al terminar bien), así que corrige cualquier pasada parcial previa.
   */
  private async reconcileWithRetry(): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        await this.reconcile(() => undefined);
        if (this.store.getSnapshot().hydration.status !== 'ready') this.store.setHydration({ status: 'ready' });
        return;
      } catch (error: unknown) {
        this.fail('reconcile', error);
        const delay = this.retryDelaysMs[attempt];
        if (delay === undefined) return;
        await wait(delay);
      }
    }
  }

  /** Camino incremental: los movimientos ya están persistidos; el índice solo se pone al día con ellos. */
  private applyPendingUpserts(): void {
    const upserts = this.pendingUpserts;
    this.pendingUpserts = [];
    if (upserts.length === 0) return;
    this.index.applyUpserts(upserts);
    for (const tx of upserts) this.known.add(tx.id);
  }

  private fail(phase: 'hydrate' | 'reconcile', error: unknown): void {
    console.error(`IndexSync ${phase} failed`, error);
    this.store.setHydration({ status: 'failed', error: domainError('storage.unavailable') });
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
