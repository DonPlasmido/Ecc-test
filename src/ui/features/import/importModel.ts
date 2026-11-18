import type { AccountId } from '@/domain/account/Account';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { AmountConvention, ColumnMapping, ColumnRole } from '@/domain/import/ColumnMapping';
import { validateMapping } from '@/domain/import/detectColumnMapping';
import { normalizeRows } from '@/domain/import/normalizeRows';
import type { RawCell, RawTable } from '@/domain/import/RawTable';
import type { RowWarning } from '@/domain/import/RowWarning';
import type { Money } from '@/domain/money/Money';
import type { DomainError } from '@/domain/shared/DomainError';

/** Filas normalizadas que se enseñan en la tabla de vista previa (AC-006: primeras 20). */
export const VISIBLE_PREVIEW_ROWS = 20;

/** Orden de los papeles en cada `<select>` de columna; «no usar» va al final. */
export const COLUMN_ROLES: readonly ColumnRole[] = [
  'date',
  'valueDate',
  'description',
  'amount',
  'debit',
  'credit',
  'balance',
  'ignore',
];

export const AMOUNT_CONVENTIONS: readonly AmountConvention[] = ['signed', 'debitCredit'];

/** Papeles que solo puede tener una columna (todos salvo «no usar»). */
const SINGLE_USE_ROLES: ReadonlySet<ColumnRole> = new Set(COLUMN_ROLES.filter((role) => role !== 'ignore'));

/** Cuenta ficticia para normalizar la vista previa: `normalizeRows` la copia en cada borrador y aquí no se guarda. */
const PREVIEW_ACCOUNT = 'preview' as AccountId;

/** Texto de una celda cruda tal como se ve en el archivo. */
export function cellText(cell: RawCell | undefined): string {
  if (cell === undefined || cell.kind === 'empty') return '';
  return String(cell.value).trim();
}

/** Columna del archivo con su cabecera y un valor de ejemplo (para el `<select>` y su ayuda). */
export interface SourceColumn {
  readonly index: number;
  readonly header: string;
  readonly example: string;
}

/** Columnas del extracto: cabecera (si hay) y primer valor no vacío bajo ella. */
export function sourceColumns(table: RawTable, mapping: ColumnMapping): readonly SourceColumn[] {
  const headerRow = mapping.headerRowIndex >= 0 ? table.rows[mapping.headerRowIndex] : undefined;
  const dataRows = table.rows.slice(mapping.headerRowIndex + 1);
  return mapping.columns.map((_role, index) => ({
    index,
    header: cellText(headerRow?.[index]),
    example: dataRows.map((row) => cellText(row[index])).find((text) => text !== '') ?? '',
  }));
}

function conventionFor(role: ColumnRole, current: AmountConvention): AmountConvention {
  if (role === 'amount') return 'signed';
  if (role === 'debit' || role === 'credit') return 'debitCredit';
  return current;
}

/**
 * Asigna `role` a la columna `index` y devuelve un mapeo nuevo. Un papel único se retira de la columna que
 * lo tuviera (no se crean duplicados) y elegir importe/Debe/Haber ajusta la convención de signo.
 */
export function assignRole(mapping: ColumnMapping, index: number, role: ColumnRole): ColumnMapping {
  const columns = mapping.columns.map((current, column): ColumnRole => {
    if (column === index) return role;
    return SINGLE_USE_ROLES.has(role) && current === role ? 'ignore' : current;
  });
  return { ...mapping, columns, amountConvention: conventionFor(role, mapping.amountConvention) };
}

export function withConvention(mapping: ColumnMapping, amountConvention: AmountConvention): ColumnMapping {
  return { ...mapping, amountConvention };
}

/** Error de mapeo (columna obligatoria sin asignar o repetida), o `null` si se puede importar. */
export function mappingError(mapping: ColumnMapping): DomainError | null {
  const result = validateMapping(mapping);
  return result.ok ? null : result.error;
}

/** Fila de la tabla de vista previa: válida (normalizada) o rechazada con su motivo. */
export type PreviewRow =
  | {
      readonly kind: 'valid';
      readonly line: number;
      readonly date: IsoDate;
      readonly description: string;
      readonly amount: Money;
      readonly balance: Money | null;
      readonly warning: RowWarning | null;
    }
  | { readonly kind: 'error'; readonly line: number; readonly error: DomainError };

/** Resultado de normalizar las filas de la vista previa con el mapeo actual. */
export interface PreviewModel {
  readonly rows: readonly PreviewRow[];
  readonly validCount: number;
  readonly errorCount: number;
  readonly warnings: readonly RowWarning[];
}

/**
 * Normaliza en memoria las filas de la vista previa (sin escribir nada, AC-006) con el mismo `normalizeRows`
 * que usará `commit`, para que lo que se ve sea lo que se importa.
 */
export function buildPreviewModel(table: RawTable, mapping: ColumnMapping): PreviewModel {
  const { drafts, rowErrors, warnings } = normalizeRows(table, mapping, PREVIEW_ACCOUNT);
  const warningByLine = new Map(warnings.map((warning) => [warning.line, warning]));
  const valid = drafts.map(
    (draft): PreviewRow => ({
      kind: 'valid',
      line: draft.sourceLine,
      date: draft.date,
      description: draft.rawDescription,
      amount: draft.amount,
      balance: draft.balance,
      warning: warningByLine.get(draft.sourceLine) ?? null,
    }),
  );
  const rejected = rowErrors.map((rowError): PreviewRow => ({ kind: 'error', line: rowError.line, error: rowError.error }));
  const rows = [...valid, ...rejected].sort((a, b) => a.line - b.line).slice(0, VISIBLE_PREVIEW_ROWS);
  return { rows, validCount: drafts.length, errorCount: rowErrors.length, warnings };
}
