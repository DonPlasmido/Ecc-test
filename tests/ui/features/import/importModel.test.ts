import { describe, expect, it } from 'vitest';
import type { ColumnMapping } from '@/domain/import/ColumnMapping';
import type { RawCell, RawTable } from '@/domain/import/RawTable';
import {
  VISIBLE_PREVIEW_ROWS,
  assignRole,
  buildPreviewModel,
  mappingError,
  sourceColumns,
  withConvention,
} from '@/ui/features/import/importModel';

const text = (value: string): RawCell => (value === '' ? { kind: 'empty' } : { kind: 'text', value });
const table = (rows: readonly (readonly string[])[]): RawTable => ({ sourceName: 'test.csv', rows: rows.map((row) => row.map(text)) });

const signed: ColumnMapping = { headerRowIndex: 0, columns: ['date', 'description', 'amount', 'balance'], amountConvention: 'signed' };

describe('importModel', () => {
  it('lists every source column with its header and first non-empty example', () => {
    const raw = table([
      ['Fecha', 'Concepto', 'Importe', 'Saldo'],
      ['05/01/2026', '', '-45,10', '1.954,90'],
      ['06/01/2026', 'MERCADONA', '-1,00', '1.953,90'],
    ]);

    const columns = sourceColumns(raw, signed);

    expect(columns.map((c) => c.header)).toEqual(['Fecha', 'Concepto', 'Importe', 'Saldo']);
    expect(columns[1]?.example).toBe('MERCADONA');
  });

  it('uses empty headers when the file has no header row', () => {
    const raw = table([['05/01/2026', 'BAR', '-2,50']]);
    const mapping: ColumnMapping = { headerRowIndex: -1, columns: ['date', 'description', 'amount'], amountConvention: 'signed' };

    expect(sourceColumns(raw, mapping).map((c) => [c.header, c.example])).toEqual([
      ['', '05/01/2026'],
      ['', 'BAR'],
      ['', '-2,50'],
    ]);
  });

  it('moves a single-use role instead of duplicating it and keeps the original mapping intact', () => {
    const next = assignRole(signed, 3, 'amount');

    expect(next.columns).toEqual(['date', 'description', 'ignore', 'amount']);
    expect(signed.columns).toEqual(['date', 'description', 'amount', 'balance']);
  });

  it('switches the amount convention when debit/credit or a signed amount is chosen', () => {
    const debit = assignRole(signed, 2, 'debit');
    expect(debit.amountConvention).toBe('debitCredit');
    expect(assignRole(debit, 2, 'amount').amountConvention).toBe('signed');
    expect(assignRole(signed, 3, 'ignore').amountConvention).toBe('signed');
    expect(withConvention(signed, 'debitCredit').amountConvention).toBe('debitCredit');
  });

  it('allows several ignored columns', () => {
    const next = assignRole(assignRole(signed, 3, 'ignore'), 2, 'ignore');
    expect(next.columns).toEqual(['date', 'description', 'ignore', 'ignore']);
  });

  it('reports the missing required column', () => {
    expect(mappingError(signed)).toBeNull();
    expect(mappingError(assignRole(signed, 0, 'ignore'))?.code).toBe('import.missingDateColumn');
    expect(mappingError(assignRole(signed, 2, 'ignore'))?.code).toBe('import.missingAmountColumn');
  });

  it('normalises valid rows and keeps rejected rows with their line, in file order', () => {
    const raw = table([
      ['Fecha', 'Concepto', 'Importe', 'Saldo'],
      ['05/01/2026', 'COMPRA MERCADONA', '-45,10', '1.954,90'],
      ['31/02/2026', 'FECHA MALA', '-1,00', ''],
      ['06/01/2026', 'IMPORTE AMBIGUO', '12.345', ''],
    ]);

    const model = buildPreviewModel(raw, signed);

    expect(model.validCount).toBe(2);
    expect(model.errorCount).toBe(1);
    expect(model.rows.map((row) => [row.line, row.kind])).toEqual([
      [2, 'valid'],
      [3, 'error'],
      [4, 'valid'],
    ]);
    const first = model.rows[0];
    expect(first?.kind === 'valid' && [first.date, first.amount.cents, first.balance?.cents]).toEqual(['2026-01-05', -4510, 195490]);
    const ambiguous = model.rows[2];
    expect(ambiguous?.kind === 'valid' && ambiguous.warning?.code).toBe('ambiguousAmount');
    expect(model.warnings).toHaveLength(1);
  });

  it('shows at most the first rows of the preview', () => {
    const rows = Array.from({ length: VISIBLE_PREVIEW_ROWS + 5 }, (_, i) => ['05/01/2026', `CONCEPTO ${i}`, '-1,00', '']);
    const model = buildPreviewModel(table([['Fecha', 'Concepto', 'Importe', 'Saldo'], ...rows]), signed);

    expect(model.rows).toHaveLength(VISIBLE_PREVIEW_ROWS);
    expect(model.validCount).toBe(VISIBLE_PREVIEW_ROWS + 5);
  });
});
