import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MIN_BACKUP_PASSWORD_LENGTH } from '@/application/ports/inbound/ExportEncryptedBackup';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { IconWarning } from '@/ui/components/icons';
import { useNotifications } from '@/ui/components/Toast';
import { useContainer } from '@/ui/hooks/useContainer';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { PasswordField, ShowPasswordToggle } from './PasswordField';
import { downloadFile, exportPasswordProblem, passwordStrength, STRENGTH_LEVEL, type PasswordProblem } from './settingsModel';

type ExportBackupDialogProps = {
  onClose: () => void;
  /** Tras descargar la copia (para refrescar «última copia»). */
  onExported: () => void;
};

function StrengthMeter({ id, password }: { id: string; password: string }) {
  const { t } = useTranslation('settings');
  const strength = passwordStrength(password);
  return (
    <div className="settings-strength" data-level={STRENGTH_LEVEL[strength]}>
      <div className="settings-strength__track" aria-hidden="true">
        <span className="settings-strength__fill" />
      </div>
      <p className="settings-strength__label text-sm" id={id}>
        {t('export.strength.label', { value: t(`export.strength.${strength}`) })}
      </p>
    </div>
  );
}

/**
 * Exportar copia cifrada (a11y §7): contraseña + confirmación con requisitos visibles, medidor de fortaleza
 * y aviso de que no hay recuperación. Se monta solo mientras está abierto: al cerrarse se desmonta y las
 * contraseñas desaparecen con su estado (nunca se guardan ni se registran).
 */
export function ExportBackupDialog({ onClose, onExported }: ExportBackupDialogProps) {
  const { t } = useTranslation('settings');
  const { exportEncryptedBackup } = useContainer();
  const { notify } = useNotifications();
  const baseId = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [problem, setProblem] = useState<PasswordProblem | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const formId = `${baseId}-form`;
  const strengthId = `${baseId}-strength`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    const found = exportPasswordProblem(password, confirmation);
    setProblem(found);
    setFailure(null);
    if (found) {
      (found.kind === 'tooShort' ? passwordRef : confirmationRef).current?.focus();
      return;
    }
    setIsBusy(true);
    const result = await exportEncryptedBackup.execute({ password }).catch(() => null);
    setIsBusy(false);
    if (!result?.ok) {
      setFailure(errorMessage(t, result?.error));
      return;
    }
    downloadFile(result.value.fileName, result.value.bytes);
    notify({ tone: 'success', message: t('export.done', { file: result.value.fileName }) });
    onExported();
    onClose();
  };

  const footer = (
    <>
      <Button variant="quiet" onClick={onClose}>
        {t('actions.cancel')}
      </Button>
      <Button variant="primary" type="submit" form={formId} isBusy={isBusy}>
        {t('export.submit')}
      </Button>
    </>
  );

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={t('export.title')}
      description={t('export.description')}
      footer={footer}
      initialFocusRef={passwordRef}
    >
      <p className="settings-warning">
        <IconWarning />
        <span>{t('export.noRecovery')}</span>
      </p>
      <form id={formId} className="stack" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <PasswordField
          id={`${baseId}-password`}
          name="backup-password"
          label={t('password.label')}
          value={password}
          isVisible={isVisible}
          autoComplete="new-password"
          hint={t('export.requirements', { min: MIN_BACKUP_PASSWORD_LENGTH })}
          error={problem?.kind === 'tooShort' ? t('export.tooShort', { min: MIN_BACKUP_PASSWORD_LENGTH, count: problem.missing }) : null}
          extraDescribedBy={strengthId}
          inputRef={passwordRef}
          onChange={(value) => {
            setPassword(value);
            // El error se corrige al editar: no se queda un mensaje obsoleto junto a un valor ya válido.
            setProblem(null);
          }}
        />
        <StrengthMeter id={strengthId} password={password} />
        <PasswordField
          id={`${baseId}-confirmation`}
          name="backup-password-confirmation"
          label={t('password.confirmLabel')}
          value={confirmation}
          isVisible={isVisible}
          autoComplete="new-password"
          error={problem?.kind === 'mismatch' ? t('export.mismatch') : null}
          inputRef={confirmationRef}
          onChange={(value) => {
            setConfirmation(value);
            setProblem(null);
          }}
        />
        <ShowPasswordToggle id={`${baseId}-show`} isVisible={isVisible} label={t('password.show')} onChange={setIsVisible} />
        {failure ? (
          <p className="field__error" role="alert">
            {failure}
          </p>
        ) : null}
        <p className="text-sm text-muted" role="status">
          {isBusy ? t('export.busy') : ''}
        </p>
      </form>
    </Dialog>
  );
}
