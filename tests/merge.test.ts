import { describe, it, expect } from 'vitest'
import { mergeTables, SOURCE_HEADER } from '../src/core/merge'
import type { Table } from '../src/core/table'

const enero: Table = { headers: ['Producto', 'Cantidad'], rows: [['Pan', 3], ['Leche', 2]] }
const febrero: Table = { headers: ['Producto', 'Cantidad'], rows: [['Huevos', 12]] }

describe('mergeTables', () => {
  it('pone las filas de todas las tablas una detrás de otra', () => {
    const result = mergeTables([{ source: 'enero.xlsx', table: enero }, { source: 'febrero.xlsx', table: febrero }])
    expect(result.table).toEqual({ headers: ['Producto', 'Cantidad'], rows: [['Pan', 3], ['Leche', 2], ['Huevos', 12]] })
    expect(result.warnings).toEqual([])
  })

  it('puede añadir una columna con el origen de cada fila', () => {
    const result = mergeTables(
      [{ source: 'enero.xlsx', table: enero }, { source: 'febrero.xlsx', table: febrero }],
      { addSourceColumn: true },
    )
    expect(result.table.headers).toEqual([SOURCE_HEADER, 'Producto', 'Cantidad'])
    expect(result.table.rows[2]).toEqual(['febrero.xlsx', 'Huevos', 12])
  })

  it('empareja columnas por nombre aunque estén en otro orden o con otras mayúsculas', () => {
    const otroOrden: Table = { headers: ['cantidad ', 'PRODUCTO'], rows: [[5, 'Sal']] }
    const result = mergeTables([{ source: 'a', table: enero }, { source: 'b', table: otroOrden }])
    expect(result.table.headers).toEqual(['Producto', 'Cantidad'])
    expect(result.table.rows[2]).toEqual(['Sal', 5])
  })

  it('añade columnas nuevas al final, deja huecos donde faltan y lo avisa', () => {
    const conPrecio: Table = { headers: ['Producto', 'Precio'], rows: [['Sal', 1.5]] }
    const result = mergeTables([{ source: 'a.xlsx', table: enero }, { source: 'b.xlsx', table: conPrecio }])
    expect(result.table.headers).toEqual(['Producto', 'Cantidad', 'Precio'])
    expect(result.table.rows).toEqual([['Pan', 3, null], ['Leche', 2, null], ['Sal', null, 1.5]])
    expect(result.warnings).toEqual([
      'b.xlsx no tiene la columna «Cantidad».',
      'b.xlsx tiene una columna que los anteriores no tenían: «Precio».',
    ])
  })

  it('cuenta cuántas filas aporta cada origen', () => {
    const result = mergeTables([{ source: 'a', table: enero }, { source: 'b', table: febrero }])
    expect(result.rowsPerSource).toEqual([{ source: 'a', rows: 2 }, { source: 'b', rows: 1 }])
  })

  it('exige al menos dos tablas', () => {
    expect(() => mergeTables([{ source: 'a', table: enero }])).toThrow(/al menos dos/)
  })

  it('no modifica las tablas originales', () => {
    const copy = structuredClone(enero)
    mergeTables([{ source: 'a', table: enero }, { source: 'b', table: febrero }], { addSourceColumn: true })
    expect(enero).toEqual(copy)
  })
})

describe('mergeTables con una columna «Origen» ya existente', () => {
  it('no repite el nombre de la columna de origen', () => {
    const conOrigen: Table = { headers: ['Origen', 'Valor'], rows: [['tienda', 1]] }
    const result = mergeTables(
      [{ source: 'a.xlsx', table: conOrigen }, { source: 'b.xlsx', table: conOrigen }],
      { addSourceColumn: true },
    )
    expect(result.table.headers).toEqual(['Archivo de origen', 'Origen', 'Valor'])
  })
})
