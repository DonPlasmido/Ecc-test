import type {
  BudgetEvaluation,
  EvaluateBudgets,
  EvaluateBudgetsInput,
} from '@/application/ports/inbound/EvaluateBudgets';
import type { BudgetRepository } from '@/application/ports/outbound/CatalogRepositories';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import { readAll } from '@/application/use-cases/applyRules';
import { budgetStatus } from '@/domain/budget/budgetStatus';
import type { Budget } from '@/domain/budget/Budget';
import { IsoDate } from '@/domain/date/IsoDate';
import type { YearMonth } from '@/domain/date/YearMonth';
import { Money } from '@/domain/money/Money';

export interface EvaluateBudgetsDeps {
  readonly budgets: BudgetRepository;
  readonly transactions: TransactionRepository;
}

/** Un presupuesto está activo en `month` si `start <= month <= end` (fin opcional). */
export function isBudgetActive(budget: Budget, month: YearMonth): boolean {
  return budget.startMonth <= month && (budget.endMonth === null || month <= budget.endMonth);
}

/** Evalúa los presupuestos activos de un mes contra el gasto neto de su categoría. */
export class EvaluateBudgetsUseCase implements EvaluateBudgets {
  constructor(private readonly deps: EvaluateBudgetsDeps) {}

  async execute(input: EvaluateBudgetsInput): Promise<readonly BudgetEvaluation[]> {
    const active = (await this.deps.budgets.list()).filter((b) => isBudgetActive(b, input.month));
    if (active.length === 0) return [];
    const netByCategory = new Map<string, Money>();
    for (const tx of await readAll(this.deps.transactions)) {
      if (IsoDate.toYearMonth(tx.date) !== input.month) continue;
      netByCategory.set(tx.categoryId, Money.add(netByCategory.get(tx.categoryId) ?? Money.zero(), tx.amount));
    }
    return active.map((budget) => {
      const net = netByCategory.get(budget.categoryId) ?? Money.zero();
      const spent = Money.isExpense(net) ? Money.negate(net) : Money.zero();
      const limit = budget.monthlyLimit;
      return {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        limit,
        spent,
        remaining: Money.subtract(limit, spent),
        usedBasisPoints: Money.ratioBasisPoints(spent, limit),
        status: budgetStatus(spent, limit),
      };
    });
  }
}
