import { useTranslation } from 'react-i18next';
import type { YearMonth } from '@/domain/date/YearMonth';
import { Button } from '@/ui/components/Button';
import { Select, type SelectOption } from '@/ui/components/Select';
import { formatMonth } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';

type MonthPickerProps = {
  value: YearMonth;
  /** Meses elegibles, del más reciente al más antiguo. */
  months: readonly YearMonth[];
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
      <path d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  );
}

/** Selector de mes: `<select>` nativo + botones anterior/siguiente (sin selector de fecha propio, a11y §3). */
export function MonthPicker({ value, months, onChange }: MonthPickerProps) {
  const { t } = useTranslation('dashboard');
  const language = useLanguage();
  const index = months.indexOf(value);
  const newer = index > 0 ? months[index - 1] : undefined;
  const older = index >= 0 ? months[index + 1] : undefined;
  const options: readonly SelectOption<YearMonth>[] = months.map((month) => ({
    value: month,
    label: formatMonth(month, language, 'long'),
  }));

  return (
    <div className="dash-picker">
      <Button
        isIconOnly
        aria-label={t('picker.previous')}
        disabled={!older}
        onClick={() => older && onChange(older)}
      >
        <Chevron direction="left" />
      </Button>
      <div className="dash-picker__select">
        <Select label={t('picker.label')} value={value} options={options} onChange={onChange} />
      </div>
      <Button isIconOnly aria-label={t('picker.next')} disabled={!newer} onClick={() => newer && onChange(newer)}>
        <Chevron direction="right" />
      </Button>
    </div>
  );
}
