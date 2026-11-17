import { useId, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { BudgetStatus } from '@/domain/budget/budgetStatus';
import type { Money } from '@/domain/money/Money';
import { formatMoney, formatPercentFromBasisPoints } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { IconCheck, IconError, IconWarning } from './icons';

type BudgetProgressBarProps = {
  /** Nombre de la categoría (encabezado de la fila). */
  label: string;
  /** Gasto en positivo. */
  spent: Money;
  limit: Money;
  /** 10000 = 100 %; puede superar 10000. */
  usedBasisPoints: number;
  status: BudgetStatus;
};

const FULL_BASIS_POINTS = 10_000;
const STATUS_ICONS = { ok: IconCheck, near: IconWarning, over: IconError } as const;

/**
 * Barra de presupuesto: estado con texto + icono + color (+ rayado si se supera), a11y §5.
 * La barra es decorativa (`aria-hidden`); el texto lo dice todo, también el exceso (> 100 %).
 */
export function BudgetProgressBar({ label, spent, limit, usedBasisPoints, status }: BudgetProgressBarProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const labelId = useId();
  const Icon = STATUS_ICONS[status];
  const ratio = Math.max(0, usedBasisPoints) / FULL_BASIS_POINTS;
  const meterStyle = { '--meter-value': ratio.toFixed(4) } as CSSProperties;
  const amounts = t('budget.spentOfLimit', {
    spent: formatMoney(Math.abs(spent.cents), language, false),
    limit: formatMoney(Math.abs(limit.cents), language, false),
  });
  const statusClass = status === 'ok' ? 'status' : `status status--${status}`;

  return (
    <div className="budget-meter" data-status={status} style={meterStyle} role="group" aria-labelledby={labelId}>
      <div className="budget-meter__legend">
        <span id={labelId} className="truncate">
          {label}
        </span>
        <span className={statusClass}>
          <Icon />
          {t(`budget.${status}`)}
        </span>
      </div>
      <div className="budget-meter__track" aria-hidden="true">
        <span className="budget-meter__fill" />
        <span className="budget-meter__threshold" />
      </div>
      <p className="budget-meter__legend text-muted">
        <span>{amounts}</span>
        <span>{formatPercentFromBasisPoints(usedBasisPoints, language)}</span>
      </p>
    </div>
  );
}
