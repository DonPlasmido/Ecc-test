import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { IconImport } from '@/ui/components/icons';
import { ROUTES } from '@/ui/routes';

/** Enlace a importar con el extracto de ejemplo (la pantalla Importar lo ofrece directamente). */
export const SAMPLE_IMPORT_PATH = `${ROUTES.import}?ejemplo=1`;

const STEPS = ['step1', 'step2', 'step3'] as const;

/**
 * Primer uso (AC-030): una página de libro en blanco con tres pasos y dos salidas, importar el extracto
 * propio o probar con datos de ejemplo (time-to-value < 30 s de demostración, PRODUCT-BRIEF §2).
 */
export function DashboardEmpty() {
  const { t } = useTranslation('dashboard');
  return (
    <section className="dash-empty" aria-labelledby="dash-empty-title">
      <h2 id="dash-empty-title" className="dash-empty__title">
        {t('empty.title')}
      </h2>
      <p className="dash-empty__text">{t('empty.text')}</p>
      <ol className="dash-empty__steps" aria-label={t('empty.stepsLabel')}>
        {STEPS.map((step) => (
          <li key={step}>{t(`empty.${step}`)}</li>
        ))}
      </ol>
      <div className="dash-empty__actions">
        <Link className="btn btn--primary" to={ROUTES.import}>
          <IconImport />
          {t('empty.import')}
        </Link>
        <Link className="btn btn--quiet" to={SAMPLE_IMPORT_PATH}>
          {t('empty.sample')}
        </Link>
      </div>
    </section>
  );
}
