import type { AccountId } from '@/domain/account/Account';
import type { CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Money } from '@/domain/money/Money';

/** Máximo de meses por serie del panel. */
export const DASHBOARD_MAX_MONTHS = 24;

/** Rango de meses, ambos incluidos. */
export interface MonthRange {
  readonly from: YearMonth;
  readonly to: YearMonth;
}

/** Gasto total de una categoría en el rango. */
export interface CategoryTotal {
  readonly categoryId: CategoryId;
  readonly total: Money;
}

/** Ingresos, gastos y neto de un mes. */
export interface MonthlySummary {
  readonly month: YearMonth;
  readonly income: Money;
  readonly expense: Money;
  readonly net: Money;
}

/** Saldo de una cuenta según el último movimiento con saldo. */
export interface AccountBalance {
  readonly accountId: AccountId;
  readonly balance: Money;
  readonly asOf: IsoDate | null;
}

/** Datos ya agregados para los gráficos del panel. */
export interface DashboardData {
  readonly range: MonthRange;
  readonly spendingByCategory: readonly CategoryTotal[];
  readonly monthly: readonly MonthlySummary[];
  readonly balances: readonly AccountBalance[];
}

/** Entrada del panel. */
export interface BuildDashboardInput {
  readonly from: YearMonth;
  readonly to: YearMonth;
  readonly accountIds?: readonly AccountId[];
}

/** Construye el panel sobre el índice en memoria. */
export interface BuildDashboard {
  execute(input: BuildDashboardInput): Promise<DashboardData>;
}
