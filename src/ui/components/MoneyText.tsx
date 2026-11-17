import { useTranslation } from 'react-i18next';
import type { Money } from '@/domain/money/Money';
import { formatMoney } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';

type MoneyTextProps = {
  value: Money;
  /** Añade «gasto»/«ingreso» oculto para lectores de pantalla (a11y §2.4). */
  hasKindLabel?: boolean;
  /** Cifra destacada con la serif de libro de cuentas. */
  isFigure?: boolean;
  /** Sin signo (p. ej. límites de presupuesto, siempre positivos). */
  isUnsigned?: boolean;
  className?: string;
};

function toneClass(cents: number): string {
  if (cents > 0) return 'amount--positive';
  if (cents < 0) return 'amount--negative';
  return 'amount--zero';
}

/**
 * Importe en EUR con `Intl.NumberFormat` y `signDisplay: 'exceptZero'`: el signo siempre se ve,
 * el color nunca es la única pista (DESIGN.md §3). Cifras tabulares vía `.amount`.
 */
export function MoneyText({ value, hasKindLabel = false, isFigure = false, isUnsigned = false, className }: MoneyTextProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const cents = value.cents;
  const classes = ['amount', isUnsigned ? null : toneClass(cents), isFigure ? 'figure' : null, className]
    .filter(Boolean)
    .join(' ');
  const kind = cents < 0 ? t('money.expense') : t('money.income');
  return (
    <span className={classes}>
      {formatMoney(cents, language, !isUnsigned)}
      {hasKindLabel && cents !== 0 ? <span className="visually-hidden">{` (${kind})`}</span> : null}
    </span>
  );
}
