import { describe, expect, it } from 'vitest';
import type { BudgetEvaluation } from '@/application/ports/inbound/EvaluateBudgets';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import type { BudgetStatus } from '@/domain/budget/budgetStatus';
import { UNCATEGORIZED, type Category, type CategoryId } from '@/domain/category/Category';
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories';
import type { YearMonth } from '@/domain/date/YearMonth';
import {
  availableCategories,
  limitToInput,
  parseLimitInput,
  parseMonthParam,
  shiftMonth,
  sortByRisk,
  suggestLimits,
  summarize,
  yearMonthOf,
} from '@/ui/features/budgets/budgetsModel';
import { money } from '../../fixtures';

const ym = (text: string) => text as YearMonth;
const cat = (slug: string) => `cat-${slug}` as CategoryId;

function evaluation(slug: string, spent: number, limit: number, status: BudgetStatus): BudgetEvaluation {
  return {
    budgetId: `b-${slug}` as BudgetId,
    categoryId: cat(slug),
    limit: money(limit),
    spent: money(spent),
    remaining: money(limit - spent),
    usedBasisPoints: Math.floor((spent * 10_000) / limit),
    status,
  };
}

function budget(slug: string, startMonth: string, endMonth: string | null = null): Budget {
  return {
    id: `b-${slug}` as BudgetId,
    categoryId: cat(slug),
    monthlyLimit: money(10_000),
    startMonth: ym(startMonth),
    endMonth: endMonth === null ? null : ym(endMonth),
  };
}

describe('month helpers', () => {
  it('derives the local calendar month of a date', () => {
    expect(yearMonthOf(new Date(2026, 0, 31))).toBe('2026-01');
    expect(yearMonthOf(new Date(2026, 11, 1))).toBe('2026-12');
  });

  it.each([
    ['2026-03', -1, '2026-02'],
    ['2026-01', -1, '2025-12'],
    ['2026-12', 1, '2027-01'],
    ['2026-03', -3, '2025-12'],
    ['2026-03', 0, '2026-03'],
  ])('shifts %s by %i months to %s', (from, delta, expected) => {
    expect(shiftMonth(ym(from), delta)).toBe(expected);
  });

  it('accepts only valid YYYY-MM month params', () => {
    expect(parseMonthParam('2026-03')).toBe('2026-03');
    expect(parseMonthParam('2026-13')).toBeNull();
    expect(parseMonthParam('marzo')).toBeNull();
    expect(parseMonthParam(null)).toBeNull();
  });
});

describe('sortByRisk', () => {
  it('lists over, then near, then ok, with the highest usage first inside each group', () => {
    // Arrange
    const evaluations = [
      evaluation('ok-low', 1_000, 10_000, 'ok'),
      evaluation('near', 8_500, 10_000, 'near'),
      evaluation('over-small', 10_100, 10_000, 'over'),
      evaluation('ok-high', 7_000, 10_000, 'ok'),
      evaluation('over-big', 20_000, 10_000, 'over'),
    ];

    // Act
    const sorted = sortByRisk(evaluations, (id) => id);

    // Assert
    expect(sorted.map((e) => e.categoryId)).toEqual([
      cat('over-big'),
      cat('over-small'),
      cat('near'),
      cat('ok-high'),
      cat('ok-low'),
    ]);
  });

  it('breaks ties by category name and does not mutate the input', () => {
    const evaluations = [evaluation('b', 0, 100, 'ok'), evaluation('a', 0, 100, 'ok')];
    const sorted = sortByRisk(evaluations, (id) => id);
    expect(sorted.map((e) => e.categoryId)).toEqual([cat('a'), cat('b')]);
    expect(evaluations[0]?.categoryId).toBe(cat('b'));
  });
});

