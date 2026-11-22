import { describe, expect, test } from 'vitest';
import { createTransactionIndex } from '@/application/read-model/TransactionIndex';
import type { TransactionFilter, TransactionSortKey } from '@/application/ports/inbound/QueryTransactions';
import type { CategoryId } from '@/domain/category/Category';
import type { AccountId } from '@/domain/account/Account';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';
import { generateTransactions } from '../../fixtures/generateTransactions';
import { tx } from '../../fixtures/txBuilder';

function indexOf(txs: readonly Transaction[]) {
  const index = createTransactionIndex();
  index.hydrate(txs);
  return index;
}

function query(
  index: ReturnType<typeof createTransactionIndex>,
  filter: TransactionFilter = {},
  sort: TransactionSortKey = 'dateDesc',
): string[] {
  const positions = index.filter(filter, sort);
  return [...index.idsAt(positions, 0, positions.length)];
}

const SAMPLE = [
  tx({ id: 't1', date: '2026-01-05', cents: -5000, desc: 'MERCADONA Valencia', cat: 'food', acc: 'a1' }),
  tx({ id: 't2', date: '2026-02-10', cents: 200000, desc: 'Nómina empresa', cat: 'salary', acc: 'a1' }),
  tx({ id: 't3', date: '2026-02-15', cents: -1500, desc: 'Cafetería Ñandú', cat: 'food', acc: 'a2' }),
  tx({ id: 't4', date: '2026-03-01', cents: -12000, desc: 'Repsol', cat: 'car', acc: 'a2' }),
  tx({ id: 't5', date: '2026-03-01', cents: 0, desc: 'Ajuste cero', cat: 'car', acc: 'a1' }),
];

