import ExcelJS from 'exceljs';
import { describe, expect, test } from 'vitest';
import type { RawTable } from '@/domain/import/RawTable';
import type { StatementFile } from '@/domain/import/StatementFile';
import { CompositeStatementParser } from '@/infrastructure/parsing/CompositeStatementParser';
import { MAX_FILE_BYTES } from '@/infrastructure/parsing/limits';
import { InMemoryStatementParser } from '../../fakes/InMemoryStatementParser';
import { toArrayBuffer, toStrings, utf8File } from './helpers';

async function xlsxFile(name: string): Promise<StatementFile> {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('H').addRow(['Fecha', 'Importe']);
  const buffer = await workbook.xlsx.writeBuffer();
  return { name, bytes: toArrayBuffer(new Uint8Array(buffer)) };
}

function bytesFile(name: string, bytes: number[]): StatementFile {
  return { name, bytes: toArrayBuffer(Uint8Array.from(bytes)) };
}

const parser = new CompositeStatementParser();

describe('CompositeStatementParser', () => {
  test('routes a .csv file to the CSV parser', async () => {
    const result = await parser.parse(utf8File('a.csv', 'a;b\n1;2'));

    expect(result.ok && toStrings(result.value)).toEqual([['a', 'b'], ['1', '2']]);
  });

  test('routes a .xlsx file to the XLSX parser', async () => {
    const result = await parser.parse(await xlsxFile('a.xlsx'));

    expect(result.ok && toStrings(result.value)).toEqual([['Fecha', 'Importe']]);
  });

  test('routes by magic bytes when a .csv is really an XLSX', async () => {
    const result = await parser.parse(await xlsxFile('disfrazado.csv'));

    expect(result.ok && toStrings(result.value)).toEqual([['Fecha', 'Importe']]);
  });

  test('rejects legacy .xls by extension with import.unsupportedFormat', async () => {
    const result = await parser.parse(utf8File('a.xls', 'a;b'));

    expect(!result.ok && result.error).toEqual({ code: 'import.unsupportedFormat', details: { value: 'xls' } });
  });

  test('rejects legacy OLE2 files by magic bytes even if named .xlsx or .csv', async () => {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

    const asXlsx = await parser.parse(bytesFile('a.xlsx', ole));
    const asCsv = await parser.parse(bytesFile('a.csv', ole));

    expect(!asXlsx.ok && asXlsx.error.code).toBe('import.unsupportedFormat');
    expect(!asCsv.ok && asCsv.error.code).toBe('import.unsupportedFormat');
  });

  test('rejects PDF and unknown extensions', async () => {
    const pdf = await parser.parse(bytesFile('a.csv', [0x25, 0x50, 0x44, 0x46, 0x2d]));
    const unknown = await parser.parse(utf8File('a.pdf', 'hola'));

    expect(!pdf.ok && pdf.error.code).toBe('import.unsupportedFormat');
    expect(!unknown.ok && unknown.error.code).toBe('import.unsupportedFormat');
  });

  test('rejects empty files with import.emptyFile', async () => {
    const result = await parser.parse({ name: 'a.csv', bytes: new ArrayBuffer(0) });

    expect(result).toEqual({ ok: false, error: { code: 'import.emptyFile' } });
  });

  test('rejects files over 20 MB', async () => {
    const result = await parser.parse({ name: 'a.csv', bytes: new ArrayBuffer(MAX_FILE_BYTES + 1) });

    expect(!result.ok && result.error.code).toBe('import.unsupportedFormat');
    expect(!result.ok && result.error.details?.field).toBe('size');
  });

  test('accepts a file of exactly 20 MB sized check (not rejected for size)', async () => {
    const bytes = new Uint8Array(MAX_FILE_BYTES).fill(0x61);

    const result = await parser.parse({ name: 'a.csv', bytes: toArrayBuffer(bytes) });

    expect(!result.ok && result.error.details?.field).not.toBe('size');
  });

  test('reports a text file named .xlsx as corrupt', async () => {
    const result = await parser.parse(utf8File('a.xlsx', 'no soy un zip'));

    expect(!result.ok && result.error.code).toBe('import.corruptFile');
  });

  test('supports mirrors what parse can route', async () => {
    expect(parser.supports(utf8File('a.csv', 'x'))).toBe(true);
    expect(parser.supports(utf8File('a.XLSX', 'x'))).toBe(true);
    expect(parser.supports(utf8File('a.xls', 'x'))).toBe(false);
    expect(parser.supports(utf8File('a.pdf', 'x'))).toBe(false);
  });

  test('delegates to injected parsers (in-memory fakes)', async () => {
    const table: RawTable = { rows: [[{ kind: 'text', value: 'x' }]], sourceName: 'fake' };
    const csv = InMemoryStatementParser.returning(table, ['csv']);
    const xlsx = InMemoryStatementParser.returning(table, ['xlsx']);
    const composite = new CompositeStatementParser(csv, xlsx);

    await composite.parse(utf8File('a.csv', 'x'));
    await composite.parse(utf8File('b.xlsx', 'x'));

    expect(csv.parsedNames).toEqual(['a.csv']);
    expect(xlsx.parsedNames).toEqual(['b.xlsx']);
  });
});

describe('InMemoryStatementParser', () => {
  test('returns the configured error and records calls', async () => {
    const fake = InMemoryStatementParser.failing('import.corruptFile', ['csv']);

    const result = await fake.parse(utf8File('a.csv', 'x'));

    expect(result).toEqual({ ok: false, error: { code: 'import.corruptFile' } });
    expect(fake.parsedNames).toEqual(['a.csv']);
    expect(fake.supports(utf8File('a.csv', 'x'))).toBe(true);
    expect(fake.supports(utf8File('a.pdf', 'x'))).toBe(false);
  });
});
