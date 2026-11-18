import { useCallback, useEffect, useState } from 'react';
import type { Category } from '@/domain/category/Category';
import type { Rule } from '@/domain/rule/Rule';
import { sortRules } from '@/domain/rule/ruleMatcher';
import { useContainer } from '@/ui/hooks/useContainer';

export type CatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: unknown }
  | {
      readonly status: 'ready';
      /** Ordenadas por prioridad. */
      readonly rules: readonly Rule[];
      readonly categories: readonly Category[];
    };

type Update<T> = (current: readonly T[]) => readonly T[];

export interface CatalogHandle {
  readonly state: CatalogState;
  readonly reload: () => void;
  /** Actualiza la copia local tras una escritura confirmada por el puerto (sin volver a leer). */
  readonly updateRules: (update: Update<Rule>) => void;
  readonly updateCategories: (update: Update<Category>) => void;
}

/** Reglas y categorías de `manageCatalog`, con actualización local inmutable tras cada escritura. */
export function useCatalog(): CatalogHandle {
  const { manageCatalog } = useContainer();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CatalogState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;
    // `async`: un fallo síncrono del puerto también llega como estado de error.
    const load = async () => Promise.all([manageCatalog.listRules(), manageCatalog.listCategories()]);
    load().then(
      ([rules, categories]) => {
        if (isActive) setState({ status: 'ready', rules: sortRules(rules), categories });
      },
      (error: unknown) => {
        if (isActive) setState({ status: 'error', error });
      },
    );
    return () => {
      isActive = false;
    };
  }, [manageCatalog, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const updateRules = useCallback((update: Update<Rule>) => {
    setState((current) => (current.status === 'ready' ? { ...current, rules: sortRules(update(current.rules)) } : current));
  }, []);

  const updateCategories = useCallback((update: Update<Category>) => {
    setState((current) => (current.status === 'ready' ? { ...current, categories: update(current.categories) } : current));
  }, []);

  return { state, reload, updateRules, updateCategories };
}
