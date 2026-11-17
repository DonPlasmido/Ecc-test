/**
 * Códigos de error estables. Son claves i18n (`errors.json`): dominio y aplicación
 * nunca devuelven textos (ADR-0007).
 */
export const DOMAIN_ERROR_CODES = [
  // Value objects
  'money.notInteger',
  'money.outOfRange',
  'money.invalidAmount',
  'date.invalidFormat',
  'date.invalidDate',
  // Importación de extractos
  'import.emptyFile',
  'import.unsupportedFormat',
  'import.corruptFile',
  'import.headerNotFound',
  'import.missingDateColumn',
  'import.missingDescriptionColumn',
  'import.missingAmountColumn',
  'import.invalidMapping',
  'import.emptyDescription',
  'import.previewNotFound',
  'import.accountNotFound',
  // Entidades y catálogo
  'transaction.notFound',
  'account.notFound',
  'account.invalidName',
  'account.inUse',
  'category.notFound',
  'category.invalidName',
  'category.inUse',
  'rule.notFound',
  'rule.invalidPattern',
  'budget.notFound',
  'budget.invalidLimit',
  'budget.invalidRange',
  'budget.duplicateCategory',
  // Copias de seguridad
  'backup.invalidFormat',
  'backup.unsupportedVersion',
  'backup.wrongPasswordOrCorrupted',
  'backup.weakPassword',
  'backup.invalidSnapshot',
  // Almacenamiento
  'storage.quotaExceeded',
  'storage.unavailable',
] as const;

/** Unión de todos los códigos de error de dominio. */
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/** Datos opcionales para interpolar en el mensaje traducido. Nunca contienen secretos. */
export interface DomainErrorDetails {
  /** Valor de entrada ofensivo (recortado), p. ej. el texto de un importe. */
  readonly value?: string;
  /** Campo o columna afectada. */
  readonly field?: string;
  /** Límite o formato esperado, p. ej. longitud mínima de contraseña. */
  readonly expected?: string | number;
}

/** Error de dominio tipado: valor plano serializable, discriminado por `code`. */
export interface DomainError {
  readonly code: DomainErrorCode;
  readonly details?: DomainErrorDetails;
}

/** Construye un error de dominio; `details` solo se incluye si se aporta. */
export function domainError(code: DomainErrorCode, details?: DomainErrorDetails): DomainError {
  return details === undefined ? { code } : { code, details }
}
