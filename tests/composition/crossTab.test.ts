import { describe, expect, it, vi } from 'vitest';
import type { CrossTabChangesPort } from '@/application/ports/outbound/CrossTabChangesPort';
import { createTestContainer } from '@/composition/createTestContainer';
import { BroadcastChannelChanges } from '@/infrastructure/system/BroadcastChannelChanges';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { TransactionId } from '@/domain/transaction/Transaction';
import { tx } from '../domain/builders';
import { createInMemoryState } from '../fakes/InMemoryState';
import { InMemoryTransactionRepository } from '../fakes/InMemoryTransactionRepository';

function fakeFeed() {
  const listeners = new Set<() => void>();
  const publish = vi.fn();
  const dispose = vi.fn();
  const feed: CrossTabChangesPort = {
    publish,
    dispose,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return { feed, publish, dispose, emit: () => listeners.forEach((l) => l()) };
}

describe('cross-tab changes in the container', () => {
  it('publishes when this tab writes data', async () => {
    const { feed, publish } = fakeFeed();
    const c = await createTestContainer({ crossTab: feed });

    await c.manageCatalog.saveAccount({ name: 'Cuenta', ibanLast4: null });

    expect(publish).toHaveBeenCalled();
  });

  it('reconciles the index and notifies listeners when another tab changes data, without echoing', async () => {
    const { feed, publish, emit } = fakeFeed();
    const state = createInMemoryState();
    const repo = new InMemoryTransactionRepository(state);
    const c = await createTestContainer({ crossTab: feed, transactions: repo });
    const listener = vi.fn();
    c.onExternalChange(listener);
    expect(c.indexStore.getSnapshot().size).toBe(0);

    state.transactions.set('t1', tx({ id: 't1' as TransactionId, dedupKey: 't1#0' as DedupKey }));
    emit();
    await c.whenIndexIdle();

    expect(c.indexStore.getSnapshot().size).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it('closes the channel on dispose', async () => {
    const { feed, dispose } = fakeFeed();
    const c = await createTestContainer({ crossTab: feed });
    c.dispose();
    expect(dispose).toHaveBeenCalled();
  });
});

describe('BroadcastChannelChanges', () => {
  it('delivers messages from other instances on the same channel name and ignores its own', () => {
    const channels: FakeChannel[] = [];
    class FakeChannel {
      onmessage: ((e: MessageEvent) => void) | null = null;
      closed = false;
      constructor(readonly name: string) {
        channels.push(this);
      }
      postMessage(data: unknown) {
        for (const c of channels) if (c !== this && c.name === this.name && !c.closed) c.onmessage?.({ data } as MessageEvent);
      }
      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    try {
      const a = new BroadcastChannelChanges('cuentas-claras');
      const b = new BroadcastChannelChanges('cuentas-claras');
      const onA = vi.fn();
      const onB = vi.fn();
      a.subscribe(onA);
      b.subscribe(onB);

      a.publish();

      expect(onB).toHaveBeenCalledTimes(1);
      expect(onA).not.toHaveBeenCalled();
      b.dispose();
      a.publish();
      expect(onB).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('is a no-op when BroadcastChannel is unavailable', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    try {
      const feed = new BroadcastChannelChanges('x');
      expect(() => {
        feed.publish();
        feed.subscribe(() => undefined)();
        feed.dispose();
      }).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
