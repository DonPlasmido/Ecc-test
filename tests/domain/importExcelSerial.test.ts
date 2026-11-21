import { describe, expect, it } from 'vitest'
import type { ColumnMapping } from '@/domain/import/ColumnMapping'
import { normalizeRows } from '@/domain/import/normalizeRows'
import { ACCOUNT, num, table, text } from './builders'

const MAPPING: ColumnMapping = { headerRowIndex: 0, columns: ['date', 'description', 'amount'], amountConvention: 'signed' }
const HEADER = [text('F. VALOR'), text('Descripción'), text('Importe')]

function dateOf(serial: number): string | undefined {
  const result = normalizeRows(table([HEADER, [num(serial), text('X'), num(-1)]]), MAPPING, ACCOUNT)
  return result.drafts[0]?.date
}

describe('normalizeRows: Excel serial dates', () => {
  it.each([
    [46323, '2026-10-28'],
    [46235.75, '2026-08-01'],
    [25569, '1970-01-01'],
    [20000, '1954-10-03'],
  ])('converts serial %s to %s', (serial, expected) => {
    expect(dateOf(serial)).toBe(expected)
  })

  it.each([[19999], [80001], [0], [-5], [Number.NaN]])('rejects serial %s outside the plausible range', (serial) => {
    const result = normalizeRows(table([HEADER, [num(serial), text('X'), num(-1)]]), MAPPING, ACCOUNT)
    expect(result.drafts).toEqual([])
    expect(result.rowErrors).toHaveLength(1)
    expect(result.rowErrors[0]?.error.code).toBe('date.invalidFormat')
  })
})
