import { beforeEach, describe, expect, test } from 'vitest';
import { QueryTransactionsUseCase } from '@/application/use-cases/QueryTransactionsUseCase';
import { createTransactionIndex, type TransactionIndex } from '@/application/read-model/TransactionIndex';
import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { IdGeneratorPort } from '@/application/ports/outbound/IdGeneratorPort';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { TransactionId } from '@/domain/transaction/Transaction';
import { createInMemoryState, type InMemoryState } from '../../fakes/InMemoryState';
import { InMemoryTransactionRepository } from '../../fakes/InMemoryTransactionRepository';
import { tx } from '../../fixtures/txBuilder';

const SEED = [
  tx({ id: 't1', date: '2026-01-05', cents: -5000, desc: 'MERCADONA Valencia' }),
  tx({ id: 't2', date: '2026-02-10', cents: 200000, desc: 'Nómina' }),
  tx({ id: 't3', date: '2026-02-15', cents: -1500, desc: 'Cafetería' }),
  tx({ id: 't4', date: '2026-03-01', cents: -12000, desc: 'Repsol' }),
];

class FixedClock implements ClockPort {
  now(): string {
    return '2026-11-17T10:00:00.000Z';
  }
  today(): IsoDate {
    return '2026-11-17' as IsoDate;
  }
}

class CountingIds implements IdGeneratorPort {
  private n = 0;
  next(): string {
    this.n += 1;
    return `r${this.n}`;
  }
}

describe('QueryTransactionsUseCase', () => {
  let state: InMemoryState;
  let index: TransactionIndex;
  let useCase: QueryTransactionsUseCase;

  beforeEach(() => {
    state = createInMemoryState();
    for (const t of SEED) state.transactions.set(t.id, t);
    index = createTransactionIndex();
    index.hydrate(SEED);
    useCase = new QueryTransactionsUseCase({
      index,
      transactions: new InMemoryTransactionRepository(state),
      clock: new FixedClock(),
      ids: new CountingIds(),
    });
  });

  describe('search', () => {
    test('returns the count, the signed sum and a result id', async () => {
      const out = await useCase.search({ filter: { sign: 'expense' }, sort: 'dateDesc' });
      expect(out.total).toBe(3);
      expect(out.sum.cents).toBe(-18500);
      expect(out.resultId).toBe('r1');
    });

    test('an empty result has total 0 and sum 0', async () => {
      const out = await useCase.search({ filter: { text: 'zzz' }, sort: 'dateDesc' });
      expect(out.total).toBe(0);
      expect(out.sum.cents).toBe(0);
    });

    test('each search gets a distinct result id', async () => {
      const a = await useCase.search({ filter: {}, sort: 'dateDesc' });
      const b = await useCase.search({ filter: {}, sort: 'dateDesc' });
      expect(a.resultId).not.toBe(b.resultId);
    });
  });

  describe('page', () => {
    test('fetches visible rows from the repository in the fixed order', async () => {
      const { resultId } = await useCase.search({ filter: {}, sort: 'dateAsc' });
      const first = await useCase.page({ resultId, offset: 0, limit: 2 });
      const second = await useCase.page({ resultId, offset: 2, limit: 2 });
      expect(first.map((t) => t.id)).toEqual(['t1', 't2']);
      expect(second.map((t) => t.id)).toEqual(['t3', 't4']);
    });

    test('respects the sort requested in the search', async () => {
      const { resultId } = await useCase.search({ filter: {}, sort: 'amountAsc' });
      const rows = await useCase.page({ resultId, offset: 0, limit: 2 });
      expect(rows.map((t) => t.id)).toEqual(['t4', 't1']);
    });

    test('returns an empty page for an unknown result id', async () => {
      expect(await useCase.page({ resultId: 'nope', offset: 0, limit: 10 })).toEqual([]);
    });

    test('clamps negative offsets and non-positive limits', async () => {
      const { resultId } = await useCase.search({ filter: {}, sort: 'dateAsc' });
      expect((await useCase.page({ resultId, offset: -5, limit: 1 })).map((t) => t.id)).toEqual(['t1']);
      expect(await useCase.page({ resultId, offset: 0, limit: 0 })).toEqual([]);
    });

    test('recomputes the result when the index changed after the search', async () => {
      const { resultId } = await useCase.search({ filter: {}, sort: 'dateAsc' });
      index.applyDeletes(['t1' as TransactionId]);
      state.transactions.delete('t1');
      const rows = await useCase.page({ resultId, offset: 0, limit: 10 });
      expect(rows.map((t) => t.id)).toEqual(['t2', 't3', 't4']);
    });

    test('evicts the oldest results beyond the retention limit', async () => {
      const first = await useCase.search({ filter: {}, sort: 'dateAsc' });
      for (let i = 0; i < 10; i += 1) await useCase.search({ filter: {}, sort: 'dateAsc' });
      expect(await useCase.page({ resultId: first.resultId, offset: 0, limit: 10 })).toEqual([]);
    });
  });

  describe('update', () => {
    test('edits description and note, persists them and refreshes the index', async () => {
      const before = index.version;
      const result = await useCase.update({
        id: 't3' as TransactionId,
        patch: { description: 'Desayuno', note: 'con Ana' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.description).toBe('Desayuno');
      expect(result.value.note).toBe('con Ana');
      expect(result.value.updatedAt).toBe('2026-11-17T10:00:00.000Z');
      expect(result.value.rawDescription).toBe('Cafetería');
      expect(state.transactions.get('t3')?.note).toBe('con Ana');
      expect(index.version).toBeGreaterThan(before);
      const found = await useCase.search({ filter: { text: 'desayuno' }, sort: 'dateDesc' });
      expect(found.total).toBe(1);
    });

    test('a note-only patch keeps the description', async () => {
      const result = await useCase.update({ id: 't3' as TransactionId, patch: { note: 'x' } });
      expect(result.ok && result.value.description).toBe('Cafetería');
    });

    test('an empty patch returns the movement unchanged', async () => {
      const result = await useCase.update({ id: 't3' as TransactionId, patch: {} });
      expect(result.ok && result.value.id).toBe('t3');
    });

    test('rejects a blank description', async () => {
      const result = await useCase.update({ id: 't3' as TransactionId, patch: { description: '   ' } });
      expect(result).toEqual({ ok: false, error: { code: 'import.emptyDescription' } });
      expect(state.transactions.get('t3')?.description).toBe('Cafetería');
    });

    test('returns transaction.notFound for a missing id', async () => {
      const result = await useCase.update({ id: 'ghost' as TransactionId, patch: { note: 'x' } });
      expect(result).toEqual({ ok: false, error: { code: 'transaction.notFound' } });
    });
  });
});
