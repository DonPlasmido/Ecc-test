import { describe, expect, it } from 'vitest'
import type { ColumnMapping } from '@/domain/import/ColumnMapping'
import { detectColumnMapping, headerSignature, validateMapping } from '@/domain/import/detectColumnMapping'
import { detectHeaderRow } from '@/domain/import/detectHeaderRow'
import { normalizeRows } from '@/domain/import/normalizeRows'
import { ACCOUNT, dateCell, EMPTY, num, table, text } from './builders'

const BASIC_HEADER = ['Fecha operación', 'Concepto', 'Importe', 'Saldo']

describe('detectHeaderRow', () => {
  it('finds the header in the first row', () => {
    expect(detectHeaderRow(table([BASIC_HEADER, ['05/01/2026', 'COMPRA', '-4,50', '10,00']]))).toBe(0)
  })

  it('skips preamble lines (holder, IBAN, range)', () => {
    const rows = [
      ['Titular: Ana Pérez'],
      ['IBAN: ES00 1234 5678 9012 3456 7890'],
      ['Desde 01/01/2026 hasta 31/01/2026'],
      BASIC_HEADER,
      ['05/01/2026', 'COMPRA', '-4,50', '10,00'],
    ]
    expect(detectHeaderRow(table(rows))).toBe(3)
  })

  it('returns -1 when there is no recognizable header', () => {
    expect(detectHeaderRow(table([['05/01/2026', 'COMPRA', '-4,50']]))).toBe(-1)
    expect(detectHeaderRow(table([]))).toBe(-1)
    expect(detectHeaderRow(table([['Fecha']]))).toBe(-1)
  })

  it('only searches the first 20 rows', () => {
    const filler = Array.from({ length: 20 }, () => ['x'])
    expect(detectHeaderRow(table([...filler, BASIC_HEADER]))).toBe(-1)
    expect(detectHeaderRow(table([...filler.slice(1), BASIC_HEADER]))).toBe(19)
  })

  it('picks the row with most recognized columns', () => {
    const rows = [['Fecha', 'Concepto'], BASIC_HEADER]
    expect(detectHeaderRow(table(rows))).toBe(1)
  })

  it('ignores non-text cells in candidate rows', () => {
    expect(detectHeaderRow(table([[num(1), num(2)], BASIC_HEADER]))).toBe(1)
  })
})

describe('detectColumnMapping', () => {
  it('maps a basic signed statement with full confidence', () => {
    const detection = detectColumnMapping(table([BASIC_HEADER, ['05/01/2026', 'X', '-1,00', '1,00']]))
    expect(detection.mapping).toEqual({
      headerRowIndex: 0,
      columns: ['date', 'description', 'amount', 'balance'],
      amountConvention: 'signed',
    })
    expect(detection.confidence).toBe(1)
  })

  it('maps Debe/Haber style statements as debitCredit', () => {
    const header = ['Fecha', 'F. Valor', 'Descripción', 'Cargo', 'Abono', 'Saldo disponible']
    const { mapping, confidence } = detectColumnMapping(table([header]))
    expect(mapping.columns).toEqual(['date', 'valueDate', 'description', 'debit', 'credit', 'balance'])
    expect(mapping.amountConvention).toBe('debitCredit')
    expect(confidence).toBe(1)
  })

  it.each([
    [['Fecha contable', 'Movimiento', 'Cantidad'], ['date', 'description', 'amount']],
    [['F. Operación', 'Detalle', 'Debe', 'Haber'], ['date', 'description', 'debit', 'credit']],
    [['FECHA VALOR', 'FECHA OPERACIÓN', 'CONCEPTO', 'IMPORTE (EUR)', 'SALDO (EUR)'], ['valueDate', 'date', 'description', 'amount', 'balance']],
    [['Date', 'Description', 'Amount', 'Balance'], ['date', 'description', 'amount', 'balance']],
  ])('recognizes header variant %j', (header, expected) => {
    expect(detectColumnMapping(table([header])).mapping.columns).toEqual(expected)
  })

  it('marks unknown and duplicate columns as ignore', () => {
    const { mapping } = detectColumnMapping(table([['Fecha', 'Fecha', 'Concepto', 'Importe', 'Oficina']]))
    expect(mapping.columns).toEqual(['date', 'ignore', 'description', 'amount', 'ignore'])
  })

  it('prefers a single amount column over debit/credit when both exist', () => {
    const { mapping } = detectColumnMapping(table([['Fecha', 'Concepto', 'Importe', 'Debe', 'Haber']]))
    expect(mapping.amountConvention).toBe('signed')
    expect(mapping.columns).toEqual(['date', 'description', 'amount', 'ignore', 'ignore'])
  })

  it('reports lower confidence when required columns are missing', () => {
    const { confidence } = detectColumnMapping(table([['Fecha', 'Concepto']]))
    expect(confidence).toBeCloseTo(2 / 3, 5)
  })

  it('skips the preamble and reports its header row index', () => {
    const rows = [['Titular'], BASIC_HEADER]
    expect(detectColumnMapping(table(rows)).mapping.headerRowIndex).toBe(1)
  })

  it('infers columns from content when there is no header', () => {
    const rows = [
      ['05/01/2026', 'COMPRA MERCADONA VALENCIA', '-45,10'],
      ['06/01/2026', 'RECIBO LUZ', '-60,00'],
      ['07/01/2026', 'NOMINA EMPRESA SL', '1.500,00'],
    ]
    const { mapping, confidence } = detectColumnMapping(table(rows))
    expect(mapping).toEqual({ headerRowIndex: -1, columns: ['date', 'description', 'amount'], amountConvention: 'signed' })
    expect(confidence).toBeGreaterThan(0)
    expect(confidence).toBeLessThanOrEqual(0.5)
  })

  it('handles XLSX-style typed cells when inferring without a header', () => {
    const rows = [
      [dateCell('2026-01-05'), text('COMPRA'), num(-45.1)],
      [dateCell('2026-01-06'), text('RECIBO'), num(-60)],
    ]
    const { mapping } = detectColumnMapping(table(rows))
    expect(mapping.columns).toEqual(['date', 'description', 'amount'])
  })

  it('returns an empty zero-confidence mapping for an empty table', () => {
    const detection = detectColumnMapping(table([]))
    expect(detection.mapping).toEqual({ headerRowIndex: -1, columns: [], amountConvention: 'signed' })
    expect(detection.confidence).toBe(0)
  })
})

