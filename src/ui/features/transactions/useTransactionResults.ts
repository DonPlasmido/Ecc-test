import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TRANSACTION_PAGE_SIZE,
  type SearchTransactionsOutput,
  type TransactionFilter,
  type TransactionSortKey,
} from '@/application/ports/inbound/QueryTransactions';
import type { Transaction } from '@/domain/transaction/Transaction';
import { useContainer } from '@/ui/hooks/useContainer';

type PageMap = ReadonlyMap<number, readonly Transaction[]>;

interface PageCache {
  readonly resultId: string;
  readonly pages: PageMap;
}

interface SearchState {
  /** Clave de filtro + orden de la búsqueda que produjo `summary`. */
  readonly queryKey: string;
  readonly summary: SearchTransactionsOutput;
}

export interface TransactionResults {
  /** `null` hasta la primera búsqueda. */
  readonly summary: SearchTransactionsOutput | null;
  readonly isSearching: boolean;
  /** Error de la búsqueda vigente (la lista no se puede mostrar). */
  readonly error: unknown;
  /** Error al cargar una página del resultado vigente (la lista y el resumen siguen siendo válidos). */
  readonly pageError: unknown;
  /** Repite la búsqueda fallida. */
  readonly retry: () => void;
  /** Repite la carga de las páginas fallidas del resultado vigente. */
  readonly retryPages: () => void;
  readonly getRow: (index: number) => Transaction | undefined;
  readonly requestRange: (startIndex: number, endIndex: number) => void;
}

const EMPTY_PAGES: PageMap = new Map();

function pagesFor(startIndex: number, endIndex: number): readonly number[] {
  const first = Math.floor(Math.max(0, startIndex) / TRANSACTION_PAGE_SIZE);
  const last = Math.floor(Math.max(0, endIndex) / TRANSACTION_PAGE_SIZE);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/**
 * Búsqueda en dos fases (ADR-0008/0009): `search` en memoria da total, suma y `resultId`; las filas visibles
 * se piden por páginas de 100 y se cachean por `resultId`. Si cambian los datos (`version`) con el mismo
 * filtro, las páginas anteriores se muestran hasta que llegan las nuevas (sin parpadeo de esqueletos).
 */
export function useTransactionResults(
  filter: TransactionFilter,
  sort: TransactionSortKey,
  version: number,
): TransactionResults {
  const { queryTransactions } = useContainer();
  const queryKey = `${JSON.stringify(filter)}|${sort}`;
  const [search, setSearch] = useState<SearchState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cache, setCache] = useState<PageCache | null>(null);
  const [pageFailure, setPageFailure] = useState<{ resultId: string; reason: unknown } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fallback, setFallback] = useState<PageCache | null>(null);
  const inFlight = useRef(new Set<string>());
  const lastRange = useRef<readonly [number, number]>([0, TRANSACTION_PAGE_SIZE - 1]);
  const filterRef = useRef({ filter, sort });
  const cacheRef = useRef<PageCache | null>(null);
  const searchKeyRef = useRef<string | null>(null);
  /** Resultado vigente: las respuestas y errores de cualquier otro se descartan. */
  const currentResultRef = useRef<string | null>(null);

  useEffect(() => {
    filterRef.current = { filter, sort };
  });

  useEffect(() => {
    let isCurrent = true;
    const { filter: currentFilter, sort: currentSort } = filterRef.current;
    // `then` previo: un fallo síncrono del puerto llega como rechazo y no rompe el render.
    Promise.resolve()
      .then(() => queryTransactions.search({ filter: currentFilter, sort: currentSort }))
      .then(
      (summary) => {
        if (!isCurrent) return;
        const isSameQuery = searchKeyRef.current === queryKey;
        searchKeyRef.current = queryKey;
        currentResultRef.current = summary.resultId;
        setError(null);
        setPageFailure(null);
        setFallback(isSameQuery ? cacheRef.current : null);
        setSearch({ queryKey, summary });
      },
      (reason: unknown) => {
        if (isCurrent) setError(reason);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [queryTransactions, queryKey, version, attempt]);

  const resultId = search?.summary.resultId ?? null;

  const loadPages = useCallback(
    (id: string, startIndex: number, endIndex: number) => {
      for (const pageIndex of pagesFor(startIndex, endIndex)) {
        const flightKey = `${id}:${pageIndex}`;
        const loaded = cacheRef.current?.resultId === id && cacheRef.current.pages.has(pageIndex);
        if (loaded || inFlight.current.has(flightKey)) continue;
        inFlight.current.add(flightKey);
        queryTransactions
          .page({ resultId: id, offset: pageIndex * TRANSACTION_PAGE_SIZE, limit: TRANSACTION_PAGE_SIZE })
          .then(
            (rows) => {
              if (currentResultRef.current !== id) return;
              const current = cacheRef.current;
              const base = current?.resultId === id ? current.pages : EMPTY_PAGES;
              const next: PageCache = { resultId: id, pages: new Map(base).set(pageIndex, rows) };
              cacheRef.current = next;
              setCache(next);
            },
            (reason: unknown) => {
              if (currentResultRef.current === id) setPageFailure({ resultId: id, reason });
            },
          )
          .finally(() => inFlight.current.delete(flightKey));
      }
    },
    [queryTransactions],
  );

  // Nuevo resultado: se vuelve a pedir el rango que la lista tenía a la vista.
  useEffect(() => {
    if (resultId === null || (search?.summary.total ?? 0) === 0) return;
    const [start, end] = lastRange.current;
    loadPages(resultId, start, end);
  }, [resultId, search?.summary.total, loadPages]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const retryPages = useCallback(() => {
    if (resultId === null) return;
    setPageFailure(null);
    const [start, end] = lastRange.current;
    loadPages(resultId, start, end);
  }, [resultId, loadPages]);

  const requestRange = useCallback(
    (startIndex: number, endIndex: number) => {
      lastRange.current = [startIndex, endIndex];
      if (resultId !== null) loadPages(resultId, startIndex, endIndex);
    },
    [resultId, loadPages],
  );

  const currentPages = cache !== null && cache.resultId === resultId ? cache.pages : null;
  const fallbackPages = fallback?.pages ?? null;
  const getRow = useCallback(
    (index: number): Transaction | undefined => {
      const pageIndex = Math.floor(index / TRANSACTION_PAGE_SIZE);
      const offset = index % TRANSACTION_PAGE_SIZE;
      return currentPages?.get(pageIndex)?.[offset] ?? fallbackPages?.get(pageIndex)?.[offset];
    },
    [currentPages, fallbackPages],
  );

  return {
    summary: search?.summary ?? null,
    isSearching: search === null || search.queryKey !== queryKey,
    error,
    pageError: pageFailure !== null && pageFailure.resultId === resultId ? pageFailure.reason : null,
    retry,
    retryPages,
    getRow,
    requestRange,
  };
}
