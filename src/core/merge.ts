import type { Cell, Row, Table } from './table'

export const SOURCE_HEADER = 'Origen'
/** Se usa si alguna tabla ya tiene una columna «Origen». */
export const SOURCE_HEADER_ALT = 'Archivo de origen'

export interface MergeInput {
  /** Nombre que identifica de dónde viene la tabla (archivo y, si hace falta, hoja). */
  readonly source: string
  readonly table: Table
}

export interface MergeOptions {
  readonly addSourceColumn: boolean
}

export interface MergeResult {
  readonly table: Table
  readonly warnings: readonly string[]
  readonly rowsPerSource: readonly { readonly source: string; readonly rows: number }[]
}

const normalize = (header: string): string => header.trim().toLowerCase()

const quoteList = (names: readonly string[]): string => names.map((n) => `«${n}»`).join(', ')

/** Lista de columnas final: las de la primera tabla y, al final, las nuevas que vayan apareciendo. */
function collectHeaders(inputs: readonly MergeInput[]): { headers: string[]; warnings: string[] } {
  const headers: string[] = []
  const known = new Set<string>()
  const warnings: string[] = []

  inputs.forEach(({ source, table }, i) => {
    const own = new Set(table.headers.map(normalize))
    const added = table.headers.filter((h) => !known.has(normalize(h)))
    if (i > 0) {
      const missing = headers.filter((h) => !own.has(normalize(h)))
      if (missing.length === 1) warnings.push(`${source} no tiene la columna ${quoteList(missing)}.`)
      if (missing.length > 1) warnings.push(`${source} no tiene las columnas ${quoteList(missing)}.`)
      if (added.length === 1) warnings.push(`${source} tiene una columna que los anteriores no tenían: ${quoteList(added)}.`)
      if (added.length > 1) warnings.push(`${source} tiene columnas que los anteriores no tenían: ${quoteList(added)}.`)
    }
    for (const h of added) {
      known.add(normalize(h))
      headers.push(h.trim())
    }
  })
  return { headers, warnings }
}

/** Reordena una fila para que encaje con las columnas finales; lo que falte queda vacío. */
function alignRow(row: Row, ownHeaders: readonly string[], finalHeaders: readonly string[]): Cell[] {
  const position = new Map(ownHeaders.map((h, i) => [normalize(h), i]))
  return finalHeaders.map((h) => {
    const i = position.get(normalize(h))
    return i === undefined ? null : (row[i] ?? null)
  })
}

/** Junta varias tablas en una, emparejando las columnas por su nombre. */
export function mergeTables(
  inputs: readonly MergeInput[],
  options: MergeOptions = { addSourceColumn: false },
): MergeResult {
  if (inputs.length < 2) throw new Error('Elige al menos dos archivos u hojas para juntar.')

  const { headers, warnings } = collectHeaders(inputs)
  const rows = inputs.flatMap(({ source, table }) =>
    table.rows.map((row) => {
      const aligned = alignRow(row, table.headers, headers)
      return options.addSourceColumn ? [source, ...aligned] : aligned
    }),
  )

  const sourceHeader = headers.some((h) => normalize(h) === normalize(SOURCE_HEADER)) ? SOURCE_HEADER_ALT : SOURCE_HEADER
  return {
    table: { headers: options.addSourceColumn ? [sourceHeader, ...headers] : headers, rows },
    warnings,
    rowsPerSource: inputs.map(({ source, table }) => ({ source, rows: table.rows.length })),
  }
}
