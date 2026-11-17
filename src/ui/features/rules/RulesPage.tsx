import { useTranslation } from 'react-i18next';
import { Page } from '@/ui/layout/Page';
import { PlaceholderNotice } from '@/ui/layout/PlaceholderNotice';

/** Reglas. TODO(features/rules): lista ordenable y edición con `manageCatalog`. */
export function RulesPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('pages.rules.title')} intro={t('pages.rules.intro')}>
      <PlaceholderNotice />
    </Page>
  );
}
