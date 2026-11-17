import { useCallback, useSyncExternalStore } from 'react';
import type { TransactionIndexSnapshot } from '@/application/read-model/TransactionIndexStore';
import { useContainer } from './useContainer';

/**
 * Versión, tamaño y estado de hidratación del índice en memoria (ADR-0009).
 * Las consultas usan `snapshot.version` como dependencia para invalidarse.
 */
export function useTransactionIndex(): TransactionIndexSnapshot {
  const { indexStore } = useContainer();
  const subscribe = useCallback((listener: () => void) => indexStore.subscribe(listener), [indexStore]);
  const getSnapshot = useCallback(() => indexStore.getSnapshot(), [indexStore]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
