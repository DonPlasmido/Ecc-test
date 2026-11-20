import type { Brand } from '@/domain/shared/brand';
import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { err, ok, type Result } from '@/domain/shared/Result';
import type { YearMonth } from '@/domain/date/YearMonth';

/** Fecha de calendario `'YYYY-MM-DD'` sin zona horaria; orden lexicográfico = cronológico. */
export type IsoDate = Brand<string, 'IsoDate'>;

/** Operaciones puras del VO `IsoDate` (forma del objeto compañero `IsoDate`). */
export interface IsoDateOperations {
  /** Valida fecha real (30/02 falla). */
  parse(text: string): Result<IsoDate, DomainError>;
  toYearMonth(d: IsoDate): YearMonth;
  /** Días desde 1970-01-01 (para `Int32Array` del índice). */
  toEpochDay(d: IsoDate): number;
  fromEpochDay(n: number): IsoDate;
  compare(a: IsoDate, b: IsoDate): -1 | 0 | 1;
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const MAX_REPORTED_LENGTH = 50;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : (DAYS_IN_MONTH[month - 1] ?? 0);
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/** Construye una `IsoDate` validando que el día exista en el calendario. */
export function isoDateFromParts(year: number, month: number, day: number): Result<IsoDate, DomainError> {
  const valid =
    Number.isInteger(year) && year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
  if (!valid) {
    return err(domainError('date.invalidDate', { value: `${year}-${month}-${day}` }));
  }
  return ok(`${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as IsoDate);
}

/** Días desde 1970-01-01 (algoritmo de calendario civil, sin `Date`). */
function epochDayOf(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

function partsOf(d: IsoDate): readonly [number, number, number] {
  return [Number(d.slice(0, 4)), Number(d.slice(5, 7)), Number(d.slice(8, 10))];
}

/** Objeto compañero de `IsoDate`. */
export const IsoDate: IsoDateOperations = {
  parse(text) {
    const match = ISO_PATTERN.exec(text);
    if (match === null) {
      return err(domainError('date.invalidFormat', { value: text.slice(0, MAX_REPORTED_LENGTH) }));
    }
    return isoDateFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  },
  toYearMonth: (d) => d.slice(0, 7) as YearMonth,
  toEpochDay(d) {
    const [year, month, day] = partsOf(d);
    return epochDayOf(year, month, day);
  },
  fromEpochDay(n) {
    const z = n + 719_468;
    const era = Math.floor(z / 146_097);
    const dayOfEra = z - era * 146_097;
    const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1_460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365);
    const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
    const shifted = Math.floor((5 * dayOfYear + 2) / 153);
    const day = dayOfYear - Math.floor((153 * shifted + 2) / 5) + 1;
    const month = shifted < 10 ? shifted + 3 : shifted - 9;
    const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
    return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as IsoDate;
  },
  compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
};
