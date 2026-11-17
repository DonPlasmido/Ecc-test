import Papa from 'papaparse';
import type { StatementParserPort } from '@/application/ports/outbound/StatementParserPort';
import type { RawCell, RawTable } from '@/domain/import/RawTable';
import type { StatementFile } from '@/domain/import/StatementFile';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';
import { decodeText } from './decodeText';
import { MAX_CELL_CHARS, MAX_COLS, MAX_ROWS } from './limits';
import { checkFileSize, extensionOf, failure, okResult } from './parseResult';

const CSV_EXTENSIONS: ReadonlySet<string> = new Set(['csv', 'txt', 'tsv']);
const DELIMITERS = [';', ',', '\t'];
const HTML_START = /^\s*<(!doctype|html|table|head|body)/i;

const DELIMITER_SAMPLE_ROWS = 60;
const DEFAULT_DELIMITER = ',';

/**
 * Elige el separador por la "tabla" más consistente: filas con ≥2 campos que comparten el nº de campos
 * más frecuente, ponderadas por ese nº. Papa solo mira las primeras líneas y se confunde con preámbulos
 * bancarios y comas decimales; así `;` gana a `,` cuando los importes son `1.200,00`.
 */
function detectDelimiter(text: string): string {
  let best = DEFAULT_DELIMITER;
  let bestScore = 0;
  for (const delimiter of DELIMITERS) {
    const sample = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: 'greedy', preview: DELIMITER_SAMPLE_ROWS });
    const frequency = new Map<number, number>();
    for (const row of sample.data) {
      if (row.length >= 2) frequency.set(row.length, (frequency.get(row.length) ?? 0) + 1);
    }
    for (const [fields, rows] of frequency) {
      const score = fields * rows;
      if (score > bestScore) {
        bestScore = score;
        best = delimiter;
      }
    }
  }
  return best;
}

function toCell(value: string): RawCell {
  const text = value.trim();
  return text === '' ? { kind: 'empty' } : { kind: 'text', value: text };
}

/** Parser CSV: devuelve la tabla cruda (todo texto); la detección de cabecera es del dominio. */
export class PapaCsvParser implements StatementParserPort {
  supports(file: StatementFile): boolean {
    return CSV_EXTENSIONS.has(extensionOf(file.name));
  }

  async parse(file: StatementFile): Promise<Result<RawTable, DomainError>> {
    const sizeError = checkFileSize(file);
    if (sizeError) return sizeError;
    if (new Uint8Array(file.bytes).includes(0)) return failure('import.corruptFile');

    const text = decodeText(file.bytes);
    if (text.trim() === '') return failure('import.emptyFile');
    if (HTML_START.test(text)) return failure('import.unsupportedFormat', { field: 'html' });

    const parsed = Papa.parse<string[]>(text, {
      delimiter: detectDelimiter(text),
      skipEmptyLines: 'greedy',
      preview: MAX_ROWS + 1,
    });
    if (parsed.errors.some((e) => e.code === 'MissingQuotes')) return failure('import.corruptFile');
    if (parsed.data.length > MAX_ROWS) {
      return failure('import.unsupportedFormat', { field: 'rows', expected: MAX_ROWS });
    }
    if (parsed.data.length === 0) return failure('import.emptyFile');
    if (parsed.data.some((row) => row.length > MAX_COLS)) {
      return failure('import.unsupportedFormat', { field: 'columns', expected: MAX_COLS });
    }
    if (parsed.data.some((row) => row.some((cell) => cell.length > MAX_CELL_CHARS))) {
      return failure('import.unsupportedFormat', { field: 'cellLength', expected: MAX_CELL_CHARS });
    }

    const rows = parsed.data.map((row) => row.map(toCell));
    return okResult({ rows, sourceName: file.name });
  }
}
