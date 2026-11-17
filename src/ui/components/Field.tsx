import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Props que el control del campo debe aplicar (enlazan label, ayuda y error). */
export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': true | undefined;
  readonly 'aria-required': true | undefined;
  readonly required: boolean;
}

type FieldProps = {
  label: ReactNode;
  /** Ayuda permanente bajo la etiqueta (requisitos visibles, a11y §7). */
  hint?: ReactNode;
  /** Mensaje de error ya traducido; activa `aria-invalid` y `role="alert"`. */
  error?: string | null;
  isRequired?: boolean;
  /** Id fijo opcional; por defecto `useId`. */
  id?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

/**
 * Etiqueta + control + ayuda + error (patrón `FieldError`, a11y §14).
 * El control se pinta con render-prop para que reciba `id` y `aria-describedby`.
 */
export function Field({ label, hint, error, isRequired = false, id, className, children }: FieldProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId}`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const hasError = Boolean(error);
  const describedBy = [hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label className="field__label" htmlFor={controlId}>
        {label}
        {isRequired ? <span className="text-muted text-sm"> {t('field.required')}</span> : null}
      </label>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': hasError ? true : undefined,
        'aria-required': isRequired ? true : undefined,
        required: isRequired,
      })}
      {hasError ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
