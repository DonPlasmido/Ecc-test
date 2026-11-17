import { describe, it, expect } from 'vitest'
import { cleanTable } from '../src/core/clean'
import type { Table } from '../src/core/table'

const table = (rows: Table['rows']): Table => ({ headers: ['Nombre', 'Edad'], rows })

describe('cleanTable', () => {
  it('quita filas totalmente vacías', () => {
    const result = cleanTable(table([['Ana', 30], [null, null], ['', '  '], ['Luis', 25]]))
    expect(result.table.rows).toEqual([['Ana', 30], ['Luis', 25]])
    expect(result.removedEmpty).toBe(2)
  })

  it('quita duplicados y conserva la primera aparición', () => {
    const result = cleanTable(table([['Ana', 30], ['Luis', 25], ['Ana', 30]]))
    expect(result.table.rows).toEqual([['Ana', 30], ['Luis', 25]])
    expect(result.removedDuplicates).toBe(1)
  })

  it('considera iguales los textos que solo se diferencian en espacios al principio o al final', () => {
    const result = cleanTable(table([['Ana ', 30], [' Ana', 30]]))
    expect(result.table.rows).toEqual([['Ana', 30]])
    expect(result.removedDuplicates).toBe(1)
  })

  it('no confunde el número 1 con el texto "1"', () => {
    const result = cleanTable(table([['x', 1], ['x', '1']]))
    expect(result.table.rows).toHaveLength(2)
  })

  it('compara fechas por su valor', () => {
    const d = (s: string) => new Date(s)
    const result = cleanTable(table([['x', d('2024-01-01')], ['x', d('2024-01-01')], ['x', d('2024-01-02')]]))
    expect(result.table.rows).toHaveLength(2)
  })

  it('respeta las opciones desactivadas', () => {
    const input = table([['Ana ', 30], [null, null], ['Ana ', 30]])
    const result = cleanTable(input, { removeEmptyRows: false, removeDuplicates: false, trimText: false })
    expect(result.table.rows).toEqual(input.rows)
    expect(result.removedEmpty).toBe(0)
    expect(result.removedDuplicates).toBe(0)
  })

  it('no modifica la tabla original', () => {
    const input = table([['Ana ', 30], ['Ana', 30]])
    const copy = structuredClone(input)
    cleanTable(input)
    expect(input).toEqual(copy)
  })

  it('funciona con una tabla sin filas', () => {
    const result = cleanTable(table([]))
    expect(result).toEqual({ table: table([]), removedEmpty: 0, removedDuplicates: 0 })
  })
})
