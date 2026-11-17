import { describe, it, expect } from 'vitest'
import { groupTotals, numericColumns, OTHERS_LABEL, summarizeColumn, toNumber } from '../src/core/summary'
import type { Table } from '../src/core/table'

describe('toNumber', () => {
  it.each([
    [12, 12],
    ['12', 12],
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['1.234,5', 1234.5],
    ['1.234.567', 1234567],
    [' -3,25 € ', -3.25],
    ['15%', 15],
  ])('convierte %j en %j', (input, expected) => {
    expect(toNumber(input)).toBe(expected)
  })

  it.each([[null], [''], ['hola'], [true], [new Date('2024-01-01')], ['1,2,3'], [Number.NaN]])(
    'devuelve null para %j',
    (input) => {
      expect(toNumber(input)).toBeNull()
    },
  )
})

const ventas: Table = {
  headers: ['Tienda', 'Importe', 'Nota'],
  rows: [
    ['Centro', 100, 'ok'],
    ['Norte', '50,5', null],
    ['Centro', 25, 'x'],
    ['Sur', 'sin dato', null],
    [null, null, null],
  ],
}

describe('summarizeColumn', () => {
  it('calcula total, media, mínimo y máximo de los valores numéricos', () => {
    expect(summarizeColumn(ventas, 1)).toEqual({
      filled: 4, numeric: 3, ignored: 1, sum: 175.5, mean: 58.5, min: 25, max: 100,
    })
  })

  it('devuelve null en media, mínimo y máximo si no hay números', () => {
    expect(summarizeColumn(ventas, 2)).toEqual({ filled: 2, numeric: 0, ignored: 2, sum: 0, mean: null, min: null, max: null })
  })

  it('da un error claro si la columna no existe', () => {
    expect(() => summarizeColumn(ventas, 7)).toThrow(/columna/)
  })
})

describe('numericColumns', () => {
  it('devuelve las columnas que tienen al menos un número', () => {
    expect(numericColumns(ventas)).toEqual([1])
  })
})

describe('groupTotals', () => {
  it('suma los valores por grupo y ordena de mayor a menor', () => {
    expect(groupTotals(ventas, 0, 1)).toEqual([
      { label: 'Centro', total: 125 },
      { label: 'Norte', total: 50.5 },
    ])
  })

  it('agrupa lo que no cabe en «Otros»', () => {
    const t: Table = { headers: ['G', 'V'], rows: [['a', 5], ['b', 4], ['c', 3], ['d', 2]] }
    expect(groupTotals(t, 0, 1, 2)).toEqual([
      { label: 'a', total: 5 },
      { label: 'b', total: 4 },
      { label: OTHERS_LABEL, total: 5 },
    ])
  })

  it('usa «(vacío)» para filas sin grupo y formatea las fechas', () => {
    const t: Table = { headers: ['G', 'V'], rows: [[null, 1], [new Date(Date.UTC(2024, 4, 3)), 2]] }
    expect(groupTotals(t, 0, 1)).toEqual([
      { label: '2024-05-03', total: 2 },
      { label: '(vacío)', total: 1 },
    ])
  })
})
