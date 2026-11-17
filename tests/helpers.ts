import ExcelJS from 'exceljs'
import type { Cell } from '../src/core/table'

/** Crea un .xlsx en memoria con las filas dadas (la primera fila son los encabezados). */
export async function makeXlsx(sheets: Record<string, Cell[][]>): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name)
    rows.forEach((row) => ws.addRow(row))
  }
  const buf = await wb.xlsx.writeBuffer()
  return toArrayBuffer(buf as unknown as Uint8Array)
}

export function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}
