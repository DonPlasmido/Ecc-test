import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Page } from '@/ui/layout/Page';
import { ROUTES } from '@/ui/routes';
import { BackupSection } from './BackupSection';
import { DeleteAllDataSection } from './DeleteAllDataSection';
import { LanguageSelect } from './LanguageSelect';
import { StorageSection } from './StorageSection';
import { ThemeSelect } from './ThemeSelect';
import './settings.css';

/** Ajustes: apariencia, copia cifrada, almacenamiento, privacidad, reglas y borrado de datos. */
export function SettingsPage() {
  const { t } = useTranslation();
  const { t: ts } = useTranslation('settings');
  // Versión local de los datos: al restaurar o borrar se releen la última copia y el almacenamiento.
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = () => setDataVersion((version) => version + 1);

  return (
    <Page title={t('pages.settings.title')} intro={t('pages.settings.intro')}>
      <section className="card" aria-labelledby="settings-appearance">
        <div className="card__header">
          <h2 className="card__title" id="settings-appearance">
            {t('settings.appearance')}
          </h2>
        </div>
        <div className="card__section stack">
          <LanguageSelect />
          <ThemeSelect />
        </div>
      </section>
      <BackupSection dataVersion={dataVersion} onDataChanged={bumpDataVersion} />
      <StorageSection dataVersion={dataVersion} />
      <section className="card" aria-labelledby="settings-privacy">
        <div className="card__header">
          <h2 className="card__title" id="settings-privacy">
            {ts('privacy.title')}
          </h2>
        </div>
        <div className="card__section stack">
          <p className="settings-prose">{ts('privacy.local')}</p>
          <p className="settings-prose">{ts('privacy.noServer')}</p>
          <p className="settings-prose">{ts('privacy.encryption')}</p>
        </div>
      </section>
      <section className="card" aria-labelledby="settings-rules">
        <div className="card__header">
          <h2 className="card__title" id="settings-rules">
            {ts('rules.title')}
          </h2>
        </div>
        <div className="card__section stack">
          <p className="settings-prose">{ts('rules.text')}</p>
          <p>
            <Link className="settings-link" to={ROUTES.rules}>
              {ts('rules.link')}
            </Link>
          </p>
        </div>
      </section>
      <DeleteAllDataSection onDeleted={bumpDataVersion} />
    </Page>
  );
}