describe('validateMapping', () => {
  const valid: ColumnMapping = {
    headerRowIndex: 0,
    columns: ['date', 'description', 'amount'],
    amountConvention: 'signed',
  }

  it('accepts a complete mapping', () => {
    expect(validateMapping(valid)).toEqual({ ok: true, value: valid })
  })

  it.each([
    [{ ...valid, columns: ['description', 'amount'] }, 'import.missingDateColumn'],
    [{ ...valid, columns: ['date', 'amount'] }, 'import.missingDescriptionColumn'],
    [{ ...valid, columns: ['date', 'description'] }, 'import.missingAmountColumn'],
    [{ ...valid, amountConvention: 'debitCredit' }, 'import.missingAmountColumn'],
    [{ ...valid, columns: ['date', 'description', 'amount', 'amount'] }, 'import.invalidMapping'],
    [{ ...valid, columns: ['date', 'date', 'description', 'amount'] }, 'import.invalidMapping'],
    [{ ...valid, headerRowIndex: -2 }, 'import.invalidMapping'],
    [{ ...valid, headerRowIndex: 1.5 }, 'import.invalidMapping'],
  ] as const)('rejects %j with %s', (mapping, code) => {
    const result = validateMapping(mapping)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe(code)
  })

  it('accepts debitCredit with debit and credit columns, or only one of them', () => {
    const both = { ...valid, columns: ['date', 'description', 'debit', 'credit'], amountConvention: 'debitCredit' } as const
    const onlyDebit = { ...valid, columns: ['date', 'description', 'debit'], amountConvention: 'debitCredit' } as const
    expect(validateMapping(both).ok).toBe(true)
    expect(validateMapping(onlyDebit).ok).toBe(true)
  })

  it('names the missing column in the error details', () => {
    const result = validateMapping({ ...valid, columns: ['description', 'amount'] })
    expect(!result.ok && result.error.details?.field).toBe('date')
  })
})

describe('headerSignature', () => {
  it('is insensitive to case, accents and spacing', () => {
    expect(headerSignature(['Fecha operación', ' Concepto ', 'IMPORTE'])).toBe(
      headerSignature(['FECHA OPERACION', 'concepto', 'Importe']),
    )
  })

  it('depends on column order and content', () => {
    expect(headerSignature(['A', 'B'])).not.toBe(headerSignature(['B', 'A']))
    expect(headerSignature(['A', 'B'])).not.toBe(headerSignature(['A', 'C']))
    expect(headerSignature([])).toBe('')
  })
})

