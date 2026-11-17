import type { YearMonth } from '@/domain/date/YearMonth';

const MONTHS_PER_YEAR = 12;

/** Número de mes absoluto (año × 12 + mes - 1) de un `YearMonth`. */
export function monthNumber(month: YearMonth): number {
  return Number(month.slice(0, 4)) * MONTHS_PER_YEAR + Number(month.slice(5, 7)) - 1;
}

/** Inversa de `monthNumber`. */
export function monthFromNumber(n: number): YearMonth {
  const year = Math.floor(n / MONTHS_PER_YEAR);
  const month = (n % MONTHS_PER_YEAR) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}` as YearMonth;
}

/** Primer día (`YYYY-MM-01`) del mes absoluto `n`. */
export function firstDayOfMonthNumber(n: number): string {
  return `${monthFromNumber(n)}-01`;
}
