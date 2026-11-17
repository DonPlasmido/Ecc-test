import { describe, expect, test } from 'vitest';
import { PapaCsvParser } from '@/infrastructure/parsing/PapaCsvParser';
import { MAX_CELL_CHARS, MAX_COLS, MAX_FILE_BYTES, MAX_ROWS } from '@/infrastructure/parsing/limits';
import { cp1252File, toArrayBuffer, toStrings, utf8File } from './helpers';

const parser = new PapaCsvParser();

async function parseRows(name: string, text: string): Promise<string[][]> {
  const result = await parser.parse(utf8File(name, text));
  if (!result.ok) throw new Error(`unexpected error ${result.error.code}`);
  return toStrings(result.value);
}

describe('PapaCsvParser.supports', () => {
  test.each(['a.csv', 'A.CSV', 'x.txt', 'x.tsv'])('accepts %s', (name) => {
    expect(parser.supports({ name, bytes: new ArrayBuffer(1) })).toBe(true);
  });

  test.each(['a.xlsx', 'a.xls', 'csv', 'a.pdf'])('rejects %s', (name) => {
    expect(parser.supports({ name, bytes: new ArrayBuffer(1) })).toBe(false);
  });
});

describe('PapaCsvParser.parse', () => {
  test('parses a semicolon CSV and keeps the source name', async () => {
    const result = await parser.parse(utf8File('mov.csv', 'Fecha;Concepto;Importe\n03/04/2025;Café;-1,50\n'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sourceName).toBe('mov.csv');
    expect(toStrings(result.value)).toEqual([
      ['Fecha', 'Concepto', 'Importe'],
      ['03/04/2025', 'Café', '-1,50'],
    ]);
  });

  test('autodetects comma and tab separators', async () => {
    expect(await parseRows('a.csv', 'a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
    expect(await parseRows('a.csv', 'a\tb\tc\n1\t2\t3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  test('keeps a semicolon inside quotes and line breaks inside quoted fields', async () => {
    const rows = await parseRows('a.csv', 'Fecha;Concepto;Importe\n01/01/2025;"PAGO; TARJETA\nLINEA 2";-5,00\n');

    expect(rows[1]).toEqual(['01/01/2025', 'PAGO; TARJETA\nLINEA 2', '-5,00']);
  });

  test('handles CRLF line endings and skips blank lines', async () => {
    const rows = await parseRows('a.csv', 'a;b\r\n1;2\r\n\r\n3;4\r\n');

    expect(rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });

  test('keeps preamble lines before the header as rows', async () => {
    const text = 'Titular: Juan Pérez\nIBAN: ES00 0000 0000\nFecha;Concepto;Importe\n01/01/2025;Nómina;1.500,00\n02/01/2025;Luz;-60,10\n';

    const rows = await parseRows('a.csv', text);

    expect(rows[0]).toEqual(['Titular: Juan Pérez']);
    expect(rows[1]).toEqual(['IBAN: ES00 0000 0000']);
    expect(rows[2]).toEqual(['Fecha', 'Concepto', 'Importe']);
    expect(rows[3]).toEqual(['01/01/2025', 'Nómina', '1.500,00']);
  });

  test('keeps trailing totals rows and ragged rows', async () => {
    const rows = await parseRows('a.csv', 'a;b;c\n1;2;3\nTotal;;\n4;5\n');

    expect(rows.map((r) => r.length)).toEqual([3, 3, 3, 2]);
  });

  test('represents blank cells as empty and trims padding', async () => {
    const result = await parser.parse(utf8File('a.csv', 'a;b;c\n x ;;z\n'));

    expect(result.ok && result.value.rows[1]).toEqual([
      { kind: 'text', value: 'x' },
      { kind: 'empty' },
      { kind: 'text', value: 'z' },
    ]);
  });

  test('decodes Windows-1252 files', async () => {
    const result = await parser.parse(cp1252File('a.csv', 'Fecha operación;Descripción\n01/01/2025;Año nuevo €\n'));

    expect(result.ok && toStrings(result.value)).toEqual([
      ['Fecha operación', 'Descripción'],
      ['01/01/2025', 'Año nuevo €'],
    ]);
  });

  test('decodes UTF-8 with BOM so the first header is clean', async () => {
    const result = await parser.parse(utf8File('a.csv', 'Fecha;Importe\n1;2', true));

    expect(result.ok && toStrings(result.value)[0]).toEqual(['Fecha', 'Importe']);
  });

  test.each(['=HYPERLINK("http://x","y")', '+34600', '-1.234,56', '@SUM(A1)'])(
    'keeps %s as inert text',
    async (value) => {
      const quoted = `"${value.replaceAll('"', '""')}"`;
      const result = await parser.parse(utf8File('a.csv', `Concepto;Importe\n${quoted};1\n`));

      expect(result.ok && result.value.rows[1]?.[0]).toEqual({ kind: 'text', value });
    },
  );

  test('returns import.emptyFile for empty and whitespace-only files', async () => {
    const empty = await parser.parse({ name: 'a.csv', bytes: new ArrayBuffer(0) });
    const blank = await parser.parse(utf8File('a.csv', '  \n\r\n  '));

    expect(empty).toEqual({ ok: false, error: { code: 'import.emptyFile' } });
    expect(blank.ok).toBe(false);
    expect(!blank.ok && blank.error.code).toBe('import.emptyFile');
  });

  test('returns import.corruptFile for binary content with NUL bytes', async () => {
    const bytes = Uint8Array.from([0x61, 0x3b, 0x00, 0x01, 0x02, 0x0a, 0x00]);

    const result = await parser.parse({ name: 'a.csv', bytes: toArrayBuffer(bytes) });

    expect(!result.ok && result.error.code).toBe('import.corruptFile');
  });

  test('returns import.unsupportedFormat for HTML disguised as CSV', async () => {
    const result = await parser.parse(utf8File('a.csv', '<html><body><table><tr><td>1</td></tr></table></body></html>'));

    expect(!result.ok && result.error.code).toBe('import.unsupportedFormat');
  });

  test('returns import.corruptFile for an unterminated quote', async () => {
    const result = await parser.parse(utf8File('a.csv', 'a;b\n"abc;def\n'));

    expect(!result.ok && result.error.code).toBe('import.corruptFile');
  });

  test('rejects files larger than the size limit', async () => {
    const result = await parser.parse({ name: 'a.csv', bytes: new ArrayBuffer(MAX_FILE_BYTES + 1) });

    expect(!result.ok && result.error.code).toBe('import.unsupportedFormat');
    expect(!result.ok && result.error.details?.expected).toBe(MAX_FILE_BYTES);
  });

  test('rejects files with more rows than the limit', async () => {
    const text = `a;b\n${'1;2\n'.repeat(MAX_ROWS)}`;

    const result = await parser.parse(utf8File('big.csv', text));

    expect(!result.ok && result.error.code).toBe('import.unsupportedFormat');
    expect(!result.ok && result.error.details?.field).toBe('rows');
  });

  test('accepts exactly MAX_ROWS rows', async () => {
    const text = `a;b\n${'1;2\n'.repeat(MAX_ROWS - 1)}`;

    const result = await parser.parse(utf8File('big.csv', text));

    expect(result.ok && result.value.rows.length).toBe(MAX_ROWS);
  });

  test('handles special characters and emojis in values', async () => {
    const rows = await parseRows('a.csv', "a;b\n'; DROP TABLE x;--;Café ☕ 🎉\n");

    expect(rows[1]).toEqual(["'", ' DROP TABLE x'.trim(), '--', 'Café ☕ 🎉']);
  });
});

describe('PapaCsvParser.parse column and cell limits (M1)', () => {
  test('rejects rows with more than MAX_COLS columns', async () => {
    const text = `${Array.from({ length: MAX_COLS + 1 }, (_, i) => i).join(',')}\n1,2\n`;

    const result = await parser.parse(utf8File('wide.csv', text));

    expect(!result.ok && result.error.code).toBe('import.unsupportedFormat');
    expect(!result.ok && result.error.details?.field).toBe('columns');
  });

  test('accepts exactly MAX_COLS columns', async () => {
    const text = `${Array.from({ length: MAX_COLS }, (_, i) => i).join(',')}\n1,2\n`;

    const result = await parser.parse(utf8File('wide.csv', text));

    expect(result.ok && result.value.rows[0]?.length).toBe(MAX_COLS);
  });

  test('rejects cells longer than MAX_CELL_CHARS', async () => {
    const text = `a;b\n${'x'.repeat(MAX_CELL_CHARS + 1)};2\n`;

    const result = await parser.parse(utf8File('long.csv', text));

    expect(!result.ok && result.error.code).toBe('import.unsupportedFormat');
    expect(!result.ok && result.error.details?.field).toBe('cellLength');
  });

  test('accepts a cell of exactly MAX_CELL_CHARS', async () => {
    const text = `a;b\n${'x'.repeat(MAX_CELL_CHARS)};2\n`;

    const result = await parser.parse(utf8File('long.csv', text));

    expect(result.ok).toBe(true);
  });
});
