import { isBlank, type Cell, type Table } from './table'

export const OTHERS_LABEL = 'Otros'
export const EMPTY_LABEL = '(vacío)'
export const DEFAULT_GROUP_LIMIT = 15

/** 1.234,5 (formato español con miles) */
const SPANISH_THOUSANDS = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/
/** 12,5 */
const COMMA_DECIMAL = /^-?\d+(,\d+)?$/
/** 12.5 */
const DOT_DECIMAL = /^-?\d+(\.\d+)?$/

/**
 * Convierte una celda en número si se puede. Entiende números guardados como texto,
 * con coma decimal, puntos de miles, «€» y «%». «1.234» se interpreta como mil doscientos
 * treinta y cuatro (formato español).
 */
export function toNumber(cell: unknown): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null
  if (typeof cell !== 'string') return null

  const text = cell.replace(/[\s€%]/g, '')
  if (SPANISH_THOUSANDS.test(text)) return Number(text.replace(/\./g, '').replace(',', '.'))
  if (COMMA_DECIMAL.test(text)) return Number(text.replace(',', '.'))
  if (DOT_DECIMAL.test(text)) return Number(text)
  return null
}

export interface ColumnSummary {
  /** Celdas con algo escrito. */
  readonly filled: number
  /** Celdas que son números. */
  readonly numeric: number
  /** Celdas con algo escrito que no es un número (no cuentan en los cálculos). */
  readonly ignored: number
  readonly sum: number
  readonly mean: number | null
  readonly min: number | null
  readonly max: number | null
}

function assertColumn(table: Table, index: number): void {
  if (index < 0 || index >= table.headers.length) throw new Error(`La columna ${index + 1} no existe en esta hoja.`)
}

export function summarizeColumn(table: Table, index: number): ColumnSummary {
  assertColumn(table, index)
  const cells = table.rows.map((row) => row[index] ?? null).filter((c) => !isBlank(c))
  const numbers = cells.map(toNumber).filter((n): n is number => n !== null)
  const sum = numbers.reduce((a, b) => a + b, 0)
  const hasNumbers = numbers.length > 0
  return {
    filled: cells.length,
    numeric: numbers.length,
    ignored: cells.length - numbers.length,
    sum,
    mean: hasNumbers ? sum / numbers.length : null,
    min: hasNumbers ? Math.min(...numbers) : null,
    max: hasNumbers ? Math.max(...numbers) : null,
  }
}

/** Índices de las columnas que tienen al menos un número. */
export function numericColumns(table: Table): number[] {
  return table.headers
    .map((_, i) => i)
    .filter((i) => table.rows.some((row) => toNumber(row[i] ?? null) !== null))
}

function groupLabel(cell: Cell): string {
  if (isBlank(cell)) return EMPTY_LABEL
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell).trim()
}

export interface GroupTotal {
  readonly label: string
  readonly total: number
}

/** Suma `valueIndex` agrupando por `labelIndex`. Los grupos que no caben en `limit` se juntan en «Otros». */
export function groupTotals(table: Table, labelIndex: number, valueIndex: number, limit = DEFAULT_GROUP_LIMIT): GroupTotal[] {
  assertColumn(table, labelIndex)
  assertColumn(table, valueIndex)

  const totals = new Map<string, number>()
  for (const row of table.rows) {
    const value = toNumber(row[valueIndex] ?? null)
    if (value === null) continue
    const label = groupLabel(row[labelIndex] ?? null)
    totals.set(label, (totals.get(label) ?? 0) + value)
  }

  const sorted = [...totals].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total)
  if (sorted.length <= limit) return sorted
  const rest = sorted.slice(limit).reduce((sum, g) => sum + g.total, 0)
  return [...sorted.slice(0, limit), { label: OTHERS_LABEL, total: rest }]
}
