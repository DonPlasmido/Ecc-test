import type { BudgetEvaluation } from '@/application/ports/inbound/EvaluateBudgets';
import type { CategoryTotal, MonthlySummary } from '@/application/ports/inbound/BuildDashboard';
import type { CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';

/** Funciones puras del panel: meses, agrupación de categorías, variación y presupuestos en riesgo. */

const MONTHS_PER_YEAR = 12;
const YEAR_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const BASIS_POINTS_PER_UNIT = 10_000;

/** Meses de la evolución (AC-026: 12 meses). */
export const TREND_MONTHS = 12;
/** Meses que ofrece el selector hacia atrás desde el último con datos. */
export const PICKER_MONTHS = 24;
/** Categorías con barra propia; el resto se suma en «Otras» (ADR-0011: top 8 + Otras). */
export const TOP_CATEGORIES = 8;
/** Presupuestos en riesgo que se muestran. */
export const TOP_BUDGETS_AT_RISK = 3;

/** `'YYYY-MM'` válido, o `null` (la query del hash es entrada no confiable). */
export function toYearMonth(text: string | null | undefined): YearMonth | null {
  return text && YEAR_MONTH.test(text) ? (text as YearMonth) : null;
}

/** Desplaza un mes `delta` meses (negativo hacia atrás). */
export function shiftMonth(month: YearMonth, delta: number): YearMonth {
  const absolute = Number(month.slice(0, 4)) * MONTHS_PER_YEAR + Number(month.slice(5, 7)) - 1 + delta;
  const year = Math.floor(absolute / MONTHS_PER_YEAR);
  const monthOfYear = (absolute % MONTHS_PER_YEAR) + 1;
  return `${String(year).padStart(4, '0')}-${String(monthOfYear).padStart(2, '0')}` as YearMonth;
}

/** Los `count` meses que acaban en `last`, del más reciente al más antiguo. */
export function monthsEndingAt(last: YearMonth, count: number): readonly YearMonth[] {
  return Array.from({ length: count }, (_, index) => shiftMonth(last, -index));
}

export interface CategorySlice {
  /** Id de la categoría, o `null` para «Otras». */
  readonly categoryId: CategoryId | null;
  readonly cents: number;
}

/** Mantiene las `limit` mayores (ya vienen ordenadas) y suma el resto en una porción «Otras». */
export function foldCategories(totals: readonly CategoryTotal[], limit = TOP_CATEGORIES): readonly CategorySlice[] {
  const sorted = [...totals].sort((a, b) => b.total.cents - a.total.cents);
  const head = sorted.slice(0, limit).map((item) => ({ categoryId: item.categoryId, cents: item.total.cents }));
  const rest = sorted.slice(limit).reduce((sum, item) => sum + item.total.cents, 0);
  return rest > 0 ? [...head, { categoryId: null, cents: rest }] : head;
}

export type SpendingTrend = 'more' | 'less' | 'same' | 'noBaseline';

export interface SpendingVariation {
  readonly trend: SpendingTrend;
  /** Diferencia absoluta en céntimos (actual − anterior). */
  readonly deltaCents: number;
  /** Variación relativa en puntos básicos (10000 = 100 %), en valor absoluto; `null` sin base. */
  readonly basisPoints: number | null;
}

/** Variación del gasto frente al mes anterior: el texto dice «más/menos», no solo el color. */
export function spendingVariation(currentCents: number, previousCents: number): SpendingVariation {
  const deltaCents = currentCents - previousCents;
  if (previousCents <= 0) {
    return { trend: currentCents > 0 ? 'noBaseline' : 'same', deltaCents, basisPoints: null };
  }
  const basisPoints = Math.round((Math.abs(deltaCents) / previousCents) * BASIS_POINTS_PER_UNIT);
  if (deltaCents === 0) return { trend: 'same', deltaCents, basisPoints: 0 };
  return { trend: deltaCents > 0 ? 'more' : 'less', deltaCents, basisPoints };
}

/** Resumen de un mes de la serie, o ceros si no está (meses sin movimientos muestran 0). */
export function summaryFor(monthly: readonly MonthlySummary[], month: YearMonth): {
  readonly income: number;
  readonly expense: number;
  readonly net: number;
} {
  const found = monthly.find((item) => item.month === month);
  return {
    income: found?.income.cents ?? 0,
    expense: found?.expense.cents ?? 0,
    net: found?.net.cents ?? 0,
  };
}

/** Presupuestos «cerca» o «superados», del más consumido al menos, como mucho `limit`. */
export function budgetsAtRisk(
  evaluations: readonly BudgetEvaluation[],
  limit = TOP_BUDGETS_AT_RISK,
): readonly BudgetEvaluation[] {
  return evaluations
    .filter((evaluation) => evaluation.status !== 'ok')
    .sort((a, b) => b.usedBasisPoints - a.usedBasisPoints)
    .slice(0, limit);
}
