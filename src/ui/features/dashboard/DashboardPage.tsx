import { useTranslation } from 'react-i18next';
import { Page } from '@/ui/layout/Page';
import { PlaceholderNotice } from '@/ui/layout/PlaceholderNotice';

/** Panel. TODO(features/dashboard): gráficos con `buildDashboard` (BarChart, LineChart). */
export function DashboardPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('pages.dashboard.title')} intro={t('pages.dashboard.intro')}>
      <PlaceholderNotice />
    </Page>
  );
}
