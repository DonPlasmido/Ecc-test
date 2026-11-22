import { describe, expect, it } from 'vitest'
import { detectColumnMapping } from '@/domain/import/detectColumnMapping'
import { table } from './builders'

describe('header synonyms: operation and value dates', () => {
  it.each([
    [['F. Operativa', 'Concepto', 'F. Valor', 'Importe'], ['date', 'description', 'valueDate', 'amount']],
    [['F. Operación', 'Concepto', 'F. Valor', 'Importe'], ['date', 'description', 'valueDate', 'amount']],
    [['Fecha operación', 'Concepto', 'Fecha valor', 'Importe'], ['date', 'description', 'valueDate', 'amount']],
    [['F.Valor', 'Fecha', 'Concepto', 'Importe'], ['valueDate', 'date', 'description', 'amount']],
  ])('%j keeps the operation date as date and the value date as valueDate', (header, expected) => {
    expect(detectColumnMapping(table([header])).mapping.columns).toEqual(expected)
  })

  it.each([['F. VALOR'], ['Fecha valor']])('a lone «%s» column is used as the date', (name) => {
    const { mapping, confidence } = detectColumnMapping(table([[name, 'Descripción', 'Importe', 'Saldo']]))
    expect(mapping.columns).toEqual(['date', 'description', 'amount', 'balance'])
    expect(confidence).toBe(1)
  })
})
