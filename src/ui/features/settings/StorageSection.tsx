import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { IconCheck, IconWarning } from '@/ui/components/icons';
import { Skeleton } from '@/ui/components/Skeleton';
import { useAsync } from '@/ui/hooks/useAsync';
import { useContainer } from '@/ui/hooks/useContainer';
import { INTL_LOCALES } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { formatBytes } from './settingsModel';

/** Uso estimado del almacenamiento y si el navegador lo trata como persistente (DESIGN.md: aviso y reintento). */
export function StorageSection({ dataVersion }: { dataVersion: number }) {
  const { t } = useTranslation('settings');
  const language = useLanguage();
  const { storage } = useContainer();
  const task = useCallback(
    async () => {
      const [estimate, isPersistent] = await Promise.all([
        storage.estimate(),
        storage.requestPersistence().catch(() => false),
      ]);
      return { version: dataVersion, estimate, isPersistent };
    },
    [storage, dataVersion],
  );
  const state = useAsync(task);
  const locale = INTL_LOCALES[language];

  return (
    <section className="card" aria-labelledby="settings-storage">
      <div className="card__header">
        <h2 className="card__title" id="settings-storage">
          {t('storage.title')}
        </h2>
      </div>
      <div className="card__section stack">
        {state.status === 'loading' ? <Skeleton variant="text" count={2} hasLabel /> : null}
        {state.status === 'error' ? <p>{t('storage.unavailable')}</p> : null}
        {state.status === 'success' ? (
          <>
            <p className="settings-figure">
              {state.data.estimate
                ? t('storage.usage', {
                    used: formatBytes(state.data.estimate.usageBytes, locale),
                    quota: formatBytes(state.data.estimate.quotaBytes, locale),
                  })
                : t('storage.unavailable')}
            </p>
            {state.data.isPersistent ? (
              <p className="settings-notice" data-tone="ok">
                <IconCheck />
                <span>{t('storage.persistent')}</span>
              </p>
            ) : (
              <>
                <p className="settings-notice" data-tone="warning">
                  <IconWarning />
                  <span>{t('storage.notPersistent')}</span>
                </p>
                <div>
                  <Button isSmall onClick={state.reload}>
                    {t('storage.retry')}
                  </Button>
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
