import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import type { BudgetTotals } from './budgetsModel';

type BudgetSummaryProps = {
  totals: BudgetTotals;
};

/** Total presupuestado frente a gastado, con lo disponible destacado y el recuento de riesgos (a11y §5, 1.3.1). */
export function BudgetSummary({ totals }: BudgetSummaryProps) {
  const { t } = useTranslation('budgets');
  const language = useLanguage();
  const isOverspent = totals.remaining.cents < 0;
  const risks = [
    totals.overCount > 0 ? t('summary.overCount', { count: totals.overCount }) : null,
    totals.nearCount > 0 ? t('summary.nearCount', { count: totals.nearCount }) : null,
  ].filter((text): text is string => text !== null);

  return (
    <section className="card budgets-summary" aria-labelledby="budgets-summary-title">
      <h2 className="eyebrow" id="budgets-summary-title">
        {t('summary.title')}
      </h2>
      <div className="budgets-summary__figure">
        <span className="budgets-summary__caption">
          {isOverspent ? t('summary.overspent') : t('summary.remaining')}
        </span>
        <span className={`figure ${isOverspent ? 'amount--negative' : ''}`}>
          {formatMoney(Math.abs(totals.remaining.cents), language, false)}
        </span>
      </div>
      <p className="budgets-summary__totals tabular">
        {t('summary.spentOfBudgeted', {
          spent: formatMoney(totals.spent.cents, language, false),
          budgeted: formatMoney(totals.budgeted.cents, language, false),
        })}
      </p>
      <p className="budgets-summary__risks" data-has-risks={risks.length > 0}>
        {risks.length > 0 ? risks.join(' · ') : t('summary.allOk')}
      </p>
    </section>
  );
}
