import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { YearMonth } from '@/domain/date/YearMonth';
import { Button } from '@/ui/components/Button';
import { Skeleton } from '@/ui/components/Skeleton';
import { IconError } from '@/ui/components/icons';
import { Page } from '@/ui/layout/Page';
import { AccountBalances } from './AccountBalances';
import { BudgetsAtRisk } from './BudgetsAtRisk';
import { CategorySpending } from './CategorySpending';
import { DashboardEmpty } from './DashboardEmpty';
import { monthsEndingAt, PICKER_MONTHS, toYearMonth } from './dashboardModel';
import { MonthlyTrend } from './MonthlyTrend';
import { MonthPicker } from './MonthPicker';
import { SpendingHeadline } from './SpendingHeadline';
import { useDashboard, type DashboardState, type DashboardView } from './useDashboard';
import './dashboard.css';

/** Parámetro de la query del hash con el mes elegido (estado de navegación, ADR-0005). */
const MONTH_PARAM = 'mes';

/** Meses del selector: los 24 hasta el último con datos, más el pedido si queda fuera. */
function pickerMonths(view: DashboardView): readonly YearMonth[] {
  const months = monthsEndingAt(view.latestMonth, PICKER_MONTHS);
  return months.includes(view.month) ? months : [...months, view.month].sort().reverse();
}

function DashboardLoading() {
  const { t } = useTranslation('dashboard');
  return (
    <div className="dash-loading" role="status">
      <span className="visually-hidden">{t('loading')}</span>
      <Skeleton variant="text" />
      <Skeleton variant="figure" />
      <Skeleton variant="row" count={4} />
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation();
  return (
    <div className="dash-error" role="alert">
      <p className="status status--over">
        <IconError />
        {t('error')}
      </p>
      <Button onClick={onRetry}>{tc('actions.retry')}</Button>
    </div>
  );
}

type DashboardContentProps = {
  view: DashboardView;
  /** Mes pedido en la URL: el selector lo muestra ya, aunque el panel siga cargando. */
  requested: YearMonth | null;
  /** Cargando otro mes: se mantiene lo anterior (sin perder el foco del selector). */
  isRefreshing: boolean;
  onMonthChange: (month: YearMonth) => void;
};

function DashboardContent({ view, requested, isRefreshing, onMonthChange }: DashboardContentProps) {
  const months = pickerMonths(view);
  const pickerValue = requested !== null && months.includes(requested) ? requested : view.month;
  return (
    <div className="dash" aria-busy={isRefreshing || undefined}>
      <MonthPicker value={pickerValue} months={months} onChange={onMonthChange} />
      <SpendingHeadline month={view.month} monthly={view.trend.monthly} />
      <div className="dash-grid">
        <CategorySpending month={view.month} spending={view.current.spendingByCategory} categories={view.categories} />
        <BudgetsAtRisk month={view.month} budgets={view.budgets} categories={view.categories} />
        <MonthlyTrend monthly={view.trend.monthly} />
        <AccountBalances balances={view.trend.balances} accounts={view.accounts} />
      </div>
    </div>
  );
}

/**
 * Panel: responde «¿cuánto he gastado este mes y en qué?», «¿voy mejor o peor que el mes pasado?» y
 * «¿qué presupuesto se me va?». Sin movimientos, muestra el primer uso (importar o datos de ejemplo).
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = toYearMonth(searchParams.get(MONTH_PARAM));
  const result = useDashboard(requested);
  // Último resultado mostrado: al cambiar de mes no se desmonta el panel (patrón «estado del render anterior»).
  const [shown, setShown] = useState<DashboardState | null>(null);
  if (result.status === 'success' && result.data !== shown) setShown(result.data);

  const handleMonthChange = (month: YearMonth) => {
    setSearchParams({ [MONTH_PARAM]: month }, { replace: true });
  };

  const content = (() => {
    if (result.status === 'error') return <DashboardError onRetry={result.reload} />;
    const state = result.status === 'success' ? result.data : shown;
    if (!state) return <DashboardLoading />;
    if (state.kind === 'empty') return <DashboardEmpty />;
    return (
      <DashboardContent
        view={state.view}
        requested={requested}
        isRefreshing={result.status === 'loading'}
        onMonthChange={handleMonthChange}
      />
    );
  })();

  return (
    <Page title={t('pages.dashboard.title')} intro={t('pages.dashboard.intro')}>
      {content}
    </Page>
  );
}
