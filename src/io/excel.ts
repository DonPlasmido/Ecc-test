import ExcelJS from 'exceljs'
import type { Cell, Row, Table } from '../core/table'

export interface Sheet {
  readonly name: string
  readonly table: Table
}

const READ_ERROR = 'No se pudo leer el archivo de Excel. Comprueba que es un .xlsx válido y que no está dañado.'

/** Convierte lo que devuelve ExcelJS (fórmulas, enlaces, texto con formato…) en un valor simple. */
function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value
  if (typeof value !== 'object') return String(value)

  const v = value as Record<string, unknown>
  if ('formula' in v || 'sharedFormula' in v) return toCell(v.result)
  if (Array.isArray(v.richText)) {
    return (v.richText as { text?: unknown }[]).map((part) => String(part.text ?? '')).join('')
  }
  if ('text' in v) return toCell(v.text)
  if ('error' in v) return String(v.error)
  return String(value)
}

function headerName(cell: Cell, index: number): string {
  if (cell === null || (typeof cell === 'string' && cell.trim() === '')) return `Columna ${index + 1}`
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell).trim()
}

/** Pone nombre a encabezados vacíos y numera los repetidos: Nombre, Nombre (2)… */
function uniqueHeaders(raw: readonly Cell[]): string[] {
  const used = new Map<string, number>()
  return raw.map((cell, i) => {
    const base = headerName(cell, i)
    const count = (used.get(base) ?? 0) + 1
    used.set(base, count)
    return count === 1 ? base : `${base} (${count})`
  })
}

function readSheet(ws: ExcelJS.Worksheet): Table {
  if (ws.rowCount === 0) return { headers: [], rows: [] }

  const raw: Cell[][] = []
  let width = 0
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    width = Math.max(width, row.cellCount)
    raw.push(Array.from({ length: row.cellCount }, (_, c) => toCell(row.getCell(c + 1).value)))
  }

  const pad = (row: readonly Cell[]): Row => Array.from({ length: width }, (_, c) => row[c] ?? null)
  const [headerRow = [], ...dataRows] = raw
  return { headers: uniqueHeaders(pad(headerRow)), rows: dataRows.map(pad) }
}

/** Lee todas las hojas de un .xlsx. La primera fila de cada hoja se usa como encabezados. */
export async function readWorkbook(data: ArrayBuffer): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(data)
  } catch (cause) {
    throw new Error(READ_ERROR, { cause })
  }
  return wb.worksheets.map((ws) => ({ name: ws.name, table: readSheet(ws) }))
}

/** Excel no permite ciertos caracteres ni más de 31 letras en el nombre de una hoja. */
export function safeSheetName(name: string, fallback = 'Hoja'): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31)
  return cleaned || fallback
}

/** Escribe un .xlsx con una hoja por tabla y los encabezados en negrita. */
export async function writeWorkbook(sheets: readonly Sheet[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  for (const { name, table } of sheets) {
    const ws = wb.addWorksheet(safeSheetName(name))
    ws.addRow([...table.headers]).font = { bold: true }
    for (const row of table.rows) ws.addRow([...row])
  }
  const out = new Uint8Array(await wb.xlsx.writeBuffer())
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)
}
