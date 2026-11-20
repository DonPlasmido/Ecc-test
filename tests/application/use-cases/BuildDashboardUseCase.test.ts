import { describe, expect, test } from 'vitest';
import { BuildDashboardUseCase } from '@/application/use-cases/BuildDashboardUseCase';
import { createTransactionIndex } from '@/application/read-model/TransactionIndex';
import { DASHBOARD_MAX_MONTHS } from '@/application/ports/inbound/BuildDashboard';
import type { AccountId } from '@/domain/account/Account';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Transaction } from '@/domain/transaction/Transaction';
import { tx } from '../../fixtures/txBuilder';

function dashboardOver(txs: readonly Transaction[]): BuildDashboardUseCase {
  const index = createTransactionIndex();
  index.hydrate(txs);
  return new BuildDashboardUseCase({ index });
}

const ym = (s: string): YearMonth => s as YearMonth;

const MARCH = [
  tx({ id: 'i1', date: '2026-03-01', cents: 200000, cat: 'salary' }),
  tx({ id: 'e1', date: '2026-03-05', cents: -100000, cat: 'rent' }),
  tx({ id: 'e2', date: '2026-03-09', cents: -23456, cat: 'food' }),
  tx({ id: 'e3', date: '2026-03-20', cents: -5000, cat: 'food' }),
];

describe('BuildDashboardUseCase', () => {
  test('spending by category lists only expenses as positive totals, largest first', async () => {
    const data = await dashboardOver(MARCH).execute({ from: ym('2026-03'), to: ym('2026-03') });
    expect(data.spendingByCategory).toEqual([
      { categoryId: 'rent', total: { cents: 100000 } },
      { categoryId: 'food', total: { cents: 28456 } },
    ]);
  });

  test('monthly summary gives income, expense magnitude and net (AC-027)', async () => {
    const data = await dashboardOver([
      tx({ id: 'a', date: '2026-03-01', cents: 200000 }),
      tx({ id: 'b', date: '2026-03-02', cents: -123456 }),
    ]).execute({ from: ym('2026-03'), to: ym('2026-03') });
    expect(data.monthly).toEqual([
      { month: '2026-03', income: { cents: 200000 }, expense: { cents: 123456 }, net: { cents: 76544 } },
    ]);
  });

  test('includes every month of the range, with zeros for empty ones (AC-026)', async () => {
    const data = await dashboardOver([
      tx({ id: 'a', date: '2026-01-15', cents: -100 }),
      tx({ id: 'b', date: '2026-04-15', cents: -300 }),
    ]).execute({ from: ym('2025-11'), to: ym('2026-04') });
    expect(data.monthly.map((m) => m.month)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
    expect(data.monthly[0]).toEqual({
      month: '2025-11',
      income: { cents: 0 },
      expense: { cents: 0 },
      net: { cents: 0 },
    });
    expect(data.monthly[5]?.net.cents).toBe(-300);
  });

  test('crosses year boundaries', async () => {
    const data = await dashboardOver([]).execute({ from: ym('2025-12'), to: ym('2026-02') });
    expect(data.monthly.map((m) => m.month)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  test('empty index yields zeros without NaN and no categories or balances (AC-030)', async () => {
    const data = await dashboardOver([]).execute({ from: ym('2026-03'), to: ym('2026-03') });
    expect(data.spendingByCategory).toEqual([]);
    expect(data.balances).toEqual([]);
    expect(data.monthly).toHaveLength(1);
    expect(Object.is(data.monthly[0]?.net.cents, 0)).toBe(true);
  });

  test('swaps an inverted range', async () => {
    const data = await dashboardOver(MARCH).execute({ from: ym('2026-04'), to: ym('2026-03') });
    expect(data.range).toEqual({ from: '2026-03', to: '2026-04' });
  });

  test('clamps ranges longer than the maximum, keeping the most recent months', async () => {
    const data = await dashboardOver([]).execute({ from: ym('2020-01'), to: ym('2026-03') });
    expect(data.monthly).toHaveLength(DASHBOARD_MAX_MONTHS);
    expect(data.range.to).toBe('2026-03');
    expect(data.range.from).toBe('2024-04');
  });

  test('filters by account for categories, months and balances', async () => {
    const data = await dashboardOver([
      tx({ id: 'a', acc: 'a1', date: '2026-03-01', cents: -100, cat: 'x', balance: 900 }),
      tx({ id: 'b', acc: 'a2', date: '2026-03-02', cents: -700, cat: 'y', balance: 50 }),
    ]).execute({ from: ym('2026-03'), to: ym('2026-03'), accountIds: ['a2' as AccountId] });
    expect(data.spendingByCategory).toEqual([{ categoryId: 'y', total: { cents: 700 } }]);
    expect(data.monthly[0]?.expense.cents).toBe(700);
    expect(data.balances).toEqual([{ accountId: 'a2', balance: { cents: 50 }, asOf: '2026-03-02', estimated: false }]);
  });

  test('balances use the latest known balance or an estimate (AC-028)', async () => {
    const data = await dashboardOver([
      tx({ id: 'a', date: '2026-03-01', cents: -100, balance: 1000 }),
      tx({ id: 'b', date: '2026-03-05', cents: -250 }),
    ]).execute({ from: ym('2026-03'), to: ym('2026-03') });
    expect(data.balances).toEqual([
      { accountId: 'a1', balance: { cents: 750 }, asOf: '2026-03-05', estimated: true },
    ]);
  });

  test('ignores movements outside the range', async () => {
    const data = await dashboardOver([tx({ id: 'a', date: '2026-05-01', cents: -100, cat: 'x' })]).execute({
      from: ym('2026-03'),
      to: ym('2026-03'),
    });
    expect(data.spendingByCategory).toEqual([]);
  });
});
