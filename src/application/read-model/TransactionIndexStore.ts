import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import type { TransactionIndex } from '@/application/read-model/TransactionIndex';
import { domainError, type DomainError } from '@/domain/shared/DomainError';

/** Estado de hidratación del índice al arrancar. */
export type IndexHydrationState =
  | { readonly status: 'idle' }
  | { readonly status: 'hydrating'; readonly loaded: number }
  | { readonly status: 'ready' }
  | { readonly status: 'failed'; readonly error: DomainError };

/** Instantánea inmutable para `useSyncExternalStore` (misma referencia si no hay cambios). */
export interface TransactionIndexSnapshot {
  readonly version: number;
  readonly size: number;
  readonly hydration: IndexHydrationState;
}

/** Observación de la versión de datos (la UI invalida cachés al cambiar). */
export interface TransactionIndexStore {
  /** Devuelve la función para cancelar la suscripción. */
  subscribe(listener: () => void): () => void;
  getSnapshot(): TransactionIndexSnapshot;
}

/** Store con escritura de estado de hidratación; el índice lo mantiene sincronizado. */
export interface WritableTransactionIndexStore extends TransactionIndexStore {
  setHydration(state: IndexHydrationState): void;
}

/** Crea el store a partir del índice: se actualiza y notifica en cada cambio del índice. */
export function createTransactionIndexStore(index: TransactionIndex): WritableTransactionIndexStore {
  const listeners = new Set<() => void>();
  let hydration: IndexHydrationState = { status: 'idle' };
  let snapshot: TransactionIndexSnapshot = { version: index.version, size: index.size, hydration };

  const publish = (): void => {
    if (snapshot.version === index.version && snapshot.size === index.size && snapshot.hydration === hydration) {
      return;
    }
    snapshot = { version: index.version, size: index.size, hydration };
    for (const listener of [...listeners]) listener();
  };

  index.onChange(publish);

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    setHydration(state) {
      hydration = state;
      publish();
    },
  };
}

/** Hidrata el índice por lotes desde el repositorio y refleja el progreso en el store. */
export async function hydrateTransactionIndex(
  repository: TransactionRepository,
  index: TransactionIndex,
  store: WritableTransactionIndexStore,
  batchSize?: number,
): Promise<void> {
  let loaded = 0;
  store.setHydration({ status: 'hydrating', loaded });
  try {
    await repository.scan((batch) => {
      index.hydrate(batch);
      loaded += batch.length;
      store.setHydration({ status: 'hydrating', loaded });
    }, batchSize);
    store.setHydration({ status: 'ready' });
  } catch {
    store.setHydration({ status: 'failed', error: domainError('storage.unavailable') });
  }
}
