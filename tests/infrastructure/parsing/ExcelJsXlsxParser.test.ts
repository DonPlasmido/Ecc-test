import ExcelJS from 'exceljs';
import { describe, expect, test } from 'vitest';
import type { StatementFile } from '@/domain/import/StatementFile';
import { ExcelJsXlsxParser } from '@/infrastructure/parsing/ExcelJsXlsxParser';
import { MAX_ROWS } from '@/infrastructure/parsing/limits';
import { toArrayBuffer, utf8File } from './helpers';
import { buildZip } from './zipFixtures';

const parser = new ExcelJsXlsxParser();

type SheetFill = (sheet: ExcelJS.Worksheet) => void;

async function xlsxFile(name: string, ...fills: SheetFill[]): Promise<StatementFile> {
  const workbook = new ExcelJS.Workbook();
  fills.forEach((fill, i) => fill(workbook.addWorksheet(`Hoja${i + 1}`)));
  const buffer = await workbook.xlsx.writeBuffer();
  return { name, bytes: toArrayBuffer(new Uint8Array(buffer)) };
}

describe('ExcelJsXlsxParser.supports', () => {
  test.each(['a.xlsx', 'A.XLSX', 'a.xlsm'])('accepts %s', (name) => {
    expect(parser.supports({ name, bytes: new ArrayBuffer(1) })).toBe(true);
  });

  test('accepts ZIP magic bytes even with a .csv extension', () => {
    const bytes = toArrayBuffer(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0]));

    expect(parser.supports({ name: 'a.csv', bytes })).toBe(true);
  });

  test.each(['a.csv', 'a.xls', 'a'])('rejects %s', (name) => {
    expect(parser.supports({ name, bytes: new ArrayBuffer(1) })).toBe(false);
  });
});

