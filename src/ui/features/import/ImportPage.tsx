import { useTranslation } from 'react-i18next';
import { Page } from '@/ui/layout/Page';
import { PlaceholderNotice } from '@/ui/layout/PlaceholderNotice';

/** Importar extracto. TODO(features/import): selector de archivo, mapeo de columnas y vista previa. */
export function ImportPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('pages.import.title')} intro={t('pages.import.intro')}>
      <PlaceholderNotice />
    </Page>
  );
}
