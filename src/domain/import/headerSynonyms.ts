import type { ColumnRole } from '@/domain/import/ColumnMapping'
import type { RawCell } from '@/domain/import/RawTable'
import { normalizeText } from '@/domain/shared/normalizeText'

/** Sinónimos de cabecera (ya normalizados: mayúsculas, sin tildes ni puntuación) de bancos españoles. */
const SYNONYMS: Readonly<Record<Exclude<ColumnRole, 'ignore'>, readonly string[]>> = {
  date: [
    'FECHA', 'FECHA OPERACION', 'FECHA DE OPERACION', 'F OPERACION', 'FECHA OPER', 'F OPER', 'FECHA CONTABLE',
    'FECHA CONTABILIZACION', 'FECHA CONT', 'FECHA MOVIMIENTO', 'DATE', 'BOOKING DATE', 'TRANSACTION DATE',
  ],
  valueDate: ['FECHA VALOR', 'FECHA DE VALOR', 'F VALOR', 'FEC VALOR', 'VALUE DATE'],
  description: [
    'CONCEPTO', 'DESCRIPCION', 'MOVIMIENTO', 'MOVIMIENTOS', 'DETALLE', 'CONCEPTO COMPLETO', 'CONCEPTO MOVIMIENTO',
    'DESCRIPCION MOVIMIENTO', 'OBSERVACIONES', 'DESCRIPTION', 'DETAILS',
  ],
  amount: ['IMPORTE', 'IMPORTE EUR', 'CANTIDAD', 'AMOUNT', 'MONTO'],
  debit: ['DEBE', 'CARGO', 'CARGOS', 'DEBITO', 'ADEUDO', 'DEBIT'],
  credit: ['HABER', 'ABONO', 'ABONOS', 'CREDITO', 'INGRESO', 'INGRESOS', 'CREDIT'],
  balance: ['SALDO', 'SALDO EUR', 'SALDO DISPONIBLE', 'SALDO CONTABLE', 'SALDO FINAL', 'BALANCE'],
}

const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu

const ROLE_BY_SYNONYM: ReadonlyMap<string, ColumnRole> = new Map(
  (Object.entries(SYNONYMS) as [ColumnRole, readonly string[]][]).flatMap(([role, words]) =>
    words.map((word): [string, ColumnRole] => [word, role]),
  ),
)

/** Papel que sugiere el texto de una cabecera, o `null` si no se reconoce. */
export function headerCellRole(cell: RawCell | undefined): ColumnRole | null {
  if (cell?.kind !== 'text') return null
  const key = normalizeText(cell.value).replace(NON_ALPHANUMERIC, ' ').trim()
  return ROLE_BY_SYNONYM.get(key) ?? null
}
