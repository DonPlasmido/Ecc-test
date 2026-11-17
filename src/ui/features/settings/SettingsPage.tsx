import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Page } from '@/ui/layout/Page';
import { PlaceholderNotice } from '@/ui/layout/PlaceholderNotice';
import { ROUTES } from '@/ui/routes';
import { LanguageSelect } from './LanguageSelect';
import { ThemeSelect } from './ThemeSelect';

/** Ajustes: idioma y tema operativos; copia de seguridad pendiente. */
export function SettingsPage() {
  const { t } = useTranslation();
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
      <section className="card" aria-labelledby="settings-backup">
        <div className="card__header">
          <h2 className="card__title" id="settings-backup">
            {t('settings.backup.title')}
          </h2>
        </div>
        <div className="card__section stack">
          <p>{t('settings.backup.text')}</p>
          {/* TODO(features/settings): BackupSection con exportEncryptedBackup / importEncryptedBackup. */}
          <PlaceholderNotice />
        </div>
      </section>
      <p>
        <Link to={ROUTES.rules}>{t('settings.rulesLink')}</Link>
      </p>
    </Page>
  );
}
