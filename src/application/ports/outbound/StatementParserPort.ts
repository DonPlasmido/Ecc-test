import type { RawTable } from '@/domain/import/RawTable';
import type { StatementFile } from '@/domain/import/StatementFile';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';

/** Convierte un archivo de extracto (CSV/XLSX) en `RawTable`. Nunca usa `parseFloat` sobre importes. */
export interface StatementParserPort {
  /** Por extensión o firma de bytes. */
  supports(file: StatementFile): boolean;
  parse(file: StatementFile): Promise<Result<RawTable, DomainError>>;
}
