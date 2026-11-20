import type { StatementParserPort } from '@/application/ports/outbound/StatementParserPort';
import type { RawTable } from '@/domain/import/RawTable';
import type { StatementFile } from '@/domain/import/StatementFile';
import type { DomainError, DomainErrorCode } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';

/** Fake en memoria de `StatementParserPort`: devuelve un resultado fijo y registra las llamadas. */
export class InMemoryStatementParser implements StatementParserPort {
  readonly parsedNames: string[] = [];

  private constructor(
    private readonly outcome: Result<RawTable, DomainError>,
    private readonly extensions: readonly string[],
  ) {}

  static returning(table: RawTable, extensions: readonly string[] = ['csv']): InMemoryStatementParser {
    return new InMemoryStatementParser({ ok: true, value: table }, extensions);
  }

  static failing(code: DomainErrorCode, extensions: readonly string[] = ['csv']): InMemoryStatementParser {
    return new InMemoryStatementParser({ ok: false, error: { code } }, extensions);
  }

  supports(file: StatementFile): boolean {
    const dot = file.name.lastIndexOf('.');
    return dot >= 0 && this.extensions.includes(file.name.slice(dot + 1).toLowerCase());
  }

  async parse(file: StatementFile): Promise<Result<RawTable, DomainError>> {
    this.parsedNames.push(file.name);
    return this.outcome;
  }
}
