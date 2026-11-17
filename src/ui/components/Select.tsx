import type { ReactNode } from 'react';
import { Field } from './Field';

export interface SelectOption<V extends string> {
  readonly value: V;
  readonly label: string;
  /** Idioma del texto de la opción (p. ej. «English» con `lang="en"`, a11y §16). */
  readonly lang?: string;
  readonly isDisabled?: boolean;
}

type SelectProps<V extends string> = {
  label: ReactNode;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  hint?: ReactNode;
  error?: string | null;
  isRequired?: boolean;
  isDisabled?: boolean;
  id?: string;
  name?: string;
};

/** `<select>` nativo dentro de `Field` (preferido frente a combobox propio, a11y §3). */
export function Select<V extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  error,
  isRequired,
  isDisabled = false,
  id,
  name,
}: SelectProps<V>) {
  const byValue = new Map(options.map((option) => [option.value as string, option.value]));
  return (
    <Field label={label} hint={hint} error={error} isRequired={isRequired} id={id}>
      {(control) => (
        <select
          {...control}
          name={name}
          className="select"
          value={value}
          disabled={isDisabled}
          onChange={(event) => {
            const next = byValue.get(event.target.value);
            if (next !== undefined) onChange(next);
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} lang={option.lang} disabled={option.isDisabled}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
