import { useCallback, useMemo } from 'react';
import type { DashboardData } from '@/application/ports/inbound/BuildDashboard';
import type { BudgetEvaluation } from '@/application/ports/inbound/EvaluateBudgets';
import type { AppContainer } from '@/composition/container.types';
import type { Account, AccountId } from '@/domain/account/Account';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import { useAsync, type AsyncResult } from '@/ui/hooks/useAsync';
import { useContainer } from '@/ui/hooks/useContainer';
import { useTransactionIndex } from '@/ui/hooks/useTransactionIndex';
import { shiftMonth, toYearMonth, TREND_MONTHS } from './dashboardModel';

/** Todo lo que pinta el panel para un mes. */
export interface DashboardView {
  readonly month: YearMonth;
  /** Mes del movimiento más reciente: tope del selector. */
  readonly latestMonth: YearMonth;
  /** Datos del mes elegido (gasto por categoría). */
  readonly current: DashboardData;
  /** 12 meses que acaban en el elegido (evolución y comparación con el anterior). */
  readonly trend: DashboardData;
  readonly budgets: readonly BudgetEvaluation[];
  readonly categories: ReadonlyMap<CategoryId, Category>;
  readonly accounts: ReadonlyMap<AccountId, Account>;
}

export type DashboardState = { readonly kind: 'empty' } | { readonly kind: 'ready'; readonly view: DashboardView };

/** Mes del movimiento más reciente, o `null` si no hay ninguno. */
async function findLatestMonth(container: AppContainer): Promise<YearMonth | null> {
  const { resultId, total } = await container.queryTransactions.search({ filter: {}, sort: 'dateDesc' });
  if (total === 0) return null;
  const [latest] = await container.queryTransactions.page({ resultId, offset: 0, limit: 1 });
  return toYearMonth(latest?.date.slice(0, 7));
}

async function loadDashboard(container: AppContainer, requested: YearMonth | null): Promise<DashboardState> {
  const latestMonth = await findLatestMonth(container);
  if (!latestMonth) return { kind: 'empty' };
  const month = requested ?? latestMonth;
  const [current, trend, budgets, categories, accounts] = await Promise.all([
    container.buildDashboard.execute({ from: month, to: month }),
    container.buildDashboard.execute({ from: shiftMonth(month, 1 - TREND_MONTHS), to: month }),
    container.evaluateBudgets.execute({ month }),
    container.manageCatalog.listCategories(),
    container.manageCatalog.listAccounts(),
  ]);
  return {
    kind: 'ready',
    view: {
      month,
      latestMonth,
      current,
      trend,
      budgets,
      categories: new Map(categories.map((category) => [category.id, category])),
      accounts: new Map(accounts.map((account) => [account.id, account])),
    },
  };
}

/**
 * Carga el panel del mes pedido (o del último con movimientos). Se recalcula cuando cambian los datos
 * (`snapshot.version`, ADR-0005) o el mes.
 */
export function useDashboard(requested: YearMonth | null): AsyncResult<DashboardState> {
  const container = useContainer();
  const { version } = useTransactionIndex();
  // Clave de la consulta: un objeto nuevo cuando cambia el mes o la versión de los datos.
  const query = useMemo(() => ({ requested, version }), [requested, version]);
  const task = useCallback(() => loadDashboard(container, query.requested), [container, query]);
  return useAsync(task);
}