describe('summarize', () => {
  it('adds budgeted and spent, and counts over and near budgets', () => {
    const totals = summarize([
      evaluation('a', 30_001, 30_000, 'over'),
      evaluation('b', 24_000, 30_000, 'near'),
      evaluation('c', 0, 10_000, 'ok'),
    ]);
    expect(totals.budgeted.cents).toBe(70_000);
    expect(totals.spent.cents).toBe(54_001);
    expect(totals.remaining.cents).toBe(15_999);
    expect(totals.overCount).toBe(1);
    expect(totals.nearCount).toBe(1);
  });

  it('returns zeros for an empty month', () => {
    const totals = summarize([]);
    expect(totals.budgeted.cents).toBe(0);
    expect(totals.overCount).toBe(0);
  });
});

describe('availableCategories', () => {
  it('keeps active expense categories without an overlapping budget', () => {
    // Arrange
    const budgets = [
      budget('groceries', '2026-01'),
      budget('transport', '2025-01', '2026-02'),
      budget('housing', '2026-06'),
    ];

    // Act
    const ids = availableCategories(DEFAULT_CATEGORIES, budgets, ym('2026-03'), null).map((c) => c.id);

    // Assert
    expect(ids).not.toContain(cat('groceries'));
    expect(ids).toContain(cat('transport'));
    expect(ids).not.toContain(cat('housing'));
    expect(ids).not.toContain(UNCATEGORIZED);
    expect(ids).not.toContain(cat('salary'));
    expect(ids).not.toContain(cat('transfers'));
  });

  it('keeps the category of the budget being edited', () => {
    const ids = availableCategories(DEFAULT_CATEGORIES, [budget('groceries', '2026-01')], ym('2026-03'), 'b-groceries' as BudgetId).map(
      (c) => c.id,
    );
    expect(ids).toContain(cat('groceries'));
  });

  it('excludes archived categories', () => {
    const archived: Category = { ...(DEFAULT_CATEGORIES[1] as Category), archived: true };
    expect(availableCategories([archived], [], ym('2026-03'), null)).toEqual([]);
  });
});

describe('suggestLimits', () => {
  it('suggests the monthly average of the top eligible categories, rounded up to whole euros', () => {
    // Arrange
    const spending = [
      { categoryId: UNCATEGORIZED, total: money(90_000) },
      { categoryId: cat('groceries'), total: money(75_010) },
      { categoryId: cat('housing'), total: money(60_000) },
      { categoryId: cat('transport'), total: money(3_000) },
      { categoryId: cat('leisure'), total: money(1_000) },
    ];

    // Act
    const eligible = availableCategories(DEFAULT_CATEGORIES, [], ym('2026-04'), null);
    const suggestions = suggestLimits(spending, eligible, 3);

    // Assert
    expect(suggestions).toEqual([
      { categoryId: cat('groceries'), monthlyLimit: money(25_100) },
      { categoryId: cat('housing'), monthlyLimit: money(20_000) },
      { categoryId: cat('transport'), monthlyLimit: money(1_000) },
    ]);
  });

  it('suggests nothing without spending history', () => {
    expect(suggestLimits([], DEFAULT_CATEGORIES)).toEqual([]);
  });
});

describe('parseLimitInput', () => {
  it.each([
    ['300', 30_000],
    ['300,00', 30_000],
    ['300,5', 30_050],
    ['1.200,50 €', 120_050],
    ['300.25', 30_025],
  ])('accepts %s as %i cents', (text, cents) => {
    const parsed = parseLimitInput(text);
    expect(parsed.ok && parsed.value.cents).toBe(cents);
  });

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['12,345', 'format'],
    ['abc', 'format'],
    ['0', 'notPositive'],
    ['-5', 'notPositive'],
  ])('rejects %j as %s (AC-021)', (text, reason) => {
    const parsed = parseLimitInput(text);
    expect(parsed.ok ? null : parsed.error).toBe(reason);
  });

  it('formats a limit back into the field text', () => {
    expect(limitToInput(money(30_000))).toBe('300,00');
    expect(limitToInput(money(12_345))).toBe('123,45');
    expect(limitToInput(money(5))).toBe('0,05');
  });
});