describe('createTransactionIndex', () => {
  test('starts empty with version 0', () => {
    const index = createTransactionIndex();
    expect(index.size).toBe(0);
    expect(index.version).toBe(0);
    expect(index.filter({}, 'dateDesc')).toHaveLength(0);
  });

  test('hydrate in several batches accumulates rows and bumps version', () => {
    const index = createTransactionIndex();
    index.hydrate(SAMPLE.slice(0, 2));
    const v1 = index.version;
    index.hydrate(SAMPLE.slice(2));
    expect(index.size).toBe(5);
    expect(index.version).toBeGreaterThan(v1);
    expect(v1).toBeGreaterThan(0);
  });

  describe('ordering', () => {
    test('dateDesc and dateAsc order by date', () => {
      const index = indexOf(SAMPLE);
      expect(query(index, {}, 'dateDesc').slice(0, 3)).toEqual(['t5', 't4', 't3']);
      expect(query(index, {}, 'dateAsc').slice(0, 3)).toEqual(['t1', 't2', 't3']);
    });

    test('amountDesc and amountAsc order by signed amount', () => {
      const index = indexOf(SAMPLE);
      expect(query(index, {}, 'amountDesc')).toEqual(['t2', 't5', 't3', 't1', 't4']);
      expect(query(index, {}, 'amountAsc')).toEqual(['t4', 't1', 't3', 't5', 't2']);
    });

    test('equal amounts keep newest-first order', () => {
      const index = indexOf([
        tx({ id: 'x1', date: '2026-01-01', cents: -100 }),
        tx({ id: 'x2', date: '2026-01-03', cents: -100 }),
        tx({ id: 'x3', date: '2026-01-02', cents: -100 }),
      ]);
      expect(query(index, {}, 'amountAsc')).toEqual(['x2', 'x3', 'x1']);
    });
  });

  describe('filters', () => {
    const index = indexOf(SAMPLE);

    test('text matches substrings ignoring case and accents', () => {
      expect(query(index, { text: 'mercadona' })).toEqual(['t1']);
      expect(query(index, { text: 'nomina' })).toEqual(['t2']);
      expect(query(index, { text: 'cafeteria nandu' })).toEqual(['t3']);
      expect(query(index, { text: 'ERCAD' })).toEqual(['t1']);
    });

    test('text also matches the user-edited description', () => {
      const edited = indexOf([tx({ id: 'e1', desc: 'ABC123', description: 'Gimnasio mensual' })]);
      expect(query(edited, { text: 'gimnasio' })).toEqual(['e1']);
      expect(query(edited, { text: 'abc123' })).toEqual(['e1']);
    });

    test('blank text does not filter', () => {
      expect(query(index, { text: '   ' })).toHaveLength(5);
    });

    test('text without matches returns nothing', () => {
      expect(query(index, { text: 'zzz' })).toEqual([]);
    });

    test('date range is inclusive on both ends', () => {
      expect(query(index, { from: '2026-02-10' as never, to: '2026-03-01' as never }, 'dateAsc')).toEqual([
        't2',
        't3',
        't4',
        't5',
      ]);
      expect(query(index, { to: '2026-01-05' as never })).toEqual(['t1']);
      expect(query(index, { from: '2026-03-02' as never })).toEqual([]);
    });

    test('inverted range yields nothing', () => {
      expect(query(index, { from: '2026-03-01' as never, to: '2026-01-01' as never })).toEqual([]);
    });

    test('categories are a multi-select; empty list means no filter', () => {
      expect(query(index, { categoryIds: ['food' as CategoryId, 'car' as CategoryId] }, 'dateAsc')).toEqual([
        't1',
        't3',
        't4',
        't5',
      ]);
      expect(query(index, { categoryIds: [] })).toHaveLength(5);
      expect(query(index, { categoryIds: ['unknown' as CategoryId] })).toEqual([]);
    });

    test('accounts filter', () => {
      expect(query(index, { accountIds: ['a2' as AccountId] }, 'dateAsc')).toEqual(['t3', 't4']);
      expect(query(index, { accountIds: ['nope' as AccountId] })).toEqual([]);
    });

    test('sign filter separates income and expenses; zero is neither', () => {
      expect(query(index, { sign: 'income' })).toEqual(['t2']);
      expect(query(index, { sign: 'expense' }, 'dateAsc')).toEqual(['t1', 't3', 't4']);
      expect(query(index, { sign: 'any' })).toHaveLength(5);
    });

    test('min/max compare the absolute amount', () => {
      expect(query(index, { minCents: 5000 }, 'dateAsc')).toEqual(['t1', 't2', 't4']);
      expect(query(index, { maxCents: 1500 }, 'dateAsc')).toEqual(['t3', 't5']);
      expect(query(index, { minCents: 1500, maxCents: 5000 }, 'dateAsc')).toEqual(['t1', 't3']);
    });

    test('all filters combine with AND', () => {
      const result = query(index, {
        text: 'a',
        from: '2026-01-01' as never,
        to: '2026-02-28' as never,
        categoryIds: ['food' as CategoryId],
        accountIds: ['a1' as AccountId],
        sign: 'expense',
        minCents: 100,
        maxCents: 9000,
      });
      expect(result).toEqual(['t1']);
    });
  });

  describe('idsAt and sumAt', () => {
    const index = indexOf(SAMPLE);

    test('idsAt pages through positions and clamps out-of-range windows', () => {
      const positions = index.filter({}, 'dateAsc');
      expect(index.idsAt(positions, 1, 2)).toEqual(['t2', 't3']);
      expect(index.idsAt(positions, 4, 10)).toEqual(['t5']);
      expect(index.idsAt(positions, 10, 5)).toEqual([]);
      expect(index.idsAt(positions, -3, 1)).toEqual(['t1']);
    });

    test('sumAt adds the signed amounts', () => {
      expect(index.sumAt(index.filter({}, 'dateAsc')).cents).toBe(-5000 + 200000 - 1500 - 12000);
      expect(index.sumAt(index.filter({ text: 'zzz' }, 'dateAsc')).cents).toBe(0);
    });
  });

  describe('incremental changes', () => {
    test('upsert inserts new rows in the right order without rebuilding', () => {
      const index = indexOf(SAMPLE);
      const before = index.version;
      index.applyUpserts([tx({ id: 'n1', date: '2026-02-12', cents: -700, desc: 'Nuevo' })]);
      expect(index.size).toBe(6);
      expect(index.version).toBeGreaterThan(before);
      expect(query(index, {}, 'dateAsc')).toEqual(['t1', 't2', 'n1', 't3', 't4', 't5']);
    });

    test('upsert of an existing id updates date, amount, category and text', () => {
      const index = indexOf(SAMPLE);
      index.applyUpserts([
        tx({ id: 't1', date: '2026-04-01', cents: 999, desc: 'Devolución tienda', cat: 'refund', acc: 'a3' }),
      ]);
      expect(index.size).toBe(5);
      expect(query(index, {}, 'dateDesc')[0]).toBe('t1');
      expect(query(index, { text: 'mercadona' })).toEqual([]);
      expect(query(index, { text: 'devolucion' })).toEqual(['t1']);
      expect(query(index, { categoryIds: ['refund' as CategoryId] })).toEqual(['t1']);
      expect(query(index, { accountIds: ['a3' as AccountId], sign: 'income' })).toEqual(['t1']);
    });

    test('upsert keeping the same date updates in place', () => {
      const index = indexOf(SAMPLE);
      index.applyUpserts([tx({ id: 't3', date: '2026-02-15', cents: -1, desc: 'Otro', cat: 'x', acc: 'a2' })]);
      expect(query(index, { text: 'otro' })).toEqual(['t3']);
      expect(query(index, {}, 'dateAsc')).toEqual(['t1', 't2', 't3', 't4', 't5']);
    });

    test('delete removes rows and ignores unknown ids', () => {
      const index = indexOf(SAMPLE);
      const before = index.version;
      index.applyDeletes(['t2' as TransactionId, 'ghost' as TransactionId]);
      expect(index.size).toBe(4);
      expect(index.version).toBeGreaterThan(before);
      expect(query(index, {}, 'dateAsc')).toEqual(['t1', 't3', 't4', 't5']);
    });

    test('deleting an unknown id only does not change the version', () => {
      const index = indexOf(SAMPLE);
      const before = index.version;
      index.applyDeletes(['ghost' as TransactionId]);
      expect(index.version).toBe(before);
    });

    test('freed slots are reused and rows sharing a date are deleted correctly', () => {
      const index = indexOf(SAMPLE);
      index.applyDeletes(['t4' as TransactionId]);
      index.applyUpserts([tx({ id: 'r1', date: '2026-03-01', cents: -3, desc: 'Reuso' })]);
      expect(index.size).toBe(5);
      expect(query(index, { from: '2026-03-01' as never }, 'dateAsc').sort()).toEqual(['r1', 't5']);
      index.applyDeletes(['t5' as TransactionId]);
      expect(query(index, { from: '2026-03-01' as never })).toEqual(['r1']);
    });

    test('a large upsert batch (bulk import) keeps results consistent', () => {
      const index = indexOf(SAMPLE);
      const bulk = generateTransactions({ count: 1000, seed: 7 });
      index.applyUpserts(bulk);
      expect(index.size).toBe(1005);
      const dates = index.filter({}, 'dateAsc');
      expect(dates).toHaveLength(1005);
      const ids = index.idsAt(dates, 0, 1005);
      expect(new Set(ids).size).toBe(1005);
    });

    test('upsert after a bulk upsert still works incrementally', () => {
      const index = indexOf(SAMPLE);
      index.applyUpserts(generateTransactions({ count: 500, seed: 9 }));
      query(index);
      index.applyUpserts([tx({ id: 'late', date: '2099-01-01' })]);
      expect(query(index)[0]).toBe('late');
    });
  });

  describe('onChange', () => {
    test('notifies on each mutation and stops after unsubscribe', () => {
      const index = createTransactionIndex();
      let calls = 0;
      const off = index.onChange(() => {
        calls += 1;
      });
      index.hydrate(SAMPLE);
      index.applyDeletes(['t1' as TransactionId]);
      expect(calls).toBe(2);
      off();
      index.applyDeletes(['t2' as TransactionId]);
      expect(calls).toBe(2);
    });
  });

  describe('countMatching', () => {
    test('counts rows by normalized description, amount and account index', () => {
      const index = indexOf(SAMPLE);
      expect(index.countMatching((desc) => desc.includes('REPSOL'))).toBe(1);
      expect(index.countMatching((_d, cents) => cents < 0)).toBe(3);
      expect(index.countMatching((_d, _c, accountIdx) => accountIdx === 0)).toBe(3);
    });

    test('skips deleted rows', () => {
      const index = indexOf(SAMPLE);
      index.applyDeletes(['t1' as TransactionId]);
      expect(index.countMatching(() => true)).toBe(4);
    });
  });

  describe('totalsByMonthAndCategory', () => {
    const index = indexOf(SAMPLE);

    test('aggregates income and expense magnitude by month and category', () => {
      const totals = index.totalsByMonthAndCategory('2026-01' as YearMonth, '2026-03' as YearMonth);
      expect([...totals.keys()].sort()).toEqual(['2026-01', '2026-02', '2026-03']);
      const feb = totals.get('2026-02' as YearMonth);
      expect(feb?.get('salary' as CategoryId)).toEqual({ income: { cents: 200000 }, expense: { cents: 0 } });
      expect(feb?.get('food' as CategoryId)).toEqual({ income: { cents: 0 }, expense: { cents: 1500 } });
      expect(totals.get('2026-03' as YearMonth)?.get('car' as CategoryId)?.expense.cents).toBe(12000);
    });

    test('limits to the requested range and accounts', () => {
      const totals = index.totalsByMonthAndCategory('2026-02' as YearMonth, '2026-02' as YearMonth, [
        'a2' as AccountId,
      ]);
      expect([...totals.keys()]).toEqual(['2026-02']);
      expect([...(totals.get('2026-02' as YearMonth)?.keys() ?? [])]).toEqual(['food']);
    });

    test('returns an empty map when nothing falls in range or from is after to', () => {
      expect(index.totalsByMonthAndCategory('2030-01' as YearMonth, '2030-02' as YearMonth).size).toBe(0);
      expect(index.totalsByMonthAndCategory('2026-03' as YearMonth, '2026-01' as YearMonth).size).toBe(0);
    });

    test('reflects deletions and updates', () => {
      const own = indexOf(SAMPLE);
      own.applyDeletes(['t3' as TransactionId]);
      own.applyUpserts([tx({ id: 't1', date: '2026-02-20', cents: -100, cat: 'food' })]);
      const totals = own.totalsByMonthAndCategory('2026-01' as YearMonth, '2026-02' as YearMonth);
      expect(totals.get('2026-01' as YearMonth)).toBeUndefined();
      expect(totals.get('2026-02' as YearMonth)?.get('food' as CategoryId)?.expense.cents).toBe(100);
    });
  });

  describe('latestBalances', () => {
    test('uses the most recent known balance when the latest row has one', () => {
      const index = indexOf([
        tx({ id: 'b1', date: '2026-01-01', cents: -100, balance: 9900 }),
        tx({ id: 'b2', date: '2026-01-02', cents: -200, balance: 9700 }),
      ]);
      expect(index.latestBalances()).toEqual([
        { accountId: 'a1', balance: { cents: 9700 }, asOf: '2026-01-02', estimated: false },
      ]);
    });

    test('estimates from the last known balance plus later amounts', () => {
      const index = indexOf([
        tx({ id: 'b1', date: '2026-01-01', cents: -100, balance: 9900 }),
        tx({ id: 'b2', date: '2026-01-02', cents: -200 }),
        tx({ id: 'b3', date: '2026-01-03', cents: 50 }),
      ]);
      expect(index.latestBalances()).toEqual([
        { accountId: 'a1', balance: { cents: 9750 }, asOf: '2026-01-03', estimated: true },
      ]);
    });

    test('without any known balance flags the relative sum as balanceUnknown', () => {
      const index = indexOf([
        tx({ id: 'b1', date: '2026-01-01', cents: -100 }),
        tx({ id: 'b2', date: '2026-01-02', cents: -200 }),
      ]);
      expect(index.latestBalances()).toEqual([
        { accountId: 'a1', balance: { cents: -300 }, asOf: '2026-01-02', estimated: true, balanceUnknown: true },
      ]);
    });

    test('handles several accounts, filtering by account and empty index', () => {
      const index = indexOf([
        tx({ id: 'b1', acc: 'a1', date: '2026-01-01', cents: -100, balance: 500 }),
        tx({ id: 'b2', acc: 'a2', date: '2026-01-02', cents: 300, balance: 800 }),
      ]);
      const all = index.latestBalances();
      expect(all.map((b) => b.accountId).sort()).toEqual(['a1', 'a2']);
      expect(index.latestBalances(['a2' as AccountId])).toEqual([
        { accountId: 'a2', balance: { cents: 800 }, asOf: '2026-01-02', estimated: false },
      ]);
      expect(index.latestBalances(['zzz' as AccountId])).toEqual([]);
      expect(createTransactionIndex().latestBalances()).toEqual([]);
    });
  });

  test('handles 20k generated rows consistently against a naive filter', () => {
    const data = generateTransactions({ count: 20_000, seed: 3 });
    const index = indexOf(data);
    const filter: TransactionFilter = {
      text: 'mercadona',
      from: '2024-06-01' as never,
      to: '2024-12-31' as never,
      categoryIds: ['cat-1' as CategoryId, 'cat-4' as CategoryId],
      sign: 'expense',
    };
    const expected = data
      .filter(
        (t) =>
          t.normalizedDescription.includes('MERCADONA') &&
          t.date >= '2024-06-01' &&
          t.date <= '2024-12-31' &&
          (t.categoryId === 'cat-1' || t.categoryId === 'cat-4') &&
          t.amount.cents < 0,
      )
      .map((t) => t.id)
      .sort();
    expect(query(index, filter).sort()).toEqual(expected);
  });
});
