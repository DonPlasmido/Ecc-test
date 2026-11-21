import type { AccountId } from '@/domain/account/Account'
import { isoDateFromParts, type IsoDate } from '@/domain/date/IsoDate'
import { parseSpanishDate } from '@/domain/date/parseSpanishDate'
import type { ColumnMapping, ColumnRole, NormalizedRows } from '@/domain/import/ColumnMapping'
import { validateMapping } from '@/domain/import/detectColumnMapping'
import type { RawCell, RawTable } from '@/domain/import/RawTable'
import type { RowError } from '@/domain/import/RowError'
import { Money } from '@/domain/money/Money'
import type { RowWarning } from '@/domain/import/RowWarning'
import { isAmbiguousAmount, parseSpanishAmount } from '@/domain/money/parseSpanishAmount'
import { domainError, type DomainError } from '@/domain/shared/DomainError'
import { normalizeText } from '@/domain/shared/normalizeText'
import { err, ok, type Result } from '@/domain/shared/Result'
import type { TransactionDraft } from '@/domain/transaction/Transaction'

/** Tolerancia al convertir un número nativo en céntimos (errores de coma flotante, no terceros decimales: 12.3401 se rechaza). */
const FLOAT_TOLERANCE = 1e-6

type Row = readonly RawCell[]

function cellText(cell: RawCell | undefined): string {
  if (cell === undefined || cell.kind === 'empty') return ''
  return cell.kind === 'number' ? String(cell.value) : cell.value.trim()
}

function invalidAmount(cell: RawCell | undefined): Result<never, DomainError> {
  return err(domainError('money.invalidAmount', { field: 'amount', value: cellText(cell).slice(0, 50) }))
}

function parseAmountCell(cell: RawCell | undefined): Result<Money, DomainError> {
  if (cell?.kind === 'number') {
    if (!Number.isFinite(cell.value)) return invalidAmount(cell)
    const scaled = cell.value * 100
    const rounded = Math.round(scaled)
    if (Math.abs(scaled - rounded) > FLOAT_TOLERANCE) return invalidAmount(cell)
    return Money.ofCents(rounded)
  }
  if (cell?.kind === 'text' && cell.value.trim() !== '') return parseSpanishAmount(cell.value)
  return invalidAmount(cell)
}

/** Números de serie de Excel plausibles como fecha (1954-2119): descarta importes y códigos sueltos. */
const EXCEL_SERIAL_MIN = 20000
const EXCEL_SERIAL_MAX = 80000
/** Época de los números de serie de Excel (1900 con el error del año bisiesto ya absorbido). */
const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86_400_000

/**
 * Una celda numérica en la columna de fecha es un número de serie de Excel (formato General). Se resuelve aquí
 * y no en el parser porque solo el mapeo sabe qué columna es la fecha; el parser no puede distinguirla de un importe.
 */
