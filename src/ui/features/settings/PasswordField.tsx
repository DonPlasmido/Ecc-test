import type { ReactNode, Ref } from 'react';
import { Field } from '@/ui/components/Field';

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  isVisible: boolean;
  autoComplete: 'new-password' | 'current-password';
  hint?: ReactNode;
  error?: string | null;
  /** Id extra para `aria-describedby` (p. ej. el medidor de fortaleza). */
  extraDescribedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
};

/**
 * Campo de contraseña (a11y §7): etiqueta visible, requisitos enlazados, pegar permitido y
 * `autocomplete` correcto para los gestores de contraseñas. El valor solo vive en el estado del diálogo.
 */
export function PasswordField({
  id,
  name,
  label,
  value,
  isVisible,
  autoComplete,
  hint,
  error,
  extraDescribedBy,
  inputRef,
  onChange,
}: PasswordFieldProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(control) => (
        <input
          {...control}
          aria-describedby={[control['aria-describedby'], extraDescribedBy].filter(Boolean).join(' ') || undefined}
          ref={inputRef}
          className="input"
          type={isVisible ? 'text' : 'password'}
          name={name}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

type ShowPasswordToggleProps = {
  id: string;
  isVisible: boolean;
  label: string;
  onChange: (isVisible: boolean) => void;
};

/** Casilla «Mostrar contraseña»: cambia el `type` sin mover el foco ni perder el valor. */
export function ShowPasswordToggle({ id, isVisible, label, onChange }: ShowPasswordToggleProps) {
  return (
    <label className="check" htmlFor={id}>
      <input id={id} type="checkbox" checked={isVisible} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
