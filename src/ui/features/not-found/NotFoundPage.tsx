import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Page } from '@/ui/layout/Page';
import { ROUTES } from '@/ui/routes';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('pages.notFound.title')} intro={t('pages.notFound.text')}>
      <p>
        <Link to={ROUTES.dashboard}>{t('pages.notFound.back')}</Link>
      </p>
    </Page>
  );
}
