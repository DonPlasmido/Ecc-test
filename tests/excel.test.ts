import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { readWorkbook, writeWorkbook } from '../src/io/excel'
import { makeXlsx, toArrayBuffer } from './helpers'

describe('readWorkbook', () => {
  it('lee cada hoja como una tabla con encabezados y filas', async () => {
    const data = await makeXlsx({
      Ventas: [['Producto', 'Cantidad'], ['Pan', 3], ['Leche', 2]],
      Otra: [['A'], [1]],
    })
    const sheets = await readWorkbook(data)
    expect(sheets.map((s) => s.name)).toEqual(['Ventas', 'Otra'])
    expect(sheets[0]!.table).toEqual({ headers: ['Producto', 'Cantidad'], rows: [['Pan', 3], ['Leche', 2]] })
  })

  it('rellena con null las celdas vacías para que todas las filas tengan el mismo ancho', async () => {
    const data = await makeXlsx({ H: [['A', 'B', 'C'], ['x'], [null, null, 'z']] })
    const [sheet] = await readWorkbook(data)
    expect(sheet!.table.rows).toEqual([['x', null, null], [null, null, 'z']])
  })

  it('pone nombre a los encabezados vacíos y distingue los repetidos', async () => {
    const data = await makeXlsx({ H: [['Nombre', null, 'Nombre'], [1, 2, 3]] })
    const [sheet] = await readWorkbook(data)
    expect(sheet!.table.headers).toEqual(['Nombre', 'Columna 2', 'Nombre (2)'])
  })

  it('añade columnas si alguna fila es más ancha que los encabezados', async () => {
    const data = await makeXlsx({ H: [['A'], [1, 2]] })
    const [sheet] = await readWorkbook(data)
    expect(sheet!.table.headers).toEqual(['A', 'Columna 2'])
    expect(sheet!.table.rows).toEqual([[1, 2]])
  })

  it('usa el resultado guardado de las fórmulas y el texto de enlaces y texto enriquecido', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('F')
    ws.addRow(['Total', 'Web', 'Nota'])
    ws.addRow([
      { formula: '1+1', result: 2 },
      { text: 'Ejemplo', hyperlink: 'https://example.com' },
      { richText: [{ text: 'Hola ' }, { text: 'mundo' }] },
    ])
    const data = toArrayBuffer((await wb.xlsx.writeBuffer()) as unknown as Uint8Array)
    const [sheet] = await readWorkbook(data)
    expect(sheet!.table.rows).toEqual([[2, 'Ejemplo', 'Hola mundo']])
  })

  it('lee las fechas como Date', async () => {
    const data = await makeXlsx({ H: [['Día'], [new Date(Date.UTC(2024, 0, 15))]] })
    const [sheet] = await readWorkbook(data)
    expect(sheet!.table.rows[0]![0]).toEqual(new Date(Date.UTC(2024, 0, 15)))
  })

  it('devuelve una tabla vacía para una hoja en blanco', async () => {
    const data = await makeXlsx({ Vacia: [] })
    const [sheet] = await readWorkbook(data)
    expect(sheet!.table).toEqual({ headers: [], rows: [] })
  })

  it('da un error claro si el archivo no es un Excel válido', async () => {
    const notExcel = new TextEncoder().encode('esto no es un excel').buffer as ArrayBuffer
    await expect(readWorkbook(notExcel)).rejects.toThrow(/no se pudo leer/i)
  })
})

describe('writeWorkbook', () => {
  it('escribe y se puede volver a leer igual (ida y vuelta)', async () => {
    const sheets = [
      { name: 'Limpia', table: { headers: ['A', 'B'], rows: [['x', 1], [null, true]] } },
    ]
    const back = await readWorkbook(await writeWorkbook(sheets))
    expect(back).toEqual(sheets)
  })

  it('pone los encabezados en negrita', async () => {
    const out = await writeWorkbook([{ name: 'H', table: { headers: ['A'], rows: [] } }])
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(out)
    expect(wb.getWorksheet('H')!.getCell('A1').font?.bold).toBe(true)
  })
})
