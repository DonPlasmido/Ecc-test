import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useRegisterDialogHost } from './Toast';
import { IconClose } from './icons';

type DialogProps = {
  isOpen: boolean;
  /** Se llama al pulsar Escape, el botón cerrar o desde el pie. */
  onClose: () => void;
  title: ReactNode;
  /** Efecto de la acción (`aria-describedby`). */
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Primer elemento útil a enfocar; por defecto el título (a11y §4). */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

function openModal(dialog: HTMLDialogElement): void {
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    // Entornos sin `showModal` (jsdom): se abre sin modalidad; el trap real se prueba en Playwright.
    dialog.setAttribute('open', '');
  }
}

function closeModal(dialog: HTMLDialogElement): void {
  if (!dialog.open) return;
  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

/**
 * `<dialog>` nativo con `showModal()` (inert del fondo, trap y Escape nativos).
 * Foco inicial en `initialFocusRef` o el título; al cerrar, devuelve el foco al elemento que lo abrió.
 */
export function Dialog({ isOpen, onClose, title, description, children, footer, initialFocusRef }: DialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const registerHost = useRegisterDialogHost();
  const onCloseRef = useRef(onClose);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-desc`;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return undefined;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openModal(dialog);
    const unregisterHost = registerHost?.(dialog);
    (initialFocusRef?.current ?? titleRef.current)?.focus();

    const handleCancel = (event: Event) => {
      event.preventDefault(); // React controla `isOpen`
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      unregisterHost?.();
      closeModal(dialog);
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen, initialFocusRef, registerHost]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      {isOpen ? (
        <>
          <div className="dialog__header">
            <h2 className="dialog__title" id={titleId} ref={titleRef} tabIndex={-1}>
              {title}
            </h2>
            <Button variant="quiet" isIconOnly aria-label={t('actions.close')} onClick={onClose}>
              <IconClose />
            </Button>
          </div>
          <div className="dialog__body stack">
            {description ? <p id={descriptionId}>{description}</p> : null}
            {children}
          </div>
          {footer ? <div className="dialog__footer">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}
