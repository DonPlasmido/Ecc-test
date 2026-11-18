import { useTranslation } from 'react-i18next';
import type { YearMonth } from '@/domain/date/YearMonth';
import { Button } from '@/ui/components/Button';
import { formatMonth } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { shiftMonth } from './budgetsModel';

type MonthSwitcherProps = {
  month: YearMonth;
  currentMonth: YearMonth;
  onChange: (month: YearMonth) => void;
};

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

/** Selector de mes: anterior / mes visible (anunciado) / siguiente, y vuelta al mes actual. */
export function MonthSwitcher({ month, currentMonth, onChange }: MonthSwitcherProps) {
  const { t } = useTranslation('budgets');
  const language = useLanguage();
  const label = formatMonth(month, language, 'long');

  return (
    <div className="budgets-month" role="group" aria-label={t('month.label')}>
      <Button variant="quiet" isIconOnly aria-label={t('month.previous')} onClick={() => onChange(shiftMonth(month, -1))}>
        <Chevron direction="left" />
      </Button>
      <p className="budgets-month__label" aria-live="polite" aria-atomic="true">
        {label}
      </p>
      <Button variant="quiet" isIconOnly aria-label={t('month.next')} onClick={() => onChange(shiftMonth(month, 1))}>
        <Chevron direction="right" />
      </Button>
      {month === currentMonth ? null : (
        <Button variant="quiet" isSmall className="budgets-month__today" onClick={() => onChange(currentMonth)}>
          {t('month.current')}
        </Button>
      )}
    </div>
  );
}
