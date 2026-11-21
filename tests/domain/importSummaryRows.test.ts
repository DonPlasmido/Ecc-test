import { describe, expect, it } from 'vitest'
import type { ColumnMapping } from '@/domain/import/ColumnMapping'
import { normalizeRows } from '@/domain/import/normalizeRows'
import { ACCOUNT, table } from './builders'

const MAPPING: ColumnMapping = { headerRowIndex: 0, columns: ['date', 'description', 'amount'], amountConvention: 'signed' }
const HEADER = ['Fecha', 'Concepto', 'Importe']
const MOVEMENT = ['05/01/2026', 'COMPRA', '-4,50']

describe('normalizeRows: summary rows at the end of a statement', () => {
  it.each(['TOTAL INGRESOS', 'Total gastos', 'SALDO FINAL', 'Saldo inicial', 'TOTALES', 'RESUMEN'])(
    'ignores «%s» (no date) with an informative warning instead of an error',
    (label) => {
      const result = normalizeRows(table([HEADER, MOVEMENT, ['', label, '5,634.99']]), MAPPING, ACCOUNT)
      expect(result.drafts).toHaveLength(1)
      expect(result.rowErrors).toEqual([])
      expect(result.warnings).toEqual([{ line: 3, code: 'summaryRowIgnored', value: label }])
    },
  )

  it('still reports an error for a row without date that is not a summary', () => {
    const result = normalizeRows(table([HEADER, ['', 'COMPRA SIN FECHA', '-4,50']]), MAPPING, ACCOUNT)
    expect(result.rowErrors).toHaveLength(1)
    expect(result.warnings).toEqual([])
  })

  it('keeps a dated movement whose description starts with TOTAL', () => {
    const result = normalizeRows(table([HEADER, ['05/01/2026', 'TOTAL WINE MORE', '-4,50']]), MAPPING, ACCOUNT)
    expect(result.drafts).toHaveLength(1)
    expect(result.warnings).toEqual([])
  })
})
