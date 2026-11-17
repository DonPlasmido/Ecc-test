import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Cents } from '@/domain/money/Money';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import { makeBatch, makeTransaction } from '../fixtures';
import type { World, WorldFactory } from './worlds';

const range = (n: number, from = 0): Transaction[] => Array.from({ length: n }, (_, i) => makeTransaction(from + i));
const ids = (txs: readonly Transaction[]): string[] => txs.map((t) => t.id);

async function collect(world: World, batchSize?: number): Promise<{ batches: Transaction[][]; total: number }> {
  const batches: Transaction[][] = [];
  const total = await world.transactions.scan((b) => batches.push([...b]), batchSize);
  return { batches, total };
}

export function transactionRepositoryContract(label: string, create: WorldFactory): void {
  describe(`TransactionRepository contract (${label})`, () => {
    let world: World;
    beforeEach(async () => {
      world = await create();
    });
    afterEach(() => world.dispose());

    describe('insertImport + getByIds', () => {
      it('stores the transactions and the batch', async () => {
        const txs = range(3);
        await world.transactions.insertImport(makeBatch(), txs);
        expect(await world.transactions.getByIds(ids(txs) as TransactionId[])).toEqual(txs);
        expect(await world.importBatches.list()).toEqual([makeBatch()]);
      });

      it('records the batch even when there are no new transactions', async () => {
        await world.transactions.insertImport(makeBatch({ inserted: 0, duplicates: 2 }), []);
        expect(await world.importBatches.list()).toHaveLength(1);
        expect((await collect(world)).total).toBe(0);
      });

      it('round-trips balance, value date and unicode text', async () => {
        const tx = makeTransaction(1, {
          balance: { cents: 0 as Cents },
          valueDate: '2024-05-06' as Transaction['valueDate'],
          note: "ñandú 🦩 '; DROP TABLE--",
        });
        await world.transactions.insertImport(makeBatch(), [tx]);
        expect(await world.transactions.getByIds([tx.id])).toEqual([tx]);
      });

      it('returns copies, not references shared with the store', async () => {
        const tx = makeTransaction(1);
        await world.transactions.insertImport(makeBatch(), [tx]);
        const [first] = await world.transactions.getByIds([tx.id]);
        (first as { note: string }).note = 'mutated';
        const [again] = await world.transactions.getByIds([tx.id]);
        expect(again?.note).toBe('');
      });

      it('keeps the requested order and skips unknown ids', async () => {
        const txs = range(3);
        await world.transactions.insertImport(makeBatch(), txs);
        const wanted = ['tx-0000002', 'missing', 'tx-0000000'] as TransactionId[];
        expect(ids(await world.transactions.getByIds(wanted))).toEqual(['tx-0000002', 'tx-0000000']);
      });

      it('returns an empty list for no ids', async () => {
        expect(await world.transactions.getByIds([])).toEqual([]);
      });

      it('rolls back everything when a dedup key already exists', async () => {
        await world.transactions.insertImport(makeBatch(), [makeTransaction(0)]);
        const clash = makeTransaction(5, { dedupKey: makeTransaction(0).dedupKey });
        const second = makeBatch({ id: 'batch-2' as ImportBatchId });
        await expect(world.transactions.insertImport(second, [makeTransaction(1), makeTransaction(2), clash])).rejects.toThrow();
        expect((await collect(world)).total).toBe(1);
        expect(await world.importBatches.list()).toHaveLength(1);
      });

      it('rolls back when the same dedup key appears twice in the import', async () => {
        const a = makeTransaction(1);
        const b = makeTransaction(2, { dedupKey: a.dedupKey });
        await expect(world.transactions.insertImport(makeBatch(), [a, b])).rejects.toThrow();
        expect((await collect(world)).total).toBe(0);
        expect(await world.importBatches.list()).toEqual([]);
      });

      it('rejects a repeated transaction id without altering the stored one', async () => {
        await world.transactions.insertImport(makeBatch(), [makeTransaction(0)]);
        const dup = makeTransaction(0, { dedupKey: 'other#0' as DedupKey, note: 'new' });
        await expect(
          world.transactions.insertImport(makeBatch({ id: 'batch-2' as ImportBatchId }), [dup]),
        ).rejects.toThrow();
        const [stored] = await world.transactions.getByIds([dup.id]);
        expect(stored?.note).toBe('');
      });

      it('rejects a repeated batch id and leaves the transactions untouched', async () => {
        await world.transactions.insertImport(makeBatch(), [makeTransaction(0)]);
        await expect(world.transactions.insertImport(makeBatch(), [makeTransaction(1)])).rejects.toThrow();
        expect((await collect(world)).total).toBe(1);
      });
    });

    describe('scan', () => {
      it('resolves with 0 and never calls back on an empty store', async () => {
        const { batches, total } = await collect(world);
        expect(total).toBe(0);
        expect(batches).toEqual([]);
      });

      it('splits into blocks of the requested size, ordered by id', async () => {
        await world.transactions.insertImport(makeBatch(), range(5));
        const { batches, total } = await collect(world, 2);
        expect(total).toBe(5);
        expect(batches.map((b) => b.length)).toEqual([2, 2, 1]);
        expect(ids(batches.flat())).toEqual(ids(range(5)));
      });

      it('does not emit an empty trailing block when the size divides the total', async () => {
        await world.transactions.insertImport(makeBatch(), range(4));
        expect((await collect(world, 2)).batches.map((b) => b.length)).toEqual([2, 2]);
      });

      it('reads everything in one block when the size exceeds the total', async () => {
        await world.transactions.insertImport(makeBatch(), range(3));
        expect((await collect(world, 100)).batches.map((b) => b.length)).toEqual([3]);
      });

      it('uses a default block size', async () => {
        await world.transactions.insertImport(makeBatch(), range(3));
        expect((await collect(world)).total).toBe(3);
      });

      it.each([0, -1, 1.5, Number.NaN])('rejects the invalid block size %s', async (size) => {
        await expect(world.transactions.scan(() => undefined, size)).rejects.toThrow(RangeError);
      });

      it('propagates an error thrown by the callback', async () => {
        await world.transactions.insertImport(makeBatch(), range(2));
        await expect(
          world.transactions.scan(() => {
            throw new Error('boom');
          }),
        ).rejects.toThrow('boom');
      });
    });

    describe('existingDedupKeys', () => {
      it('returns an empty set for no keys', async () => {
        expect((await world.transactions.existingDedupKeys([])).size).toBe(0);
      });

      it('returns only the keys that already exist', async () => {
        const txs = range(3);
        await world.transactions.insertImport(makeBatch(), txs);
        const unknown = 'nope#0' as DedupKey;
        const found = await world.transactions.existingDedupKeys([txs[0]!.dedupKey, unknown, txs[2]!.dedupKey, txs[0]!.dedupKey]);
        expect([...found].sort()).toEqual([txs[0]!.dedupKey, txs[2]!.dedupKey].sort());
      });
    });

    describe('updateMany', () => {
      it('persists the changes of every transaction', async () => {
        const txs = range(3);
        await world.transactions.insertImport(makeBatch(), txs);
        const updated = txs.map((t) => ({ ...t, note: `n-${t.id}`, categorySource: 'manual' as const }));
        await world.transactions.updateMany(updated);
        expect(await world.transactions.getByIds(ids(txs) as TransactionId[])).toEqual(updated);
      });

      it('is a no-op for an empty list', async () => {
        await world.transactions.insertImport(makeBatch(), range(1));
        await world.transactions.updateMany([]);
        expect((await collect(world)).total).toBe(1);
      });

      it('is atomic: a dedup conflict leaves every row unchanged', async () => {
        const txs = range(3);
        await world.transactions.insertImport(makeBatch(), txs);
        const changed = [
          { ...txs[0]!, note: 'changed' },
          { ...txs[1]!, dedupKey: txs[2]!.dedupKey },
        ];
        await expect(world.transactions.updateMany(changed)).rejects.toThrow();
        expect(await world.transactions.getByIds([txs[0]!.id])).toEqual([txs[0]]);
      });
    });

    describe('deleteByImportBatch', () => {
      it('removes only the transactions of that batch and returns their ids', async () => {
        const other = 'batch-2' as ImportBatchId;
        await world.transactions.insertImport(makeBatch(), range(3));
        await world.transactions.insertImport(makeBatch({ id: other }), range(2, 10).map((t) => ({ ...t, importBatchId: other })));
        const removed = await world.transactions.deleteByImportBatch(other);
        expect([...removed].sort()).toEqual(['tx-0000010', 'tx-0000011']);
        expect(ids((await collect(world)).batches.flat())).toEqual(ids(range(3)));
      });

      it('also removes the batch record and frees its dedup keys', async () => {
        const txs = range(2);
        await world.transactions.insertImport(makeBatch(), txs);
        await world.transactions.deleteByImportBatch(makeBatch().id);
        expect(await world.importBatches.list()).toEqual([]);
        expect((await world.transactions.existingDedupKeys(txs.map((t) => t.dedupKey))).size).toBe(0);
        await world.transactions.insertImport(makeBatch(), txs);
        expect((await collect(world)).total).toBe(2);
      });

      it('returns an empty list for an unknown batch', async () => {
        await world.transactions.insertImport(makeBatch(), range(1));
        expect(await world.transactions.deleteByImportBatch('ghost' as ImportBatchId)).toEqual([]);
        expect((await collect(world)).total).toBe(1);
      });
    });

    describe('ImportBatchRepository.list', () => {
      it('is empty at the start', async () => {
        expect(await world.importBatches.list()).toEqual([]);
      });

      it('orders batches by import time, then id', async () => {
        const late = makeBatch({ id: 'b-a' as ImportBatchId, importedAt: '2024-03-01T00:00:00.000Z' });
        const early = makeBatch({ id: 'b-z' as ImportBatchId, importedAt: '2024-01-01T00:00:00.000Z' });
        const tie = makeBatch({ id: 'b-b' as ImportBatchId, importedAt: '2024-03-01T00:00:00.000Z' });
        for (const b of [late, early, tie]) await world.transactions.insertImport(b, []);
        expect((await world.importBatches.list()).map((b) => b.id)).toEqual(['b-z', 'b-a', 'b-b']);
      });
    });
  });
}
