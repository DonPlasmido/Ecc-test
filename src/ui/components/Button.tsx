import type { ButtonHTMLAttributes, MouseEvent, Ref } from 'react';

export type ButtonVariant = 'secondary' | 'primary' | 'quiet' | 'danger';

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-busy'> & {
  variant?: ButtonVariant;
  isSmall?: boolean;
  isBlock?: boolean;
  /** Botón solo-icono: exige `aria-label` traducido (a11y T2). */
  isIconOnly?: boolean;
  /** Operación en curso: `aria-busy` y `aria-disabled` (conserva el foco, a11y §7). */
  isBusy?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

function buttonClassName(
  variant: ButtonVariant,
  isSmall: boolean,
  isBlock: boolean,
  isIconOnly: boolean,
  extra: string | undefined,
): string {
  return [
    'btn',
    variant === 'secondary' ? null : `btn--${variant}`,
    isSmall ? 'btn--sm' : null,
    isBlock ? 'btn--block' : null,
    isIconOnly ? 'btn--icon' : null,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Botón nativo con las variantes de `components.css`. `type="button"` por defecto. */
export function Button({
  variant = 'secondary',
  isSmall = false,
  isBlock = false,
  isIconOnly = false,
  isBusy = false,
  className,
  type = 'button',
  onClick,
  ref,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isBusy) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={buttonClassName(variant, isSmall, isBlock, isIconOnly, className)}
      aria-busy={isBusy || undefined}
      aria-disabled={isBusy || rest['aria-disabled'] || undefined}
      onClick={handleClick}
    />
  );
}
