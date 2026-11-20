import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  // El updater funcional de setSearchParams recibe la URL del último render, no la de la llamada anterior:
  // dos cambios en el mismo tick (marcar «Gastos» y cambiar el orden) perdían el primero. Se encadenan
  // sobre la última petición, que se resincroniza con la URL cuando esta cambia por otra vía.
  const latest = useRef(urlParams);
  useEffect(() => {
    latest.current = urlParams;
  }, [urlParams]);

  const apply = useCallback(
    (next: FilterParams) => {
      latest.current = next;
      setLocal((current) => ({ ...current, params: next }));
      setSearchParams(toSearchParams(next), { replace: true });
    },
    [setSearchParams],
  );

  const update = useCallback((patch: Partial<FilterParams>) => apply({ ...latest.current, ...patch }), [apply]);

  const clear = useCallback(() => apply({ ...EMPTY_FILTERS, sort: latest.current.sort }), [apply]);

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
