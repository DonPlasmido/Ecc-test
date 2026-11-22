import { parseSpanishDate } from '@/domain/date/parseSpanishDate'
import {
  HEADER_SEARCH_ROWS,
  type ColumnMapping,
  type ColumnMappingDetection,
  type ColumnRole,
} from '@/domain/import/ColumnMapping'
import { detectHeaderRow } from '@/domain/import/detectHeaderRow'
import { headerCellRole } from '@/domain/import/headerSynonyms'
import type { RawCell, RawTable } from '@/domain/import/RawTable'
import { parseSpanishAmount } from '@/domain/money/parseSpanishAmount'
import { domainError, type DomainError } from '@/domain/shared/DomainError'
import { normalizeText } from '@/domain/shared/normalizeText'
import { err, ok, type Result } from '@/domain/shared/Result'

/** Roles de requisitos: fecha, descripción e importe. */
const REQUIRED_GROUPS = 3
/** Sin cabecera la confianza nunca supera este valor. */
const NO_HEADER_MAX_CONFIDENCE = 0.5
/** Sin cabecera y con columnas numéricas ambiguas: obliga a confirmar el mapeo. */
const INCONCLUSIVE_MAX_CONFIDENCE = 0.4
/** Proporción de celdas que deben parecer fecha/importe para asignar la columna. */
const CONTENT_MATCH_RATIO = 0.8
const SINGLE_USE_ROLES: readonly ColumnRole[] = ['date', 'valueDate', 'description', 'amount', 'debit', 'credit', 'balance']

function confidenceOf(columns: readonly ColumnRole[]): number {
  const has = (role: ColumnRole): boolean => columns.includes(role)
  const found = [has('date'), has('description'), has('amount') || has('debit') || has('credit')]
  return found.filter(Boolean).length / REQUIRED_GROUPS
}

function conventionOf(columns: readonly ColumnRole[]): ColumnMapping['amountConvention'] {
  const hasAmount = columns.includes('amount')
  return !hasAmount && (columns.includes('debit') || columns.includes('credit')) ? 'debitCredit' : 'signed'
}

/** Roles por columna: el primero de cada papel gana; un importe único anula Debe/Haber. */
function rolesFromHeader(row: readonly RawCell[]): readonly ColumnRole[] {
  const taken = new Set<ColumnRole>()
  const roles = row.map((cell): ColumnRole => {
    const role = headerCellRole(cell)
    if (role === null || taken.has(role)) return 'ignore'
    taken.add(role)
    return role
  })
  const dated = taken.has('date') ? roles : promoteValueDate(roles)
  if (!taken.has('amount')) return dated
  return dated.map((role) => (role === 'debit' || role === 'credit' ? 'ignore' : role))
}

/** Si el extracto solo trae fecha valor (p. ej. ING «F. VALOR»), esa columna es la fecha del movimiento. */
function promoteValueDate(roles: readonly ColumnRole[]): readonly ColumnRole[] {
  return roles.map((role) => (role === 'valueDate' ? 'date' : role))
}

function cellText(cell: RawCell | undefined): string {
  if (cell === undefined || cell.kind === 'empty') return ''
  return cell.kind === 'number' ? String(cell.value) : cell.value.trim()
}

function looksLikeDate(cell: RawCell | undefined): boolean {
  if (cell?.kind === 'date') return true
  return cell?.kind === 'text' && parseSpanishDate(cell.value).ok
}

function looksLikeAmount(cell: RawCell | undefined): boolean {
  if (cell?.kind === 'number') return true
  return cell?.kind === 'text' && !looksLikeDate(cell) && parseSpanishAmount(cell.value).ok
}

function ratio(cells: readonly (RawCell | undefined)[], test: (cell: RawCell | undefined) => boolean): number {
  const filled = cells.filter((cell) => cellText(cell) !== '')
  return filled.length === 0 ? 0 : filled.filter(test).length / filled.length
}

/** `true` si en cada fila de la muestra exactamente una de las dos columnas tiene valor. */
function areComplementary(sample: readonly (readonly RawCell[])[], first: number, second: number): boolean {
  return sample.every((row) => (cellText(row[first]) !== '') !== (cellText(row[second]) !== ''))
}

/** Primer par de columnas numéricas con relleno complementario (Debe/Haber), o `null`. */
function findDebitCreditPair(sample: readonly (readonly RawCell[])[], numeric: readonly number[]): readonly [number, number] | null {
  for (let i = 0; i < numeric.length; i += 1) {
    for (let j = i + 1; j < numeric.length; j += 1) {
      const first = numeric[i] ?? 0
      const second = numeric[j] ?? 0
      if (areComplementary(sample, first, second)) return [first, second]
    }
  }
  return null
}

