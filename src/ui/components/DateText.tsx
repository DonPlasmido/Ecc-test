import { formatDate, formatMonth, type DateStyle } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';

type DateTextProps = {
  /** `AAAA-MM-DD` (IsoDate) o `AAAA-MM` (YearMonth). */
  value: string;
  dateStyle?: DateStyle;
  className?: string;
};

const YEAR_MONTH = /^\d{4}-\d{2}$/;

/** Fecha en `<time dateTime>` formateada con `Intl.DateTimeFormat` del idioma activo (en UTC). */
export function DateText({ value, dateStyle = 'short', className }: DateTextProps) {
  const language = useLanguage();
  const text = YEAR_MONTH.test(value)
    ? formatMonth(value, language, dateStyle === 'short' ? 'short' : 'long')
    : formatDate(value, language, dateStyle);
  return (
    <time dateTime={value} className={className ? `tabular ${className}` : 'tabular'}>
      {text}
    </time>
  );
}
