import { useCallback } from 'react';
import type { BudgetEvaluation } from '@/application/ports/inbound/EvaluateBudgets';
import type { Budget } from '@/domain/budget/Budget';
import type { Category } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import { useAsync, type AsyncResult } from '@/ui/hooks/useAsync';
import { useContainer } from '@/ui/hooks/useContainer';
import { useTransactionIndex } from '@/ui/hooks/useTransactionIndex';
import { availableCategories, shiftMonth, suggestLimits, SUGGESTION_MONTHS, type BudgetSuggestion } from './budgetsModel';

/** Todo lo que necesita la pantalla para un mes. */
export interface BudgetsData {
  readonly evaluations: readonly BudgetEvaluation[];
  readonly budgets: readonly Budget[];
  readonly categories: readonly Category[];
  /** Solo si no hay presupuestos en el mes: límites sugeridos por gasto medio. */
  readonly suggestions: readonly BudgetSuggestion[];
}

/**
 * Carga evaluaciones, presupuestos, categorías y (si el mes está vacío) sugerencias.
 * Se invalida al cambiar de mes, al cambiar los datos (`snapshot.version`) o con `revision`.
 */
export function useBudgetsData(month: YearMonth, revision: number): AsyncResult<BudgetsData> {
  const { evaluateBudgets, manageCatalog, buildDashboard } = useContainer();
  const { version } = useTransactionIndex();

  const task = useCallback(async (): Promise<BudgetsData> => {
    // `revision` y `version` forman parte de la clave de la consulta (ADR-0005).
    void revision;
    void version;
    const [evaluations, budgets, categories] = await Promise.all([
      evaluateBudgets.execute({ month }),
      manageCatalog.listBudgets(),
      manageCatalog.listCategories(),
    ]);
    if (evaluations.length > 0) return { evaluations, budgets, categories, suggestions: [] };
    const dashboard = await buildDashboard.execute({
      from: shiftMonth(month, -SUGGESTION_MONTHS),
      to: shiftMonth(month, -1),
    });
    const eligible = availableCategories(categories, budgets, month, null);
    return { evaluations, budgets, categories, suggestions: suggestLimits(dashboard.spendingByCategory, eligible) };
  }, [evaluateBudgets, manageCatalog, buildDashboard, month, revision, version]);

  return useAsync(task);
}
