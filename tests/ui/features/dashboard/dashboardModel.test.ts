import { describe, expect, it } from 'vitest';
import type { BudgetEvaluation } from '@/application/ports/inbound/EvaluateBudgets';
import type { CategoryTotal, MonthlySummary } from '@/application/ports/inbound/BuildDashboard';
import type { BudgetId } from '@/domain/budget/Budget';
import type { BudgetStatus } from '@/domain/budget/budgetStatus';
import type { CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Cents } from '@/domain/money/Money';
import {
  budgetsAtRisk,
  foldCategories,
  monthsEndingAt,
  shiftMonth,
  spendingVariation,
  summaryFor,
  toYearMonth,
} from '@/ui/features/dashboard/dashboardModel';

const ym = (text: string) => text as YearMonth;
const money = (cents: number) => ({ cents: cents as Cents });
const total = (id: string, cents: number): CategoryTotal => ({ categoryId: id as CategoryId, total: money(cents) });

function evaluation(id: string, usedBasisPoints: number, status: BudgetStatus): BudgetEvaluation {
  return {
    budgetId: id as BudgetId,
    categoryId: `cat-${id}` as CategoryId,
    limit: money(10_000),
    spent: money(usedBasisPoints),
    remaining: money(10_000 - usedBasisPoints),
    usedBasisPoints,
    status,
  };
}

describe('dashboardModel', () => {
  it('accepts only valid YYYY-MM months from the URL', () => {
    expect(toYearMonth('2026-03')).toBe('2026-03');
    expect(toYearMonth('2026-13')).toBeNull();
    expect(toYearMonth('2026-3')).toBeNull();
    expect(toYearMonth(null)).toBeNull();
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth(ym('2026-01'), -1)).toBe('2025-12');
    expect(shiftMonth(ym('2025-12'), 1)).toBe('2026-01');
    expect(shiftMonth(ym('2026-03'), -11)).toBe('2025-04');
  });

  it('lists the months ending at a given one, newest first', () => {
    expect(monthsEndingAt(ym('2026-02'), 3)).toEqual(['2026-02', '2026-01', '2025-12']);
  });

  it('keeps the top categories and folds the rest into Other', () => {
    const totals = [total('a', 100), total('b', 900), total('c', 50), total('d', 25)];

    expect(foldCategories(totals, 2)).toEqual([
      { categoryId: 'b', cents: 900 },
      { categoryId: 'a', cents: 100 },
      { categoryId: null, cents: 75 },
    ]);
    expect(foldCategories(totals.slice(0, 2), 2)).toHaveLength(2);
  });

  it.each([
    [15_000, 10_000, { trend: 'more', deltaCents: 5000, basisPoints: 5000 }],
    [7500, 10_000, { trend: 'less', deltaCents: -2500, basisPoints: 2500 }],
    [10_000, 10_000, { trend: 'same', deltaCents: 0, basisPoints: 0 }],
    [10_000, 0, { trend: 'noBaseline', deltaCents: 10_000, basisPoints: null }],
    [0, 0, { trend: 'same', deltaCents: 0, basisPoints: null }],
  ])('compares %i with the previous %i', (current, previous, expected) => {
    expect(spendingVariation(current, previous)).toEqual(expected);
  });

  it('reads a month summary, or zeros when the month is missing', () => {
    const monthly: MonthlySummary[] = [
      { month: ym('2026-03'), income: money(200_000), expense: money(123_456), net: money(76_544) },
    ];
    expect(summaryFor(monthly, ym('2026-03'))).toEqual({ income: 200_000, expense: 123_456, net: 76_544 });
    expect(summaryFor(monthly, ym('2026-02'))).toEqual({ income: 0, expense: 0, net: 0 });
  });

  it('returns at most three budgets at risk, the most used first', () => {
    const evaluations = [
      evaluation('ok', 2000, 'ok'),
      evaluation('near', 8500, 'near'),
      evaluation('over', 13_000, 'over'),
      evaluation('over2', 10_100, 'over'),
      evaluation('near2', 9000, 'near'),
    ];
    expect(budgetsAtRisk(evaluations).map((item) => item.budgetId)).toEqual(['over', 'over2', 'near2']);
  });
});
