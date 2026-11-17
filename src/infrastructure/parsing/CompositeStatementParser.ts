import type { StatementParserPort } from '@/application/ports/outbound/StatementParserPort';
import type { RawTable } from '@/domain/import/RawTable';
import type { StatementFile } from '@/domain/import/StatementFile';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';
import { ExcelJsXlsxParser, hasZipMagic } from './ExcelJsXlsxParser';
import { PapaCsvParser } from './PapaCsvParser';
import { checkFileSize, extensionOf, failure } from './parseResult';

const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];

function startsWith(bytes: ArrayBuffer, magic: readonly number[]): boolean {
  if (bytes.byteLength < magic.length) return false;
  const head = new Uint8Array(bytes, 0, magic.length);
  return magic.every((b, i) => head[i] === b);
}

type Route = 'csv' | 'xlsx' | 'unsupported';

function route(file: StatementFile, csv: StatementParserPort, xlsx: StatementParserPort): Route {
  if (extensionOf(file.name) === 'xls') return 'unsupported';
  if (startsWith(file.bytes, OLE2_MAGIC) || startsWith(file.bytes, PDF_MAGIC)) return 'unsupported';
  if (hasZipMagic(file.bytes) || xlsx.supports(file)) return 'xlsx';
  return csv.supports(file) ? 'csv' : 'unsupported';
}

/** Elige parser por extensión y firma de bytes; rechaza `.xls` antiguo, vacíos y > 20 MB. */
export class CompositeStatementParser implements StatementParserPort {
  constructor(
    private readonly csv: StatementParserPort = new PapaCsvParser(),
    private readonly xlsx: StatementParserPort = new ExcelJsXlsxParser(),
  ) {}

  supports(file: StatementFile): boolean {
    return route(file, this.csv, this.xlsx) !== 'unsupported';
  }

  async parse(file: StatementFile): Promise<Result<RawTable, DomainError>> {
    const sizeError = checkFileSize(file);
    if (sizeError) return sizeError;

    const target = route(file, this.csv, this.xlsx);
    if (target === 'csv') return this.csv.parse(file);
    if (target === 'xlsx') return this.xlsx.parse(file);
    return failure('import.unsupportedFormat', { value: extensionOf(file.name) });
  }
}
