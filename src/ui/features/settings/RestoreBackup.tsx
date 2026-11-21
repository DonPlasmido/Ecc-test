import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BACKUP_FILE_EXTENSION, BACKUP_MAGIC_TEXT } from '@/application/ports/inbound/ExportEncryptedBackup';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { useNotifications } from '@/ui/components/Toast';
import { useContainer } from '@/ui/hooks/useContainer';
import { domainError } from '@/domain/shared/DomainError';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { formatDate, formatInteger } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { PasswordField, ShowPasswordToggle } from './PasswordField';

const INPUT_ID = 'settings-restore-file';

type RestoreBackupProps = {
  /** Tras restaurar (para refrescar «última copia» y el almacenamiento). */
  onRestored: () => void;
};

/**
 * Restaurar copia: elegir archivo → confirmar que se reemplazan TODOS los datos (foco en «Cancelar»,
 * a11y §15) → contraseña. Un fallo (contraseña errónea, archivo dañado) no modifica nada.
 */
export function RestoreBackup({ onRestored }: RestoreBackupProps) {
  const { t } = useTranslation('settings');
  const { t: tErrors } = useTranslation('errors');
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'confirm' | 'password' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = `${INPUT_ID}-hint`;

  const [formatError, setFormatError] = useState<string | null>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    // Se vacía para que volver a elegir el mismo archivo dispare `change` otra vez.
    event.target.value = '';
    setFormatError(null);
    if (!chosen) return;
    // Cabecera comprobada ANTES de pedir confirmación y contraseña.
    const head = await chosen.slice(0, BACKUP_MAGIC_TEXT.length).text().catch(() => '');
    if (head !== BACKUP_MAGIC_TEXT) {
      setFormatError(errorMessage(tErrors, domainError('backup.invalidFormat')));
      return;
    }
    setFile(chosen);
    setStep('confirm');
  };

  const close = () => {
    setStep(null);
    setFile(null);
    inputRef.current?.focus();
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={INPUT_ID}>
        {t('restore.fileLabel')}
      </label>
      <p className="field__hint" id={hintId}>
        {t('restore.fileHint')}
      </p>
      <input
        ref={inputRef}
        id={INPUT_ID}
        className="settings-file"
        type="file"
        accept={`${BACKUP_FILE_EXTENSION},application/octet-stream`}
        aria-describedby={hintId}
        onChange={(event) => void handleChange(event)}
      />
      {formatError ? (
        <p className="field__error" role="alert">
          {formatError}
        </p>
      ) : null}
      {file && step === 'confirm' ? (
        <ConfirmReplaceDialog fileName={file.name} onCancel={close} onContinue={() => setStep('password')} />
      ) : null}
      {file && step === 'password' ? (
        <RestorePasswordDialog
          file={file}
          onClose={close}
          onRestored={() => {
            close();
            onRestored();
          }}
        />
      ) : null}
    </div>
  );
}

type ConfirmReplaceDialogProps = {
  fileName: string;
  onCancel: () => void;
  onContinue: () => void;
};

function ConfirmReplaceDialog({ fileName, onCancel, onContinue }: ConfirmReplaceDialogProps) {
  const { t } = useTranslation('settings');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const footer = (
    <>
      <Button ref={cancelRef} variant="quiet" onClick={onCancel}>
        {t('actions.cancel')}
      </Button>
      <Button variant="danger" onClick={onContinue}>
        {t('restore.confirm.continue')}
      </Button>
    </>
  );
  return (
    <Dialog
      isOpen
      onClose={onCancel}
      title={t('restore.confirm.title')}
      description={t('restore.confirm.description', { file: fileName })}
      footer={footer}
      initialFocusRef={cancelRef}
    />
  );
}

type RestorePasswordDialogProps = {
  file: File;
  onClose: () => void;
  onRestored: () => void;
};

function RestorePasswordDialog({ file, onClose, onRestored }: RestorePasswordDialogProps) {
  const { t } = useTranslation('settings');
  const language = useLanguage();
  const { importEncryptedBackup } = useContainer();
  const { notify } = useNotifications();
  const baseId = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const formId = `${baseId}-form`;

  const restore = async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return importEncryptedBackup.execute({ bytes, password });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    if (password === '') {
      setError(t('restore.passwordRequired'));
      passwordRef.current?.focus();
      return;
    }
    setIsBusy(true);
    setError(null);
    const result = await restore().catch(() => null);
    setIsBusy(false);
    if (!result?.ok) {
      setError(errorMessage(t, result?.error));
      passwordRef.current?.focus();
      return;
    }
    notify({
      tone: 'success',
      message: t('restore.done', {
        count: result.value.transactions,
        formattedCount: formatInteger(result.value.transactions, language),
        date: formatDate(result.value.exportedAt.slice(0, 10), language, 'medium'),
      }),
    });
    onRestored();
  };

  // Con la restauración en curso no se puede cerrar (ni con Escape ni con la X).
  const handleClose = () => {
    if (!isBusy) onClose();
  };

  const footer = (
    <>
      <Button variant="quiet" onClick={onClose} disabled={isBusy}>
        {t('actions.cancel')}
      </Button>
      <Button variant="danger" type="submit" form={formId} isBusy={isBusy}>
        {t('restore.submit')}
      </Button>
    </>
  );

  return (
    <Dialog
      isOpen
      onClose={handleClose}
      title={t('restore.title')}
      description={t('restore.description', { file: file.name })}
      footer={footer}
      initialFocusRef={passwordRef}
    >
      <form id={formId} className="stack" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <PasswordField
          id={`${baseId}-password`}
          name="backup-password"
          label={t('password.label')}
          value={password}
          isVisible={isVisible}
          autoComplete="current-password"
          hint={t('restore.passwordHint')}
          error={error}
          inputRef={passwordRef}
          onChange={setPassword}
        />
        <ShowPasswordToggle id={`${baseId}-show`} isVisible={isVisible} label={t('password.show')} onChange={setIsVisible} />
        <p className="text-sm text-muted" role="status">
          {isBusy ? t('restore.busy') : ''}
        </p>
      </form>
    </Dialog>
  );
}
