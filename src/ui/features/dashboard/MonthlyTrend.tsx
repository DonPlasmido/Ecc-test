import { useTranslation } from 'react-i18next';
import type { MonthlySummary } from '@/application/ports/inbound/BuildDashboard';
import type { YearMonth } from '@/domain/date/YearMonth';
import { LineChart, type LineSeries } from '@/ui/components/charts/LineChart';
import { INTL_LOCALES, formatMoney, formatMonth } from '@/ui/i18n/format';
import type { Language } from '@/ui/i18n/i18n';
import { useLanguage } from '@/ui/i18n/useLanguage';

type MonthlyTrendProps = {
  monthly: readonly MonthlySummary[];
};

/** Etiqueta corta de eje («mar 26»): 12 meses caben a 320 px sin solaparse. */
function shortMonth(month: YearMonth, language: Language): string {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  return new Intl.DateTimeFormat(INTL_LOCALES[language], { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
    date,
  );
}

/**
 * ¿Mejor o peor que otros meses? Ingresos frente a gastos de 12 meses en un solo eje (nunca doble eje).
 * Colores validados para daltonismo (azul tinta / teja, no verde/rojo) y gasto con trazo discontinuo.
 */
export function MonthlyTrend({ monthly }: MonthlyTrendProps) {
  const { t } = useTranslation('dashboard');
  const language = useLanguage();
  const first = monthly[0];
  const last = monthly.at(-1);
  if (!first || !last) return null;

  const series: LineSeries[] = [
    {
      key: 'income',
      label: t('trend.income'),
      values: monthly.map((item) => item.income.cents),
      color: 'var(--dash-income)',
    },
    {
      key: 'expense',
      label: t('trend.expense'),
      values: monthly.map((item) => item.expense.cents),
      color: 'var(--dash-expense)',
      isDashed: true,
    },
  ];
  const active = monthly.filter((item) => item.expense.cents > 0 || item.income.cents > 0);
  const average = active.length > 0 ? Math.round(active.reduce((sum, item) => sum + item.expense.cents, 0) / active.length) : 0;

  return (
    <section className="dash-section dash-section--trend" aria-labelledby="dash-trend-title">
      <h2 id="dash-trend-title" className="dash-section__title">
        {t('trend.heading')}
      </h2>
      <LineChart
        title={t('trend.chartTitle', {
          from: formatMonth(first.month, language, 'long'),
          to: formatMonth(last.month, language, 'long'),
        })}
        labels={monthly.map((item) => shortMonth(item.month, language))}
        series={series}
        labelColumn={t('trend.column')}
      />
      <p className="dash-section__note">{t('trend.average', { amount: formatMoney(average, language, false) })}</p>
    </section>
  );
}
