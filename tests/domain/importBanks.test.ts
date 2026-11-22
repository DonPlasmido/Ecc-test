import { describe, expect, it } from 'vitest'
import { detectColumnMapping } from '@/domain/import/detectColumnMapping'
import { table } from './builders'

describe('header synonyms: balance', () => {
  it.each(['Disponible', 'DISPONIBLE', 'Saldo'])('«%s» is recognised as the balance column', (name) => {
    const { mapping } = detectColumnMapping(table([['Fecha', 'Concepto', 'Importe', name]]))
    expect(mapping.columns).toEqual(['date', 'description', 'amount', 'balance'])
  })
})
