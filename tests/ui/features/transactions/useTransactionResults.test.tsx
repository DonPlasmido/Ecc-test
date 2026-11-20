import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/domain/transaction/Transaction';
import { ContainerProvider } from '@/ui/container/ContainerContext';
import { useTransactionResults } from '@/ui/features/transactions/useTransactionResults';
import { createFakeContainer } from '../../fakeContainer';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}

const tx = (id: string) => ({ id, description: id }) as unknown as Transaction;

function setup(pageFor: (resultId: string, call: number) => Promise<readonly Transaction[]>) {
  const calls = new Map<string, number>();
  let failSearch = false;
  const container = createFakeContainer({
    queryTransactions: {
      search: async ({ filter }: { filter: { text?: string } }) => {
        if (failSearch) throw new Error('search failed');
        return { resultId: filter.text === 'b' ? 'B' : 'A', total: 5, sum: 0 };
      },
      page: ({ resultId }: { resultId: string }) => {
        const call = (calls.get(resultId) ?? 0) + 1;
        calls.set(resultId, call);
        return pageFor(resultId, call);
      },
    } as never,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
  const rendered = renderHook(
    ({ text }: { text?: string }) => useTransactionResults(text ? { text } : {}, 'dateDesc', 0),
    { wrapper, initialProps: {} as { text?: string } },
  );
  return {
    ...rendered,
    setSearchFailing: (value: boolean) => {
      failSearch = value;
    },
  };
}

describe('useTransactionResults: resultados obsoletos', () => {
  it('ignores a stale page that arrives after the current result loaded', async () => {
    const pageA = deferred<readonly Transaction[]>();
    const { result, rerender } = setup((id) => (id === 'A' ? pageA.promise : Promise.resolve([tx('b0')])));
    await waitFor(() => expect(result.current.summary?.total).toBe(5));

    rerender({ text: 'b' });
    await waitFor(() => expect(result.current.getRow(0)?.id).toBe('b0'));
    await act(async () => {
      pageA.resolve([tx('a0')]);
      await Promise.resolve();
    });

    expect(result.current.getRow(0)?.id).toBe('b0');
  });

  it('ignores the rejection of a stale page', async () => {
    const pageA = deferred<readonly Transaction[]>();
    const { result, rerender } = setup((id) => (id === 'A' ? pageA.promise : Promise.resolve([tx('b0')])));
    await waitFor(() => expect(result.current.summary?.total).toBe(5));

    rerender({ text: 'b' });
    await waitFor(() => expect(result.current.getRow(0)?.id).toBe('b0'));
    await act(async () => {
      pageA.reject(new Error('evicted'));
      await Promise.resolve();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.pageError).toBeNull();
    expect(result.current.getRow(0)?.id).toBe('b0');
  });
});

describe('useTransactionResults: errores y reintentos', () => {
  it('keeps the summary and reports a local page error that retryPages recovers from', async () => {
    const { result } = setup((_id, call) =>
      call === 1 ? Promise.reject(new Error('boom')) : Promise.resolve([tx('a0')]),
    );
    await waitFor(() => expect(result.current.pageError).not.toBeNull());
    expect(result.current.error).toBeNull();
    expect(result.current.summary?.total).toBe(5);

    act(() => result.current.retryPages());

    await waitFor(() => expect(result.current.getRow(0)?.id).toBe('a0'));
    expect(result.current.pageError).toBeNull();
  });

  it('retries the search after a failure', async () => {
    const harness = setup(() => Promise.resolve([tx('a0')]));
    await waitFor(() => expect(harness.result.current.summary?.total).toBe(5));
    harness.setSearchFailing(true);
    harness.rerender({ text: 'x' });
    await waitFor(() => expect(harness.result.current.error).not.toBeNull());

    harness.setSearchFailing(false);
    act(() => harness.result.current.retry());

    await waitFor(() => expect(harness.result.current.error).toBeNull());
    await waitFor(() => expect(harness.result.current.isSearching).toBe(false));
  });
});
