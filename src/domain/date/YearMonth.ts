import type { Brand } from '@/domain/shared/brand';
import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { err, ok, type Result } from '@/domain/shared/Result';

/** Mes de calendario `'YYYY-MM'`. */
export type YearMonth = Brand<string, 'YearMonth'>;

const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/u;
const MAX_REPORTED_LENGTH = 50;

/** Valida `'YYYY-MM'` (mes 01-12). */
export function parseYearMonth(text: string): Result<YearMonth, DomainError> {
  const match = YEAR_MONTH_PATTERN.exec(text);
  const month = match === null ? 0 : Number(match[2]);
  if (month < 1 || month > 12) {
    return err(domainError('date.invalidFormat', { value: text.slice(0, MAX_REPORTED_LENGTH) }));
  }
  return ok(text as YearMonth);
}
