import { beforeEach, describe, expect, it } from 'vitest';
import { EvaluateBudgetsUseCase } from '@/application/use-cases/EvaluateBudgetsUseCase';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import type { CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { TransactionId } from '@/domain/transaction/Transaction';
import { isoDate, money, tx } from '../../domain/builders';
import { createWorld, type World } from '../harness';

const FOOD = 'cat-groceries' as CategoryId;
const FUN = 'cat-leisure' as CategoryId;
const MARCH = '2026-03' as YearMonth;

let w: World;
let seq = 0;

function budget(overrides: Partial<Budget> = {}): Budget {
  return { id: 'b1' as BudgetId, categoryId: FOOD, monthlyLimit: money(10_000), startMonth: '2026-01' as YearMonth, endMonth: null, ...overrides };
}

async function put(date: string, cents: number, categoryId: CategoryId = FOOD): Promise<void> {
  seq += 1;
  w.state.transactions.set(`t${seq}`, tx({ id: `t${seq}` as TransactionId, dedupKey: `k${seq}#0` as DedupKey, date: isoDate(date), amount: money(cents), categoryId }));
}

function evaluate(month: YearMonth = MARCH) {
  return new EvaluateBudgetsUseCase({ budgets: w.budgets, transactions: w.transactions }).execute({ month });
}

beforeEach(() => {
  w = createWorld();
  seq = 0;
});

describe('EvaluateBudgetsUseCase', () => {
  it('returns an empty list without budgets', async () => {
    expect(await evaluate()).toEqual([]);
  });

  it('sums only the expenses of the budget category within the month', async () => {
    await w.budgets.save(budget());
    await put('2026-03-01', -2_000);
    await put('2026-03-31', -3_000);
    await put('2026-02-28', -9_999);
    await put('2026-04-01', -9_999);
    await put('2026-03-10', -9_999, FUN);

    const [result] = await evaluate();

    expect(result).toEqual({ budgetId: 'b1', categoryId: FOOD, limit: money(10_000), spent: money(5_000), remaining: money(5_000), usedBasisPoints: 5_000, status: 'ok' });
  });

  it('lets refunds in the same category reduce the spending, never below zero', async () => {
    await w.budgets.save(budget());
    await put('2026-03-01', -3_000);
    await put('2026-03-02', 1_000);

    const [partial] = await evaluate();
    await put('2026-03-03', 50_000);
    const [excess] = await evaluate();

    expect(partial?.spent).toEqual(money(2_000));
    expect(excess?.spent).toEqual(money(0));
    expect(excess?.status).toBe('ok');
  });

  it('flags near at 80 percent and over beyond the limit with negative remaining', async () => {
    await w.budgets.save(budget());
    await put('2026-03-01', -8_000);
    const [near] = await evaluate();
    await put('2026-03-02', -2_500);
    const [over] = await evaluate();

    expect(near?.status).toBe('near');
    expect(over).toMatchObject({ status: 'over', remaining: money(-500), usedBasisPoints: 10_500 });
  });

  it('only includes budgets active in the month (both bounds inclusive)', async () => {
    await w.budgets.save(budget({ id: 'future' as BudgetId, categoryId: FUN, startMonth: '2026-04' as YearMonth }));
    await w.budgets.save(budget({ id: 'past' as BudgetId, categoryId: 'cat-health' as CategoryId, endMonth: '2026-02' as YearMonth }));
    await w.budgets.save(budget({ id: 'edgeStart' as BudgetId, categoryId: 'cat-travel' as CategoryId, startMonth: MARCH }));
    await w.budgets.save(budget({ id: 'edgeEnd' as BudgetId, categoryId: 'cat-gifts' as CategoryId, endMonth: MARCH }));

    const results = await evaluate();

    expect(results.map((r) => r.budgetId).sort()).toEqual(['edgeEnd', 'edgeStart']);
  });

  it('handles a zero-limit budget as over once anything is spent', async () => {
    await w.budgets.save(budget({ monthlyLimit: money(0) }));
    await put('2026-03-01', -1);

    const [result] = await evaluate();

    expect(result).toMatchObject({ status: 'over', usedBasisPoints: 0 });
  });
});
