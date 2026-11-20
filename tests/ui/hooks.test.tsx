import { useCallback, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AppContainer } from '@/composition/container.types';
import { ContainerProvider } from '@/ui/container/ContainerContext';
import { createStubContainer, NotWiredError } from '@/ui/dev/stubContainer';
import { useAsync, type AsyncTask } from '@/ui/hooks/useAsync';
import { useContainer } from '@/ui/hooks/useContainer';
import { useTransactionIndex } from '@/ui/hooks/useTransactionIndex';
import { createFakeContainer, createFakeIndexStore } from './fakeContainer';

function withContainer(container: AppContainer) {
  return ({ children }: { children: ReactNode }) => <ContainerProvider container={container}>{children}</ContainerProvider>;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useContainer', () => {
  it('returns the injected container', () => {
    const container = createFakeContainer();
    const { result } = renderHook(() => useContainer(), { wrapper: withContainer(container) });

    expect(result.current).toBe(container);
  });

  it('throws a clear error without provider', () => {
    expect(() => renderHook(() => useContainer())).toThrow(/ContainerProvider/);
  });
});

describe('useTransactionIndex', () => {
  it('re-renders with the new snapshot when the index version changes', () => {
    const indexStore = createFakeIndexStore({ size: 10 });
    const container = createFakeContainer({ indexStore });
    const { result, unmount } = renderHook(() => useTransactionIndex(), { wrapper: withContainer(container) });
    expect(result.current).toMatchObject({ version: 0, size: 10 });

    act(() => indexStore.bump({ size: 12 }));

    expect(result.current).toMatchObject({ version: 1, size: 12, hydration: { status: 'ready' } });
    unmount();
    expect(indexStore.listenerCount()).toBe(0);
  });
});

describe('useAsync', () => {
  it('goes from loading to success', async () => {
    const task: AsyncTask<number> = async () => 42;
    const { result } = renderHook(() => useAsync(task));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toMatchObject({ status: 'success', data: 42 }));
  });

  it('exposes errors and retries with reload', async () => {
    let calls = 0;
    const task: AsyncTask<string> = async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return 'ok';
    };
    const { result } = renderHook(() => useAsync(task));
    await waitFor(() => expect(result.current.status).toBe('error'));

    act(() => result.current.reload());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toMatchObject({ status: 'success', data: 'ok' }));
  });

  it('ignores a stale response when the task changes (no race) and aborts the old one', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const signals: AbortSignal[] = [];
    const { result, rerender } = renderHook(
      ({ id }: { id: 'a' | 'b' }) => {
        const task = useCallback(
          (signal: AbortSignal) => {
            signals.push(signal);
            return id === 'a' ? first.promise : second.promise;
          },
          [id],
        );
        return useAsync(task);
      },
      { initialProps: { id: 'a' as 'a' | 'b' } },
    );

    rerender({ id: 'b' });
    await act(async () => {
      second.resolve('b');
      first.resolve('a');
    });

    expect(result.current).toMatchObject({ status: 'success', data: 'b' });
    expect(signals[0]?.aborted).toBe(true);
  });
});

describe('stub container', () => {
  it('renders an idle index and rejects every use case with "not wired"', async () => {
    const container = createStubContainer();

    expect(container.indexStore.getSnapshot()).toEqual({ version: 0, size: 0, hydration: { status: 'idle' } });
    await expect(container.manageCatalog.listCategories()).rejects.toBeInstanceOf(NotWiredError);
    await expect(container.queryTransactions.search({ filter: {}, sort: 'dateDesc' })).rejects.toThrow(
      /not wired: queryTransactions\.search/,
    );
  });
});
