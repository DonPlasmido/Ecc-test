import type { StatementFile } from '@/domain/import/StatementFile';
import type { DomainError, DomainErrorCode, DomainErrorDetails } from '@/domain/shared/DomainError';
import type { Err, Ok } from '@/domain/shared/Result';
import { MAX_FILE_BYTES } from './limits';

// `ok`/`err`/`domainError` del dominio aún son TODO(domain); aquí se construyen los valores planos
// equivalentes para no depender de su implementación.
export function okResult<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function failure(code: DomainErrorCode, details?: DomainErrorDetails): Err<DomainError> {
  return { ok: false, error: details ? { code, details } : { code } };
}

/** Extensión en minúsculas sin punto; cadena vacía si no hay. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Valida vacío y tamaño máximo; `null` si el archivo es aceptable. */
export function checkFileSize(file: StatementFile): Err<DomainError> | null {
  if (file.bytes.byteLength === 0) return failure('import.emptyFile');
  if (file.bytes.byteLength > MAX_FILE_BYTES) {
    return failure('import.unsupportedFormat', { field: 'size', expected: MAX_FILE_BYTES });
  }
  return null;
}
