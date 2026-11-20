import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  /** Efecto de la acción: descripción del diálogo (a11y §15). */
  description: ReactNode;
  confirmLabel: string;
  isBusy?: boolean;
  /** Error ya traducido de un intento anterior. */
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/** Confirmación de una acción destructiva; el foco inicial va a «Cancelar», nunca al botón destructivo. */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  isBusy = false,
  error = null,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation('rules');
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button variant="danger" isBusy={isBusy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
