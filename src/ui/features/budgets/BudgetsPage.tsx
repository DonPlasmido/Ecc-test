import { useTranslation } from 'react-i18next';
import { Page } from '@/ui/layout/Page';
import { PlaceholderNotice } from '@/ui/layout/PlaceholderNotice';

/** Presupuestos. TODO(features/budgets): `evaluateBudgets` + BudgetProgressBar por categoría. */
export function BudgetsPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('pages.budgets.title')} intro={t('pages.budgets.intro')}>
      <PlaceholderNotice />
    </Page>
  );
}
