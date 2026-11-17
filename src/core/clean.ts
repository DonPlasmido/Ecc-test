import { cellKey, isBlank, type Cell, type Row, type Table } from './table'

export interface CleanOptions {
  /** Quitar filas en las que todas las celdas están vacías. */
  readonly removeEmptyRows: boolean
  /** Quitar filas repetidas, dejando solo la primera. */
  readonly removeDuplicates: boolean
  /** Quitar espacios al principio y al final de los textos. */
  readonly trimText: boolean
}

export interface CleanResult {
  readonly table: Table
  readonly removedEmpty: number
  readonly removedDuplicates: number
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  removeEmptyRows: true,
  removeDuplicates: true,
  trimText: true,
}

const trimCell = (cell: Cell): Cell => (typeof cell === 'string' ? cell.trim() : cell)

export function cleanTable(table: Table, options: CleanOptions = DEFAULT_CLEAN_OPTIONS): CleanResult {
  const rows: Row[] = []
  const seen = new Set<string>()
  let removedEmpty = 0
  let removedDuplicates = 0

  for (const original of table.rows) {
    const row = options.trimText ? original.map(trimCell) : original

    if (options.removeEmptyRows && row.every(isBlank)) {
      removedEmpty++
      continue
    }
    if (options.removeDuplicates) {
      const key = JSON.stringify(row.map(cellKey))
      if (seen.has(key)) {
        removedDuplicates++
        continue
      }
      seen.add(key)
    }
    rows.push(row)
  }

  return { table: { headers: table.headers, rows }, removedEmpty, removedDuplicates }
}
