import { useCallback, useEffect, useState } from 'react';

/** Estados de una operación asíncrona. */
export type AsyncState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: T }
  | { readonly status: 'error'; readonly error: unknown };

export type AsyncResult<T> = AsyncState<T> & {
  /** Vuelve a ejecutar la operación (botón «Reintentar»). */
  readonly reload: () => void;
};

/** Función asíncrona cancelable; su identidad es la clave de la consulta. */
export type AsyncTask<T> = (signal: AbortSignal) => Promise<T>;

interface Settled<T> {
  readonly task: AsyncTask<T>;
  readonly attempt: number;
  readonly state: AsyncState<T>;
}

const LOADING = { status: 'loading' } as const;

/**
 * Ejecuta `task` y expone su estado. Se re-ejecuta cuando cambia la identidad de `task`
 * (memoízala con `useCallback`, incluyendo `snapshot.version` para invalidar por datos, ADR-0005).
 * Ignora respuestas de ejecuciones anteriores (sin carreras) y aborta al desmontar.
 */
export function useAsync<T>(task: AsyncTask<T>): AsyncResult<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const settle = (state: AsyncState<T>) => {
      if (!controller.signal.aborted) setSettled({ task, attempt, state });
    };
    task(controller.signal).then(
      (data) => settle({ status: 'success', data }),
      (error: unknown) => settle({ status: 'error', error }),
    );
    return () => controller.abort();
  }, [task, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const isCurrent = settled !== null && settled.task === task && settled.attempt === attempt;
  const state: AsyncState<T> = isCurrent ? settled.state : LOADING;
  return { ...state, reload };
}
