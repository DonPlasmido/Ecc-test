import type { CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Money } from '@/domain/money/Money';
import type { Brand } from '@/domain/shared/brand';

/** Identificador de presupuesto. */
export type BudgetId = Brand<string, 'BudgetId'>;

/** Presupuesto mensual por categoría (uno activo por categoría). */
export interface Budget {
  readonly id: BudgetId;
  readonly categoryId: CategoryId;
  /** Positivo. */
  readonly monthlyLimit: Money;
  readonly startMonth: YearMonth;
  /** `null` = sin fin. */
  readonly endMonth: YearMonth | null;
}
