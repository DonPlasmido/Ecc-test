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
  readonly error: unknown;
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
  const [fallback, setFallback] = useState<PageCache | null>(null);
  const inFlight = useRef(new Set<string>());
  const lastRange = useRef<readonly [number, number]>([0, TRANSACTION_PAGE_SIZE - 1]);
  const filterRef = useRef({ filter, sort });
  const cacheRef = useRef<PageCache | null>(null);
  const searchKeyRef = useRef<string | null>(null);

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
        setError(null);
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
  }, [queryTransactions, queryKey, version]);

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
              const current = cacheRef.current;
              const base = current?.resultId === id ? current.pages : EMPTY_PAGES;
              const next: PageCache = { resultId: id, pages: new Map(base).set(pageIndex, rows) };
              cacheRef.current = next;
              setCache(next);
            },
            (reason: unknown) => setError(reason),
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
    getRow,
    requestRange,
  };
}
