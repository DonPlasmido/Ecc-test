import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { IconCheck, IconWarning } from '@/ui/components/icons';
import { Skeleton } from '@/ui/components/Skeleton';
import { useAsync } from '@/ui/hooks/useAsync';
import { useContainer } from '@/ui/hooks/useContainer';
import { formatDate } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { ExportBackupDialog } from './ExportBackupDialog';
import { RestoreBackup } from './RestoreBackup';
import { BACKUP_REMINDER_DAYS, backupAge } from './settingsModel';

type BackupSectionProps = {
  /** Cambia cuando otra sección modifica los datos (p. ej. al borrarlos) para releer la última copia. */
  dataVersion: number;
  onDataChanged: () => void;
};

function LastBackup({ lastBackupAt, nowMs }: { lastBackupAt: string | undefined; nowMs: number }) {
  const { t } = useTranslation('settings');
  const language = useLanguage();
  const age = backupAge(lastBackupAt, nowMs);
  if (age.kind === 'never' || !lastBackupAt) {
    return (
      <p className="settings-notice" data-tone="warning">
        <IconWarning />
        <span>{t('backup.never')}</span>
      </p>
    );
  }
  const date = formatDate(lastBackupAt.slice(0, 10), language, 'long');
  if (age.kind === 'overdue') {
    return (
      <p className="settings-notice" data-tone="warning">
        <IconWarning />
        <span>{t('backup.overdue', { date, count: age.days, limit: BACKUP_REMINDER_DAYS })}</span>
      </p>
    );
  }
  return (
    <p className="settings-notice" data-tone="ok">
      <IconCheck />
      <span>{t('backup.last', { date })}</span>
    </p>
  );
}

/** Copia de seguridad cifrada: última copia (con recordatorio a los 30 días), exportar y restaurar (F6). */
export function BackupSection({ dataVersion, onDataChanged }: BackupSectionProps) {
  const { t } = useTranslation('settings');
  const { settings } = useContainer();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // `dataVersion` forma parte de la clave: la consulta se repite tras borrar o restaurar datos.
  const settingsTask = useCallback(
    async () => ({ version: dataVersion, lastBackupAt: (await settings.get())?.lastBackupAt }),
    [settings, dataVersion],
  );
  const current = useAsync(settingsTask);

  const refresh = () => {
    setNowMs(Date.now());
    onDataChanged();
  };

  return (
    <section className="card" aria-labelledby="settings-backup">
      <div className="card__header">
        <h2 className="card__title" id="settings-backup">
          {t('backup.title')}
        </h2>
      </div>
      <div className="card__section stack">
        <p className="settings-prose">{t('backup.text')}</p>
        {current.status === 'loading' ? <Skeleton variant="text" /> : null}
        {current.status === 'success' ? <LastBackup lastBackupAt={current.data.lastBackupAt} nowMs={nowMs} /> : null}
        {current.status === 'error' ? <p className="field__error">{t('backup.unknownLast')}</p> : null}
        <div>
          <Button variant="primary" onClick={() => setIsExportOpen(true)}>
            {t('export.open')}
          </Button>
        </div>
      </div>
      <div className="card__section stack">
        <h3 className="settings-subheading">{t('restore.heading')}</h3>
        <RestoreBackup onRestored={refresh} />
      </div>
      {isExportOpen ? <ExportBackupDialog onClose={() => setIsExportOpen(false)} onExported={refresh} /> : null}
    </section>
  );
}
