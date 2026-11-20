import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { BudgetEvaluation } from '@/application/ports/inbound/EvaluateBudgets';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import { BudgetProgressBar } from '@/ui/components/BudgetProgressBar';
import { useCategoryName } from '@/ui/components/CategoryChip';
import { IconCheck } from '@/ui/components/icons';
import { formatMonth } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { ROUTES } from '@/ui/routes';
import { budgetsAtRisk } from './dashboardModel';

type BudgetsAtRiskProps = {
  month: YearMonth;
  budgets: readonly BudgetEvaluation[];
  categories: ReadonlyMap<CategoryId, Category>;
};

/** ¿Qué presupuesto se me va? Los 3 más consumidos entre «cerca» y «superado», con enlace a Presupuestos. */
export function BudgetsAtRisk({ month, budgets, categories }: BudgetsAtRiskProps) {
  const { t } = useTranslation('dashboard');
  const language = useLanguage();
  const categoryName = useCategoryName();
  const atRisk = budgetsAtRisk(budgets);
  const uncategorized = t('categories.uncategorized', { ns: 'common' });

  const body = (() => {
    if (budgets.length === 0) return <p className="dash-section__note">{t('budgets.none')}</p>;
    if (atRisk.length === 0) {
      return (
        <p className="status">
          <IconCheck />
          {t('budgets.allOk', { month: formatMonth(month, language, 'long') })}
        </p>
      );
    }
    return (
      <ul className="dash-budgets">
        {atRisk.map((evaluation) => {
          const category = categories.get(evaluation.categoryId);
          return (
            <li key={evaluation.budgetId}>
              <BudgetProgressBar
                label={category ? categoryName(category) : uncategorized}
                spent={evaluation.spent}
                limit={evaluation.limit}
                usedBasisPoints={evaluation.usedBasisPoints}
                status={evaluation.status}
              />
            </li>
          );
        })}
      </ul>
    );
  })();

  return (
    <section className="dash-section dash-section--budgets" aria-labelledby="dash-budgets-title">
      <h2 id="dash-budgets-title" className="dash-section__title">
        {t('budgets.heading')}
      </h2>
      {body}
      <Link className="dash-section__link" to={ROUTES.budgets}>
        {budgets.length === 0 ? t('budgets.create') : t('budgets.seeAll')}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
