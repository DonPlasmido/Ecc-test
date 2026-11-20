import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';

type DeleteBudgetDialogProps = {
  /** Nombre de la categoría del presupuesto a borrar; `null` = cerrado. */
  categoryName: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Confirmación de borrado: efecto explícito, foco inicial en «Cancelar» (a11y §15). */
export function DeleteBudgetDialog({ categoryName, isDeleting, onCancel, onConfirm }: DeleteBudgetDialogProps) {
  const { t } = useTranslation('budgets');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const category = categoryName ?? '';

  return (
    <Dialog
      isOpen={categoryName !== null}
      onClose={onCancel}
      title={t('delete.title', { category })}
      description={t('delete.description')}
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} onClick={onCancel}>
            {t('delete.cancel')}
          </Button>
          <Button variant="danger" isBusy={isDeleting} onClick={onConfirm}>
            {t('delete.confirm')}
          </Button>
        </>
      }
    />
  );
}
