import { useSyncExternalStore } from 'react';

/** Función que activa el service worker nuevo y recarga la página. */
type ApplyUpdate = () => void;

let pending: ApplyUpdate | null = null;
const listeners = new Set<() => void>();

const emit = (): void => listeners.forEach((listener) => listener());

/** El service worker informa de que hay una versión nueva lista (`onNeedRefresh`). */
export function offerUpdate(apply: ApplyUpdate): void {
  pending = apply;
  emit();
}

/** Solo para tests. */
export function resetUpdateOffer(): void {
  pending = null;
  emit();
}

/** Versión nueva pendiente de aplicar (`null` si no hay). */
export function usePendingUpdate(): ApplyUpdate | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending,
    () => null,
  );
}
