import type { Language } from './i18n';

/** Locale `Intl` de cada idioma de la interfaz. */
export const INTL_LOCALES: Readonly<Record<Language, string>> = { es: 'es-ES', en: 'en-GB' };

const CENTS_PER_EURO = 100;
const BASIS_POINTS_PER_UNIT = 10_000;

export type DateStyle = 'short' | 'medium' | 'long';

const formatterCache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, create: () => T): T {
  const hit = formatterCache.get(key);
  if (hit) return hit as T;
  const created = create();
  formatterCache.set(key, created);
  return created;
}

function moneyFormatter(language: Language, signed: boolean): Intl.NumberFormat {
  return cached(`money:${language}:${signed}`, () =>
    new Intl.NumberFormat(INTL_LOCALES[language], {
      style: 'currency',
      currency: 'EUR',
      signDisplay: signed ? 'exceptZero' : 'auto',
    }),
  );
}

/** Importe en EUR desde céntimos. Por defecto el signo siempre es visible (+/−). */
export function formatMoney(cents: number, language: Language, signed = true): string {
  return moneyFormatter(language, signed).format(cents / CENTS_PER_EURO);
}

/** Importe abreviado para ejes de gráficos («1,2 mil €» / «€1.2K»). */
export function formatMoneyCompact(cents: number, language: Language): string {
  return cached(`moneyCompact:${language}`, () =>
    new Intl.NumberFormat(INTL_LOCALES[language], {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }),
  ).format(cents / CENTS_PER_EURO);
}

/** Porcentaje desde puntos básicos (10000 = 100 %). */
export function formatPercentFromBasisPoints(basisPoints: number, language: Language): string {
  return cached(`pct:${language}`, () =>
    new Intl.NumberFormat(INTL_LOCALES[language], { style: 'percent', maximumFractionDigits: 0 }),
  ).format(basisPoints / BASIS_POINTS_PER_UNIT);
}

/** Entero con separadores de miles del idioma. */
export function formatInteger(value: number, language: Language): string {
  return cached(`int:${language}`, () => new Intl.NumberFormat(INTL_LOCALES[language])).format(value);
}

const DATE_OPTIONS: Readonly<Record<DateStyle, Intl.DateTimeFormatOptions>> = {
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
};

/** Convierte `AAAA-MM-DD` o `AAAA-MM` en una fecha UTC (sin desfase por zona horaria). */
function toUtcDate(isoDateOrMonth: string): Date | null {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(isoDateOrMonth);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, day === undefined ? 1 : Number(day)));
}

/** Fecha ISO (`AAAA-MM-DD`) en el formato del idioma. Devuelve el texto tal cual si no es válida. */
export function formatDate(isoDate: string, language: Language, style: DateStyle = 'short'): string {
  const date = toUtcDate(isoDate);
  if (!date) return isoDate;
  return cached(`date:${language}:${style}`, () =>
    new Intl.DateTimeFormat(INTL_LOCALES[language], { ...DATE_OPTIONS[style], timeZone: 'UTC' }),
  ).format(date);
}

/** Mes (`AAAA-MM`) como «mar 2026» / «Mar 2026». */
export function formatMonth(yearMonth: string, language: Language, length: 'short' | 'long' = 'short'): string {
  const date = toUtcDate(yearMonth);
  if (!date) return yearMonth;
  return cached(`month:${language}:${length}`, () =>
    new Intl.DateTimeFormat(INTL_LOCALES[language], { month: length, year: 'numeric', timeZone: 'UTC' }),
  ).format(date);
}
