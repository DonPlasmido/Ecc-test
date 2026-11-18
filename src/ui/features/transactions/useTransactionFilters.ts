import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EMPTY_FILTERS, parseFilterParams, toSearchParams, type FilterParams } from './filterParams';

export interface TransactionFiltersState {
  readonly params: FilterParams;
  /** Aplica cambios a la URL (`replace`: no llena el historial con cada filtro). */
  readonly update: (patch: Partial<FilterParams>) => void;
  readonly clear: () => void;
}

/**
 * Filtros persistidos en la query del hash (a11y §2.5, 3.3.7: se conservan al volver).
 *
 * React Router aplica la navegación dentro de `startTransition`: si los controles leyeran solo la URL, un
 * radio o checkbox controlado volvería a su valor anterior hasta que la transición termina. Por eso se
 * guarda también una copia local que se actualiza de inmediato y se resincroniza cuando la URL cambia.
 */
export function useTransactionFilters(): TransactionFiltersState {
  const [searchParams, setSearchParams] = useSearchParams();
  const serialized = searchParams.toString();
  const urlParams = useMemo(() => parseFilterParams(new URLSearchParams(serialized)), [serialized]);
  const [local, setLocal] = useState({ from: serialized, params: urlParams });
  if (local.from !== serialized) setLocal({ from: serialized, params: urlParams });
  const params = local.from === serialized ? local.params : urlParams;

  const update = useCallback(
    (patch: Partial<FilterParams>) => {
      setLocal((current) => ({ ...current, params: { ...current.params, ...patch } }));
      setSearchParams((current) => toSearchParams({ ...parseFilterParams(current), ...patch }), { replace: true });
    },
    [setSearchParams],
  );

  const clear = useCallback(() => {
    setLocal((current) => ({ ...current, params: { ...EMPTY_FILTERS, sort: current.params.sort } }));
    setSearchParams((current) => toSearchParams({ ...EMPTY_FILTERS, sort: parseFilterParams(current).sort }), {
      replace: true,
    });
  }, [setSearchParams]);

  return { params, update, clear };
}

/** Valor retrasado `delayMs` desde el último cambio (búsqueda e importes). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