describe('normalizeRows', () => {
  const signed: ColumnMapping = {
    headerRowIndex: 0,
    columns: ['date', 'description', 'amount', 'balance'],
    amountConvention: 'signed',
  }

  it('turns valid rows into drafts (AC-001)', () => {
    const rows = [BASIC_HEADER, ['05/01/2026', 'COMPRA MERCADONA 123', '-45,10', '1.954,90']]
    const { drafts, rowErrors } = normalizeRows(table(rows), signed, ACCOUNT)
    expect(rowErrors).toEqual([])
    expect(drafts).toEqual([
      {
        accountId: ACCOUNT,
        date: '2026-01-05',
        valueDate: null,
        amount: { cents: -4510 },
        balance: { cents: 195_490 },
        rawDescription: 'COMPRA MERCADONA 123',
        normalizedDescription: 'COMPRA MERCADONA 123',
        sourceLine: 2,
      },
    ])
  })

  it('reports invalid rows with their line and keeps the valid ones (AC-008)', () => {
    const rows = [
      BASIC_HEADER,
      ['01/01/2026', 'UNO', '-1,00', ''],
      ['02/01/2026', 'DOS', '-2,00', ''],
      ['31/02/2026', 'MAL FECHA', '-3,00', ''],
      ['04/01/2026', 'CUATRO', '-4,00', ''],
      ['05/01/2026', 'MAL IMPORTE', 'abc', ''],
      ['06/01/2026', 'SEIS', '-6,00', ''],
    ]
    const { drafts, rowErrors } = normalizeRows(table(rows), signed, ACCOUNT)
    expect(drafts.map((d) => d.sourceLine)).toEqual([2, 3, 5, 7])
    expect(rowErrors.map((e) => [e.line, e.error.code])).toEqual([
      [4, 'date.invalidDate'],
      [6, 'money.invalidAmount'],
    ])
  })

  it('skips fully blank rows without reporting them', () => {
    const rows = [BASIC_HEADER, ['', '', '', ''], ['05/01/2026', 'X', '-1,00', ''], [EMPTY, text('  '), EMPTY, EMPTY]]
    const { drafts, rowErrors } = normalizeRows(table(rows), signed, ACCOUNT)
    expect(drafts).toHaveLength(1)
    expect(rowErrors).toEqual([])
  })

  it('starts after the header row and processes preamble-free tables without header', () => {
    const noHeader = { ...signed, headerRowIndex: -1 }
    const { drafts } = normalizeRows(table([['05/01/2026', 'X', '-1,00', '']]), noHeader, ACCOUNT)
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.sourceLine).toBe(1)
    const withPreamble = normalizeRows(table([['Titular'], BASIC_HEADER, ['05/01/2026', 'X', '-1,00', '']]), { ...signed, headerRowIndex: 1 }, ACCOUNT)
    expect(withPreamble.drafts.map((d) => d.sourceLine)).toEqual([3])
  })

  it('rejects an empty description', () => {
    const { drafts, rowErrors } = normalizeRows(table([BASIC_HEADER, ['05/01/2026', '   ', '-1,00', '']]), signed, ACCOUNT)
    expect(drafts).toEqual([])
    expect(rowErrors[0]?.error.code).toBe('import.emptyDescription')
  })

  it('normalizes the description for dedup but keeps the raw text (formula injection stays as text)', () => {
    const rows = [BASIC_HEADER, ['05/01/2026', '  =HYPERLINK("http://x")  café ', '-1,00', '']]
    const draft = normalizeRows(table(rows), signed, ACCOUNT).drafts[0]
    expect(draft?.rawDescription).toBe('=HYPERLINK("http://x")  café')
    expect(draft?.normalizedDescription).toBe('=HYPERLINK("HTTP://X") CAFE')
  })

  it('accepts XLSX typed cells: dates, numbers and numeric descriptions', () => {
    const rows = [BASIC_HEADER, [dateCell('2026-01-05'), num(12_345), num(-45.1), num(1954.9)]]
    const draft = normalizeRows(table(rows), signed, ACCOUNT).drafts[0]
    expect(draft).toMatchObject({
      date: '2026-01-05',
      rawDescription: '12345',
      amount: { cents: -4510 },
      balance: { cents: 195_490 },
    })
  })

  it('rejects numeric amounts that are not whole cents or not finite', () => {
    const rows = [BASIC_HEADER, ['05/01/2026', 'A', num(1.234), ''], ['05/01/2026', 'B', num(Number.NaN), ''], ['05/01/2026', 'C', num(1e300), '']]
    const { drafts, rowErrors } = normalizeRows(table(rows), signed, ACCOUNT)
    expect(drafts).toEqual([])
    expect(rowErrors.map((e) => e.error.code)).toEqual(['money.invalidAmount', 'money.invalidAmount', 'money.outOfRange'])
  })

  it('rejects an empty amount or a numeric/empty date', () => {
    const rows = [BASIC_HEADER, ['05/01/2026', 'A', '', ''], [num(5), 'B', '-1,00', ''], ['', 'C', '-1,00', '']]
    const { rowErrors } = normalizeRows(table(rows), signed, ACCOUNT)
    expect(rowErrors.map((e) => e.error.code)).toEqual(['money.invalidAmount', 'date.invalidFormat', 'date.invalidFormat'])
  })

  it('treats an unreadable balance or value date as absent without dropping the row', () => {
    const mapping: ColumnMapping = {
      headerRowIndex: 0,
      columns: ['date', 'valueDate', 'description', 'amount', 'balance'],
      amountConvention: 'signed',
    }
    const rows = [['F', 'V', 'C', 'I', 'S'], ['05/01/2026', 'nada', 'X', '-1,00', 'nada'], ['05/01/2026', '07/01/2026', 'Y', '-1,00', '5,00']]
    const { drafts, rowErrors } = normalizeRows(table(rows), mapping, ACCOUNT)
    expect(rowErrors).toEqual([])
    expect(drafts[0]).toMatchObject({ valueDate: null, balance: null })
    expect(drafts[1]).toMatchObject({ valueDate: '2026-01-07', balance: { cents: 500 } })
  })

  describe('debit/credit convention', () => {
    const mapping: ColumnMapping = {
      headerRowIndex: 0,
      columns: ['date', 'description', 'debit', 'credit'],
      amountConvention: 'debitCredit',
    }

    it('makes debits negative and credits positive regardless of the written sign', () => {
      const rows = [
        ['F', 'C', 'D', 'H'],
        ['05/01/2026', 'A', '45,10', ''],
        ['05/01/2026', 'B', '-45,10', ''],
        ['05/01/2026', 'C', '', '100,00'],
        ['05/01/2026', 'D', '0,00', '10,00'],
        ['05/01/2026', 'E', num(7.5), EMPTY],
      ]
      const { drafts, rowErrors } = normalizeRows(table(rows), mapping, ACCOUNT)
      expect(rowErrors).toEqual([])
      expect(drafts.map((d) => d.amount.cents)).toEqual([-4510, -4510, 10_000, 1_000, -750])
    })

    it('reports a row with neither debit nor credit, and invalid values', () => {
      const rows = [['F', 'C', 'D', 'H'], ['05/01/2026', 'A', '', ''], ['05/01/2026', 'B', 'xx', '']]
      const { drafts, rowErrors } = normalizeRows(table(rows), mapping, ACCOUNT)
      expect(drafts).toEqual([])
      expect(rowErrors.map((e) => e.error.code)).toEqual(['money.invalidAmount', 'money.invalidAmount'])
    })

    it('works with a statement that only has a debit column', () => {
      const onlyDebit: ColumnMapping = { ...mapping, columns: ['date', 'description', 'debit'] }
      const { drafts } = normalizeRows(table([['F', 'C', 'D'], ['05/01/2026', 'A', '1,00']]), onlyDebit, ACCOUNT)
      expect(drafts[0]?.amount.cents).toBe(-100)
    })
  })

  it('tolerates ragged rows shorter than the mapping', () => {
    const { drafts, rowErrors } = normalizeRows(table([BASIC_HEADER, ['05/01/2026', 'X', '-1,00']]), signed, ACCOUNT)
    expect(rowErrors).toEqual([])
    expect(drafts[0]?.balance).toBeNull()
  })

  it('returns one error and no drafts when the mapping is invalid', () => {
    const bad: ColumnMapping = { ...signed, columns: ['description', 'amount'] }
    const { drafts, rowErrors } = normalizeRows(table([BASIC_HEADER, ['05/01/2026', 'X', '-1,00', '']]), bad, ACCOUNT)
    expect(drafts).toEqual([])
    expect(rowErrors).toHaveLength(1)
    expect(rowErrors[0]?.error.code).toBe('import.missingDateColumn')
  })

  it('does not mutate the table and handles 20k rows', () => {
    const rows = [BASIC_HEADER, ...Array.from({ length: 20_000 }, (_, i) => ['05/01/2026', `MOV ${i}`, '-1,00', ''])]
    const input = table(rows)
    const snapshot = JSON.stringify(input.rows[1])
    const { drafts } = normalizeRows(input, signed, ACCOUNT)
    expect(drafts).toHaveLength(20_000)
    expect(JSON.stringify(input.rows[1])).toBe(snapshot)
  })

  it('oracle: opening balance plus imported amounts matches the closing balance to the cent', () => {
    const rows = [BASIC_HEADER, ['01/01/2026', 'A', '-10,10', '89,90'], ['02/01/2026', 'B', '-0,20', '89,70'], ['03/01/2026', 'C', '1.000,05', '1.089,75']]
    const { drafts } = normalizeRows(table(rows), signed, ACCOUNT)
    const opening = 10_000
    const total = drafts.reduce((sum, d) => sum + d.amount.cents, 0)
    expect(opening + total).toBe(drafts[drafts.length - 1]?.balance?.cents)
  })
})
