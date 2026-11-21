import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { IconError } from '@/ui/components/icons';
import { Skeleton } from '@/ui/components/Skeleton';
import { Page } from '@/ui/layout/Page';
import { CategoriesSection } from './CategoriesSection';
import { RulesSection } from './RulesSection';
import { useCatalog } from './useCatalog';
import './rules.css';

/** Reglas y categorías (F2): reglas por prioridad con su recuento y el catálogo de categorías. */
export function RulesPage() {
  const { t } = useTranslation('rules');
  const { t: tc } = useTranslation();
  const { state, reload, updateRules, updateCategories } = useCatalog();

  return (
    <Page title={t('title')} intro={t('intro')}>
      {state.status === 'loading' ? (
        <div className="rules-loading" role="status">
          <span className="visually-hidden">{t('loading')}</span>
          <Skeleton variant="row" count={4} />
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div className="rules-error" role="alert">
          <p className="status status--over">
            <IconError />
            {t('loadError')}
          </p>
          <Button onClick={reload}>{tc('actions.retry')}</Button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <RulesSection rules={state.rules} categories={state.categories} onRulesChange={updateRules} />
          <CategoriesSection categories={state.categories} rules={state.rules} onRulesChange={updateRules} onCategoriesChange={updateCategories} />
        </>
      ) : null}
    </Page>
  );
}
