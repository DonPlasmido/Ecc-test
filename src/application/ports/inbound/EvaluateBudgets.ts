import type { BudgetId } from '@/domain/budget/Budget';
import type { BudgetStatus } from '@/domain/budget/budgetStatus';
import type { CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Money } from '@/domain/money/Money';

/** Estado de un presupuesto en un mes. */
export interface BudgetEvaluation {
  readonly budgetId: BudgetId;
  readonly categoryId: CategoryId;
  readonly limit: Money;
  /** Gasto en positivo. */
  readonly spent: Money;
  /** Puede ser negativo si se supera. */
  readonly remaining: Money;
  readonly usedBasisPoints: number;
  readonly status: BudgetStatus;
}

/** Entrada de la evaluación. */
export interface EvaluateBudgetsInput {
  readonly month: YearMonth;
}

/** Evalúa los presupuestos activos en un mes. */
export interface EvaluateBudgets {
  execute(input: EvaluateBudgetsInput): Promise<readonly BudgetEvaluation[]>;
}
