import { describe, expect, test, vi } from 'vitest';
import { createTransactionIndex } from '@/application/read-model/TransactionIndex';
import {
  createTransactionIndexStore,
  hydrateTransactionIndex,
} from '@/application/read-model/TransactionIndexStore';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import { InMemoryTransactionRepository } from '../../fakes/InMemoryTransactionRepository';
import { createInMemoryState } from '../../fakes/InMemoryState';
import { tx } from '../../fixtures/txBuilder';

describe('createTransactionIndexStore', () => {
  test('initial snapshot is idle with version and size of the index', () => {
    const index = createTransactionIndex();
    const store = createTransactionIndexStore(index);
    expect(store.getSnapshot()).toEqual({ version: 0, size: 0, hydration: { status: 'idle' } });
  });

  test('getSnapshot returns the same reference while nothing changes', () => {
    const store = createTransactionIndexStore(createTransactionIndex());
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  test('notifies subscribers and refreshes the snapshot on index changes', () => {
    const index = createTransactionIndex();
    const store = createTransactionIndexStore(index);
    const listener = vi.fn();
    const before = store.getSnapshot();
    const off = store.subscribe(listener);
    index.applyUpserts([tx({ id: 'a' })]);
    expect(listener).toHaveBeenCalledTimes(1);
    const after = store.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.version).toBe(index.version);
    expect(after.size).toBe(1);
    off();
    index.applyUpserts([tx({ id: 'b' })]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('setHydration publishes the new state and notifies', () => {
    const store = createTransactionIndexStore(createTransactionIndex());
    const listener = vi.fn();
    store.subscribe(listener);
    store.setHydration({ status: 'hydrating', loaded: 10 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().hydration).toEqual({ status: 'hydrating', loaded: 10 });
  });
});

describe('hydrateTransactionIndex', () => {
  test('loads every batch, reports progress and ends ready', async () => {
    const state = createInMemoryState();
    for (let i = 0; i < 7; i += 1) state.transactions.set(`t${i}`, tx({ id: `t${i}` }));
    const index = createTransactionIndex();
    const store = createTransactionIndexStore(index);
    const seen: unknown[] = [];
    store.subscribe(() => seen.push(store.getSnapshot().hydration));
    await hydrateTransactionIndex(new InMemoryTransactionRepository(state), index, store, 3);
    expect(index.size).toBe(7);
    expect(store.getSnapshot().hydration).toEqual({ status: 'ready' });
    expect(seen).toContainEqual({ status: 'hydrating', loaded: 3 });
    expect(seen).toContainEqual({ status: 'hydrating', loaded: 7 });
  });

  test('ends failed with a storage error when the scan rejects', async () => {
    const repo = { scan: () => Promise.reject(new Error('boom')) } as unknown as TransactionRepository;
    const index = createTransactionIndex();
    const store = createTransactionIndexStore(index);
    await hydrateTransactionIndex(repo, index, store);
    const { hydration } = store.getSnapshot();
    expect(hydration.status).toBe('failed');
    expect(hydration.status === 'failed' && hydration.error.code).toBe('storage.unavailable');
  });
});
