import type { CellValue, Workbook, Worksheet } from 'exceljs';
import type { StatementParserPort } from '@/application/ports/outbound/StatementParserPort';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { RawCell, RawTable } from '@/domain/import/RawTable';
import type { StatementFile } from '@/domain/import/StatementFile';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';
import { MAX_ROWS } from './limits';
import { inspectZip } from './zipGuard';
import { checkFileSize, extensionOf, failure, okResult } from './parseResult';

const XLSX_EXTENSIONS: ReadonlySet<string> = new Set(['xlsx', 'xlsm']);
const ZIP_MAGIC = [0x50, 0x4b];
const EMPTY: RawCell = { kind: 'empty' };

export function hasZipMagic(bytes: ArrayBuffer): boolean {
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  return head.length === 2 && ZIP_MAGIC.every((b, i) => head[i] === b);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function dateToCell(date: Date): RawCell {
  const year = date.getUTCFullYear();
  if (Number.isNaN(year) || year < 1 || year > 9999) return EMPTY;
  const iso = `${pad(year, 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
  return { kind: 'date', value: iso as IsoDate };
}

function textToCell(value: string): RawCell {
  const text = value.trim();
  return text === '' ? EMPTY : { kind: 'text', value: text };
}

/** Convierte el valor de una celda de ExcelJS; las fórmulas aportan su resultado, nunca se evalúan. */
function valueToCell(value: CellValue): RawCell {
  if (value === null || value === undefined) return EMPTY;
  if (typeof value === 'string') return textToCell(value);
  if (typeof value === 'number') return Number.isFinite(value) ? { kind: 'number', value } : EMPTY;
  if (typeof value === 'boolean') return { kind: 'text', value: String(value) };
  if (value instanceof Date) return dateToCell(value);
  if ('richText' in value) return textToCell(value.richText.map((part) => part.text).join(''));
  if ('formula' in value || 'sharedFormula' in value) return valueToCell(value.result ?? null);
  if ('hyperlink' in value) return valueToCell(value.text);
  if ('error' in value) return textToCell(value.error);
  return EMPTY;
}

function sheetToRows(sheet: Worksheet): RawCell[][] {
  const width = sheet.columnCount;
  const rows: RawCell[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: RawCell[] = [];
    for (let col = 1; col <= width; col += 1) cells.push(valueToCell(row.getCell(col).value));
    if (cells.some((cell) => cell.kind !== 'empty')) rows.push(cells);
  });
  return rows;
}

async function loadWorkbook(bytes: ArrayBuffer): Promise<Workbook> {
  const mod = await import('exceljs');
  const WorkbookCtor = mod.Workbook ?? mod.default.Workbook;
  const workbook = new WorkbookCtor();
  await workbook.xlsx.load(bytes);
  return workbook;
}

/** Parser XLSX: primera hoja con datos; ExcelJS se descarga con import dinámico. */
export class ExcelJsXlsxParser implements StatementParserPort {
  supports(file: StatementFile): boolean {
    return XLSX_EXTENSIONS.has(extensionOf(file.name)) || hasZipMagic(file.bytes);
  }

  async parse(file: StatementFile): Promise<Result<RawTable, DomainError>> {
    const sizeError = checkFileSize(file);
    if (sizeError) return sizeError;

    const zipError = inspectZip(file.bytes);
    if (zipError) return zipError;

    let workbook: Workbook;
    try {
      workbook = await loadWorkbook(file.bytes);
    } catch {
      return failure('import.corruptFile');
    }

    for (const sheet of workbook.worksheets) {
      if (sheet.rowCount > MAX_ROWS) {
        return failure('import.unsupportedFormat', { field: 'rows', expected: MAX_ROWS });
      }
      const rows = sheetToRows(sheet);
      if (rows.length > 0) return okResult({ rows, sourceName: file.name });
    }
    return failure('import.emptyFile');
  }
}
