import type { CategoryTotal, MonthlySummary } from '@/application/ports/inbound/BuildDashboard';
import type { BudgetEvaluation } from '@/application/ports/inbound/EvaluateBudgets';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import type { BudgetStatus } from '@/domain/budget/budgetStatus';
import { UNCATEGORIZED, type Category, type CategoryId } from '@/domain/category/Category';
import { parseYearMonth, type YearMonth } from '@/domain/date/YearMonth';
import { Money, type Cents } from '@/domain/money/Money';
import { parseSpanishAmount } from '@/domain/money/parseSpanishAmount';
import { err, ok, type Result } from '@/domain/shared/Result';

const MONTHS_PER_YEAR = 12;
const CENTS_PER_EURO = 100;
/** Meses previos sobre los que se calcula el gasto medio de la sugerencia. */
export const SUGGESTION_MONTHS = 3;
/** Cuántas categorías principales se sugieren. */
export const SUGGESTION_LIMIT = 3;

const STATUS_RANK: Readonly<Record<BudgetStatus, number>> = { over: 0, near: 1, ok: 2 };

/** Mes de calendario local de `date` (`YYYY-MM`). */
export function yearMonthOf(date: Date): YearMonth {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}` as YearMonth;
}

/** Mes válido a partir de un texto (p. ej. `?mes=` de la URL) o `null`. */
export function parseMonthParam(text: string | null): YearMonth | null {
  if (text === null) return null;
  const parsed = parseYearMonth(text);
  return parsed.ok ? parsed.value : null;
}

/** Desplaza un mes `delta` meses (negativo hacia atrás). */
export function shiftMonth(month: YearMonth, delta: number): YearMonth {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const index = year * MONTHS_PER_YEAR + (monthNumber - 1) + delta;
  const nextYear = Math.floor(index / MONTHS_PER_YEAR);
  const nextMonth = (index % MONTHS_PER_YEAR) + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}` as YearMonth;
}

/** Ordena por riesgo: superados, cerca y bien; dentro de cada grupo, mayor % usado primero. */
export function sortByRisk(
  evaluations: readonly BudgetEvaluation[],
  nameOf: (categoryId: CategoryId) => string,
): readonly BudgetEvaluation[] {
  return [...evaluations].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.usedBasisPoints - a.usedBasisPoints ||
      nameOf(a.categoryId).localeCompare(nameOf(b.categoryId)),
  );
}

/** Totales del mes: presupuestado, gastado y restante, y cuántos superados o cerca. */
export interface BudgetTotals {
  readonly budgeted: Money;
  readonly spent: Money;
  readonly remaining: Money;
  readonly overCount: number;
  readonly nearCount: number;
}

export function summarize(evaluations: readonly BudgetEvaluation[]): BudgetTotals {
  const budgeted = Money.sum(evaluations.map((e) => e.limit));
  const spent = Money.sum(evaluations.map((e) => e.spent));
  return {
    budgeted,
    spent,
    remaining: Money.subtract(budgeted, spent),
    overCount: evaluations.filter((e) => e.status === 'over').length,
    nearCount: evaluations.filter((e) => e.status === 'near').length,
  };
}

/** Categorías que admiten presupuesto: de gasto, activas y distintas de «Sin categoría». */
export function isBudgetableCategory(category: Category): boolean {
  return category.kind === 'expense' && !category.archived && category.id !== UNCATEGORIZED;
}

/**
 * Categorías elegibles para un presupuesto que empieza en `month` y no termina: excluye las que ya tienen
 * uno que se solape (salvo el que se edita), para no provocar `budget.duplicateCategory`.
 */
export function availableCategories(
  categories: readonly Category[],
  budgets: readonly Budget[],
  month: YearMonth,
  editingId: BudgetId | null,
): readonly Category[] {
  const taken = new Set(
    budgets
      .filter((b) => b.id !== editingId && (b.endMonth === null || b.endMonth >= month))
      .map((b) => b.categoryId),
  );
  return categories.filter((c) => isBudgetableCategory(c) && !taken.has(c.id));
}

/** Meses de la serie con algún movimiento (la media de sugerencias no cuenta los vacíos); al menos 1. */
export function monthsWithData(monthly: readonly MonthlySummary[]): number {
  return Math.max(1, monthly.filter((m) => m.income.cents > 0 || m.expense.cents > 0).length);
}

/** Sugerencia de límite: gasto medio mensual redondeado hacia arriba al euro. */
export interface BudgetSuggestion {
  readonly categoryId: CategoryId;
  readonly monthlyLimit: Money;
}

export function suggestLimits(
  spending: readonly CategoryTotal[],
  eligible: readonly Category[],
  months: number = SUGGESTION_MONTHS,
): readonly BudgetSuggestion[] {
  const eligibleIds = new Set(eligible.map((c) => c.id));
  return spending
    .filter((total) => eligibleIds.has(total.categoryId) && total.total.cents > 0)
    .slice(0, SUGGESTION_LIMIT)
    .map((total) => {
      const euros = Math.ceil(total.total.cents / months / CENTS_PER_EURO);
      return { categoryId: total.categoryId, monthlyLimit: { cents: (euros * CENTS_PER_EURO) as Cents } };
    });
}

/** Motivo por el que el límite escrito no es válido (clave i18n en `form.errors`). */
export type LimitInputError = 'required' | 'format' | 'notPositive';

/** Interpreta el límite escrito (`300`, `300,50`, `1.200 €`): positivo y con 2 decimales como máximo. */
export function parseLimitInput(text: string): Result<Money, LimitInputError> {
  if (text.trim() === '') return err('required');
  const parsed = parseSpanishAmount(text);
  if (!parsed.ok) return err('format');
  if (parsed.value.cents <= 0) return err('notPositive');
  return ok(parsed.value);
}

/** Texto inicial del campo a partir de un importe (`300,00`). */
export function limitToInput(limit: Money): string {
  const euros = Math.trunc(limit.cents / CENTS_PER_EURO);
  const cents = String(Math.abs(limit.cents % CENTS_PER_EURO)).padStart(2, '0');
  return `${euros},${cents}`;
}