function excelSerialToDate(serial: number): Result<IsoDate, DomainError> {
  if (!Number.isFinite(serial) || serial < EXCEL_SERIAL_MIN || serial > EXCEL_SERIAL_MAX) {
    return err(domainError('date.invalidFormat', { field: 'date', value: String(serial).slice(0, MAX_REPORTED_LENGTH) }))
  }
  const utc = new Date(EXCEL_EPOCH_UTC_MS + Math.floor(serial) * MS_PER_DAY)
  return isoDateFromParts(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
}

function parseDateCell(cell: RawCell | undefined): Result<IsoDate, DomainError> {
  if (cell?.kind === 'date') return ok(cell.value)
  if (cell?.kind === 'number') return excelSerialToDate(cell.value)
  if (cell?.kind === 'text') return parseSpanishDate(cell.value)
  return err(domainError('date.invalidFormat', { field: 'date', value: cellText(cell).slice(0, 50) }))
}

function optionalOf<T>(result: Result<T, DomainError>): T | null {
  return result.ok ? result.value : null
}

function magnitude(money: Money): Money {
  return Money.isExpense(money) ? Money.negate(money) : money
}

/** Debe/Haber: el cargo siempre resta y el abono siempre suma, sea cual sea el signo escrito. */
function parseDebitCredit(debit: RawCell | undefined, credit: RawCell | undefined): Result<Money, DomainError> {
  if (cellText(debit) === '' && cellText(credit) === '') return invalidAmount(debit)
  let total = Money.zero()
  if (cellText(credit) !== '') {
    const parsed = parseAmountCell(credit)
    if (!parsed.ok) return parsed
    total = Money.add(total, magnitude(parsed.value))
  }
  if (cellText(debit) !== '') {
    const parsed = parseAmountCell(debit)
    if (!parsed.ok) return parsed
    total = Money.subtract(total, magnitude(parsed.value))
  }
  return ok(total)
}

interface RowReader {
  readonly at: (role: ColumnRole) => RawCell | undefined
}

function readerFor(row: Row, mapping: ColumnMapping): RowReader {
  return { at: (role) => row[mapping.columns.indexOf(role)] }
}

function toDraft(row: Row, mapping: ColumnMapping, accountId: AccountId, line: number): Result<TransactionDraft, DomainError> {
  const cells = readerFor(row, mapping)
  const date = parseDateCell(cells.at('date'))
  if (!date.ok) return date
  const rawDescription = cellText(cells.at('description'))
  const normalizedDescription = normalizeText(rawDescription)
  if (normalizedDescription === '') return err(domainError('import.emptyDescription', { field: 'description' }))
  const amount =
    mapping.amountConvention === 'debitCredit'
      ? parseDebitCredit(cells.at('debit'), cells.at('credit'))
      : parseAmountCell(cells.at('amount'))
  if (!amount.ok) return amount
  const valueDateCell = cells.at('valueDate')
  const balanceCell = cells.at('balance')
  return ok({
    accountId,
    date: date.value,
    valueDate: cellText(valueDateCell) === '' ? null : optionalOf(parseDateCell(valueDateCell)),
    amount: amount.value,
    balance: cellText(balanceCell) === '' ? null : optionalOf(parseAmountCell(balanceCell)),
    rawDescription,
    normalizedDescription,
    sourceLine: line,
  })
}

const AMOUNT_ROLES: readonly ColumnRole[] = ['amount', 'debit', 'credit']
const MAX_REPORTED_LENGTH = 50

function ambiguousAmountWarnings(row: Row, mapping: ColumnMapping, line: number): readonly RowWarning[] {
  return AMOUNT_ROLES.flatMap((role): RowWarning[] => {
    const cell = row[mapping.columns.indexOf(role)]
    if (cell?.kind !== 'text' || !isAmbiguousAmount(cell.value)) return []
    return [{ line, code: 'ambiguousAmount', value: cell.value.trim().slice(0, MAX_REPORTED_LENGTH) }]
  })
}

/** Convierte las filas de datos en borradores válidos; las filas malas se descartan con su `RowError`. */
export function normalizeRows(table: RawTable, mapping: ColumnMapping, accountId: AccountId): NormalizedRows {
  const valid = validateMapping(mapping)
  if (!valid.ok) return { drafts: [], rowErrors: [{ line: Math.max(mapping.headerRowIndex + 1, 1), error: valid.error }], warnings: [] }
  const drafts: TransactionDraft[] = []
  const rowErrors: RowError[] = []
  const warnings: RowWarning[] = []
  table.rows.forEach((row, index) => {
    if (index <= mapping.headerRowIndex || row.every((cell) => cellText(cell) === '')) return
    const line = index + 1
    const result = toDraft(row, mapping, accountId, line)
    if (result.ok) {
      drafts.push(result.value)
      warnings.push(...ambiguousAmountWarnings(row, mapping, line))
    }
    else rowErrors.push({ line, error: result.error })
  })
  return { drafts, rowErrors, warnings }
}
