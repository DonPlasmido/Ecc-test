import type { Brand } from '@/domain/shared/brand';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';
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

// TODO(domain): implementar el objeto compañero en este archivo.
// export const IsoDate: IsoDateOperations = { ... };
// TODO(domain): src/domain/date/parseSpanishDate.ts (dd/mm/aaaa, dd-mm-aa, aaaa-mm-dd; siempre dd/mm)
// export function parseSpanishDate(text: string): Result<IsoDate, DomainError>;
