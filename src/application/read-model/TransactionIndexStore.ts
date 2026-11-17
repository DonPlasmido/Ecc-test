import type { DomainError } from '@/domain/shared/DomainError';

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
