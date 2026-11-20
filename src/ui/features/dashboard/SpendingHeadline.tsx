import { useTranslation } from 'react-i18next';
import type { MonthlySummary } from '@/application/ports/inbound/BuildDashboard';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Cents } from '@/domain/money/Money';
import { MoneyText } from '@/ui/components/MoneyText';
import { formatMoney, formatMonth, formatPercentFromBasisPoints } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { shiftMonth, spendingVariation, summaryFor, type SpendingTrend } from './dashboardModel';

type SpendingHeadlineProps = {
  month: YearMonth;
  monthly: readonly MonthlySummary[];
};

const TREND_ARROWS: Readonly<Record<SpendingTrend, string>> = { more: '▲', less: '▼', same: '=', noBaseline: '·' };

const money = (cents: number) => ({ cents: cents as Cents });

/**
 * Cifra protagonista: lo gastado en el mes y si es más o menos que el anterior. La variación se dice
 * con palabras («más que», «menos que»); el color y la flecha solo la refuerzan (a11y 1.4.1).
 */
export function SpendingHeadline({ month, monthly }: SpendingHeadlineProps) {
  const { t } = useTranslation('dashboard');
  const language = useLanguage();
  const previousMonth = shiftMonth(month, -1);
  const current = summaryFor(monthly, month);
  const previous = summaryFor(monthly, previousMonth);
  const variation = spendingVariation(current.expense, previous.expense);
  const monthName = formatMonth(month, language, 'long');
  const previousName = formatMonth(previousMonth, language, 'long');
  const percent = formatPercentFromBasisPoints(variation.basisPoints ?? 0, language);
  const showDelta = variation.trend === 'more' || variation.trend === 'less';

  return (
    <section className="dash-hero" aria-labelledby="dash-hero-title">
      <h2 id="dash-hero-title" className="eyebrow">
        {t('headline.title', { month: monthName })}
      </h2>
      <p className="dash-hero__figure figure">{formatMoney(current.expense, language, false)}</p>
      <p className="dash-hero__delta" data-trend={variation.trend}>
        <span className="dash-hero__arrow" aria-hidden="true">
          {TREND_ARROWS[variation.trend]}
        </span>
        <span>
          {t(`headline.${variation.trend}`, { percent, month: previousName })}
          {showDelta ? (
            <span className="dash-hero__amount amount">
              {' '}
              {t('headline.delta', { amount: formatMoney(variation.deltaCents, language) })}
            </span>
          ) : null}
        </span>
      </p>
      <dl className="dash-ledger">
        <div className="dash-ledger__item">
          <dt>{t('headline.income')}</dt>
          <dd>
            <MoneyText value={money(current.income)} isUnsigned />
          </dd>
        </div>
        <div className="dash-ledger__item">
          <dt>{t('headline.expense')}</dt>
          <dd>
            <MoneyText value={money(current.expense)} isUnsigned />
          </dd>
        </div>
        <div className="dash-ledger__item dash-ledger__item--total">
          <dt>{t('headline.net')}</dt>
          <dd>
            <MoneyText value={money(current.net)} />
          </dd>
        </div>
      </dl>
    </section>
  );
}
