import type { Brand } from '@/domain/shared/brand';

/** Mes de calendario `'YYYY-MM'`. */
export type YearMonth = Brand<string, 'YearMonth'>;

// TODO(domain): si hace falta, constructor validado en este archivo.
// export function parseYearMonth(text: string): Result<YearMonth, DomainError>;
