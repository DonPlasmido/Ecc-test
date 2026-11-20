import { HEADER_SEARCH_ROWS } from '@/domain/import/ColumnMapping'
import { headerCellRole } from '@/domain/import/headerSynonyms'
import type { RawTable } from '@/domain/import/RawTable'

/** Roles distintos mínimos para considerar que una fila es la cabecera. */
const MIN_HEADER_ROLES = 2

/** Índice de la fila de cabecera entre las primeras 20 (la que reconoce más columnas), o -1. */
export function detectHeaderRow(table: RawTable): number {
  let bestIndex = -1
  let bestScore = MIN_HEADER_ROLES - 1
  table.rows.slice(0, HEADER_SEARCH_ROWS).forEach((row, index) => {
    const roles = new Set(row.map(headerCellRole).filter((role) => role !== null))
    if (roles.size > bestScore) {
      bestScore = roles.size
      bestIndex = index
    }
  })
  return bestIndex
}
