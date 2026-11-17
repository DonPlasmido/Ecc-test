/** Valor de una celda tal como lo usamos en la app. */
export type Cell = string | number | boolean | Date | null

export type Row = readonly Cell[]

/** Una tabla: la primera fila del Excel son los encabezados, el resto son datos. */
export interface Table {
  readonly headers: readonly string[]
  readonly rows: readonly Row[]
}

/** Una celda está en blanco si no tiene valor o solo tiene espacios. */
export function isBlank(cell: Cell): boolean {
  return cell === null || (typeof cell === 'string' && cell.trim() === '')
}

/**
 * Clave para comparar celdas. Incluye el tipo para no confundir el número 1 con el texto "1",
 * y usa el valor numérico de las fechas para que dos fechas iguales coincidan.
 */
export function cellKey(cell: Cell): string {
  if (cell === null) return 'null'
  if (cell instanceof Date) return `date:${cell.getTime()}`
  return `${typeof cell}:${String(cell)}`
}
