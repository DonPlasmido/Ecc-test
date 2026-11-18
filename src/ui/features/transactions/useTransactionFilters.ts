import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EMPTY_FILTERS, parseFilterParams, toSearchParams, type FilterParams } from './filterParams';

export interface TransactionFiltersState {
  readonly params: FilterParams;
  /** Aplica cambios a la URL (`replace`: no llena el historial con cada filtro). */
  readonly update: (patch: Partial<FilterParams>) => void;
  readonly clear: () => void;
}

/** Filtros persistidos en la query del hash (a11y §2.5, 3.3.7: se conservan al volver). */
export function useTransactionFilters(): TransactionFiltersState {
  const [searchParams, setSearchParams] = useSearchParams();
  const serialized = searchParams.toString();
  const params = useMemo(() => parseFilterParams(new URLSearchParams(serialized)), [serialized]);

  const update = useCallback(
    (patch: Partial<FilterParams>) => {
      setSearchParams((current) => toSearchParams({ ...parseFilterParams(current), ...patch }), { replace: true });
    },
    [setSearchParams],
  );

  const clear = useCallback(() => {
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
