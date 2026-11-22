import {
  DASHBOARD_MAX_MONTHS,
  type BuildDashboard,
  type BuildDashboardInput,
  type CategoryTotal,
  type DashboardData,
  type MonthlySummary,
} from '@/application/ports/inbound/BuildDashboard';
import { monthFromNumber, monthNumber } from '@/application/read-model/monthMath';
import type { MonthCategoryTotals, TransactionIndex } from '@/application/read-model/TransactionIndex';
import { TRANSFERS_CATEGORY_ID, type CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Cents } from '@/domain/money/Money';

export interface BuildDashboardDeps {
  readonly index: TransactionIndex;
}

const cents = (n: number): { readonly cents: Cents } => ({ cents: n as Cents });

/** Normaliza el rango: orden correcto y como mucho `DASHBOARD_MAX_MONTHS` meses (los más recientes). */
function normalizeRange(from: YearMonth, to: YearMonth): { first: number; last: number } {
  const a = monthNumber(from);
  const b = monthNumber(to);
  const last = Math.max(a, b);
  const first = Math.max(Math.min(a, b), last - DASHBOARD_MAX_MONTHS + 1);
  return { first, last };
}

function monthlySummaries(totals: MonthCategoryTotals, first: number, last: number): MonthlySummary[] {
  const result: MonthlySummary[] = [];
  for (let n = first; n <= last; n += 1) {
    const month = monthFromNumber(n);
    let income = 0;
    let expense = 0;
    for (const [categoryId, cell] of totals.get(month) ?? []) {
      if (categoryId === TRANSFERS_CATEGORY_ID) continue;
      income += cell.income.cents;
      expense += cell.expense.cents;
    }
    result.push({ month, income: cents(income), expense: cents(expense), net: cents(income - expense || 0) });
  }
  return result;
}

/** Gasto neto por categoría y mes (gastos − devoluciones), igual que en presupuestos; sin traspasos. */
function spendingByCategory(totals: MonthCategoryTotals): CategoryTotal[] {
  const sums = new Map<CategoryId, number>();
  for (const byCategory of totals.values()) {
    for (const [categoryId, cell] of byCategory) {
      if (categoryId === TRANSFERS_CATEGORY_ID) continue;
      const net = cell.expense.cents - cell.income.cents;
      if (net > 0) sums.set(categoryId, (sums.get(categoryId) ?? 0) + net);
    }
  }
  return [...sums.entries()]
    .map(([categoryId, total]) => ({ categoryId, total: cents(total) }))
    .sort((a, b) => b.total.cents - a.total.cents || a.categoryId.localeCompare(b.categoryId));
}

/** Agrega el panel (gasto por categoría, evolución mensual, saldos) sobre el índice en memoria. */
export class BuildDashboardUseCase implements BuildDashboard {
  constructor(private readonly deps: BuildDashboardDeps) {}

  execute(input: BuildDashboardInput): Promise<DashboardData> {
    const { index } = this.deps;
    const { first, last } = normalizeRange(input.from, input.to);
    const from = monthFromNumber(first);
    const to = monthFromNumber(last);
    const totals = index.totalsByMonthAndCategory(from, to, input.accountIds);
    return Promise.resolve({
      range: { from, to },
      spendingByCategory: spendingByCategory(totals),
      monthly: monthlySummaries(totals, first, last),
      balances: index.latestBalances(input.accountIds),
    });
  }
}