interface ContentRoles {
  readonly roles: readonly ColumnRole[]
  /** `false` si hay varias columnas numéricas y no se pudo distinguir su papel. */
  readonly conclusive: boolean
}

function assignNumericRoles(roles: ColumnRole[], sample: readonly (readonly RawCell[])[], numeric: readonly number[]): boolean {
  const pair = numeric.length >= 2 ? findDebitCreditPair(sample, numeric) : null
  if (pair !== null) {
    roles[pair[0]] = 'debit'
    roles[pair[1]] = 'credit'
    const rest = numeric.filter((col) => !pair.includes(col))
    if (rest[0] !== undefined) roles[rest[0]] = 'balance'
    return true
  }
  const amountRoles: ColumnRole[] = ['amount', 'balance']
  for (const col of numeric) roles[col] = amountRoles.shift() ?? 'ignore'
  return numeric.length < 2
}

/** Sin cabecera: deduce fecha, descripción, importe y saldo por el contenido de las primeras filas. */
function rolesFromContent(table: RawTable): ContentRoles {
  const sample = table.rows.slice(0, HEADER_SEARCH_ROWS).filter((row) => row.some((cell) => cellText(cell) !== ''))
  const width = Math.max(0, ...sample.map((row) => row.length))
  const roles: ColumnRole[] = Array.from({ length: width }, () => 'ignore')
  const dateRoles: ColumnRole[] = ['date', 'valueDate']
  const numeric: number[] = []
  let bestText = { index: -1, length: 0 }
  for (let col = 0; col < width; col += 1) {
    const cells = sample.map((row) => row[col])
    if (ratio(cells, looksLikeDate) >= CONTENT_MATCH_RATIO) {
      roles[col] = dateRoles.shift() ?? 'ignore'
    } else if (ratio(cells, looksLikeAmount) >= CONTENT_MATCH_RATIO) {
      numeric.push(col)
    } else {
      const length = cells.reduce((sum, cell) => sum + cellText(cell).length, 0)
      if (length > bestText.length) bestText = { index: col, length }
    }
  }
  const conclusive = assignNumericRoles(roles, sample, numeric)
  if (bestText.index >= 0) roles[bestText.index] = 'description'
  return { roles, conclusive }
}

/** Detecta fila de cabecera y papel de cada columna, con una confianza de 0 a 1. */
export function detectColumnMapping(table: RawTable): ColumnMappingDetection {
  const headerRowIndex = detectHeaderRow(table)
  if (headerRowIndex >= 0) {
    const columns = rolesFromHeader(table.rows[headerRowIndex] ?? [])
    return {
      mapping: { headerRowIndex, columns, amountConvention: conventionOf(columns) },
      confidence: confidenceOf(columns),
    }
  }
  const { roles: columns, conclusive } = rolesFromContent(table)
  const cap = conclusive ? NO_HEADER_MAX_CONFIDENCE : INCONCLUSIVE_MAX_CONFIDENCE
  return {
    mapping: { headerRowIndex: -1, columns, amountConvention: conventionOf(columns) },
    confidence: Math.min(confidenceOf(columns) * NO_HEADER_MAX_CONFIDENCE, cap),
  }
}

function missing(code: DomainError['code'], field: string): Result<never, DomainError> {
  return err(domainError(code, { field }))
}

/** Comprueba que el mapeo es coherente y tiene las columnas obligatorias. */
export function validateMapping(mapping: ColumnMapping): Result<ColumnMapping, DomainError> {
  const { columns } = mapping
  const validHeader = Number.isInteger(mapping.headerRowIndex) && mapping.headerRowIndex >= -1
  const duplicated = SINGLE_USE_ROLES.some((role) => columns.filter((r) => r === role).length > 1)
  if (!validHeader || duplicated) return missing('import.invalidMapping', validHeader ? 'columns' : 'headerRowIndex')
  if (!columns.includes('date')) return missing('import.missingDateColumn', 'date')
  if (!columns.includes('description')) return missing('import.missingDescriptionColumn', 'description')
  const hasAmount =
    mapping.amountConvention === 'signed'
      ? columns.includes('amount')
      : columns.includes('debit') || columns.includes('credit')
  return hasAmount ? ok(mapping) : missing('import.missingAmountColumn', 'amount')
}

/** Firma estable de una cabecera (sin mayúsculas, tildes ni espacios sobrantes) para recordar el mapeo por banco. */
export function headerSignature(headers: readonly string[]): string {
  return headers.map(normalizeText).join('|')
}