describe('ExcelJsXlsxParser.parse', () => {
  test('reads text, numbers and sourceName', async () => {
    const file = await xlsxFile('mov.xlsx', (s) => {
      s.addRow(['Fecha', 'Concepto', 'Importe']);
      s.addRow(['03/04/2025', 'Café', -1.5]);
    });

    const result = await parser.parse(file);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sourceName).toBe('mov.xlsx');
    expect(result.value.rows).toEqual([
      [{ kind: 'text', value: 'Fecha' }, { kind: 'text', value: 'Concepto' }, { kind: 'text', value: 'Importe' }],
      [{ kind: 'text', value: '03/04/2025' }, { kind: 'text', value: 'Café' }, { kind: 'number', value: -1.5 }],
    ]);
  });

  test('converts date cells using UTC components', async () => {
    const file = await xlsxFile('a.xlsx', (s) => {
      s.addRow(['Fecha']);
      s.addRow([new Date(Date.UTC(2025, 3, 3))]);
      s.addRow([new Date(Date.UTC(2024, 1, 29, 23, 59, 59))]);
    });

    const result = await parser.parse(file);

    expect(result.ok && result.value.rows.slice(1)).toEqual([
      [{ kind: 'date', value: '2025-04-03' }],
      [{ kind: 'date', value: '2024-02-29' }],
    ]);
  });

  test('uses the formula result and never the formula text', async () => {
    const file = await xlsxFile('a.xlsx', (s) => {
      s.addRow(['x']);
      s.getCell('A2').value = { formula: 'SUM(1,2)', result: 3 };
      s.getCell('B2').value = { formula: 'CONCAT("a","b")', result: 'ab' };
      s.getCell('C2').value = { formula: 'A1', result: undefined };
    });

    const result = await parser.parse(file);

    expect(result.ok && result.value.rows[1]).toEqual([
      { kind: 'number', value: 3 },
      { kind: 'text', value: 'ab' },
      { kind: 'empty' },
    ]);
  });

  test('flattens rich text and hyperlink cells', async () => {
    const file = await xlsxFile('a.xlsx', (s) => {
      s.addRow(['x']);
      s.getCell('A2').value = { richText: [{ text: 'Pago ' }, { text: 'tarjeta', font: { bold: true } }] };
      s.getCell('B2').value = { text: 'enlace', hyperlink: 'http://example.com' };
    });

    const result = await parser.parse(file);

    expect(result.ok && result.value.rows[1]).toEqual([
      { kind: 'text', value: 'Pago tarjeta' },
      { kind: 'text', value: 'enlace' },
    ]);
  });

  test('keeps values that start with = + - @ as plain text', async () => {
    const file = await xlsxFile('a.xlsx', (s) => {
      s.addRow(['=HYPERLINK("http://x","y")', '+34600', '-1.234,56', '@SUM(A1)']);
    });

    const result = await parser.parse(file);

    expect(result.ok && result.value.rows[0]).toEqual([
      { kind: 'text', value: '=HYPERLINK("http://x","y")' },
      { kind: 'text', value: '+34600' },
      { kind: 'text', value: '-1.234,56' },
      { kind: 'text', value: '@SUM(A1)' },
    ]);
  });

  test('preserves leading empty columns and skips fully empty rows', async () => {
    const file = await xlsxFile('a.xlsx', (s) => {
      s.getCell('B1').value = 'Fecha';
      s.getCell('C1').value = 'Importe';
      s.getCell('B4').value = '01/01/2025';
      s.getCell('C4').value = 5;
    });

    const result = await parser.parse(file);

    expect(result.ok && result.value.rows).toEqual([
      [{ kind: 'empty' }, { kind: 'text', value: 'Fecha' }, { kind: 'text', value: 'Importe' }],
      [{ kind: 'empty' }, { kind: 'text', value: '01/01/2025' }, { kind: 'number', value: 5 }],
    ]);
  });

  test('uses the first sheet that has data', async () => {
    const file = await xlsxFile(
      'a.xlsx',
      () => undefined,
      (s) => {
        s.addRow(['segunda']);
      },
    );

    const result = await parser.parse(file);

    expect(result.ok && result.value.rows).toEqual([[{ kind: 'text', value: 'segunda' }]]);
  });

  test('renders booleans and error cells as text', async () => {
    const file = await xlsxFile('a.xlsx', (s) => {
      s.getCell('A1').value = true;
      s.getCell('B1').value = { error: '#N/A' };
    });

    const result = await parser.parse(file);

    expect(result.ok && result.value.rows[0]).toEqual([
      { kind: 'text', value: 'true' },
      { kind: 'text', value: '#N/A' },
    ]);
  });

  test('trims text cells and turns blank strings into empty cells', async () => {
    const file = await xlsxFile('a.xlsx', (s) => {
      s.addRow(['  hola  ', '   ', 'x']);
    });

    const result = await parser.parse(file);

    expect(result.ok && result.value.rows[0]).toEqual([
      { kind: 'text', value: 'hola' },
      { kind: 'empty' },
      { kind: 'text', value: 'x' },
    ]);
  });

  test('returns import.emptyFile for an empty buffer and for a workbook without data', async () => {
    const empty = await parser.parse({ name: 'a.xlsx', bytes: new ArrayBuffer(0) });
    const noData = await parser.parse(await xlsxFile('a.xlsx', () => undefined));

    expect(!empty.ok && empty.error.code).toBe('import.emptyFile');
    expect(!noData.ok && noData.error.code).toBe('import.emptyFile');
  });

  test('returns import.corruptFile for bytes that are not a valid xlsx', async () => {
    const result = await parser.parse(utf8File('a.xlsx', 'esto no es un zip'));

    expect(!result.ok && result.error.code).toBe('import.corruptFile');
  });

  test('rejects workbooks with more rows than the limit', async () => {
    const file = await xlsxFile('a.xlsx', (s) => {
      s.getCell(`A${MAX_ROWS + 1}`).value = 'x';
      s.getCell('A1').value = 'y';
    });

    const result = await parser.parse(file);

    expect(!result.ok && result.error.code).toBe('import.unsupportedFormat');
    expect(!result.ok && result.error.details?.field).toBe('rows');
  });
});

const MB = 1024 * 1024;

describe('ExcelJsXlsxParser.parse ZIP guard (H1)', () => {
  async function rejection(bytes: ArrayBuffer) {
    const result = await parser.parse({ name: 'bomba.xlsx', bytes });
    if (result.ok) throw new Error('se esperaba un rechazo');
    return result.error;
  }

  test('rejects a real zip bomb (20 MB of zeros) by ratio, quickly', async () => {
    const started = Date.now();
    const bytes = buildZip([{ name: 'xl/worksheets/sheet1.xml', data: new Uint8Array(20 * MB) }]);

    const error = await rejection(bytes);

    expect(error.code).toBe('import.unsupportedFormat');
    expect(error.details?.field).toBe('ratio');
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test('rejects when declared uncompressed total exceeds 50 MB', async () => {
    const entries = [1, 2, 3].map((i) => ({
      name: `p${i}.xml`,
      data: new Uint8Array(1),
      declared: { compressed: 10 * MB, uncompressed: 20 * MB },
    }));

    const error = await rejection(buildZip(entries));

    expect(error.code).toBe('import.unsupportedFormat');
    expect(error.details?.field).toBe('uncompressedSize');
  });

  test('rejects more than 100 entries', async () => {
    const entries = Array.from({ length: 101 }, (_, i) => ({ name: `f${i}.xml`, data: new Uint8Array(1) }));

    const error = await rejection(buildZip(entries));

    expect(error.code).toBe('import.unsupportedFormat');
    expect(error.details?.field).toBe('entries');
  });

  test('does not reject a normal workbook', async () => {
    const file = await xlsxFile('ok.xlsx', (s) => s.addRow(['a', 1]));

    expect((await parser.parse(file)).ok).toBe(true);
  });
});
