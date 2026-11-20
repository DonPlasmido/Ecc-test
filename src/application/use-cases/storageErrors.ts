import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { err, type Err } from '@/domain/shared/Result';

/** `true` si el fallo es de cuota de almacenamiento (IndexedDB / Storage API). */
export function isQuotaExceeded(error: unknown): boolean {
  return error instanceof Error && error.name === 'QuotaExceededError';
}

/**
 * Convierte un fallo de escritura esperable (cuota) en `storage.quotaExceeded`;
 * cualquier otro es inesperado y se relanza.
 */
export function quotaErrorOrRethrow(error: unknown): Err<DomainError> {
  if (isQuotaExceeded(error)) return err(domainError('storage.quotaExceeded'));
  throw error;
}
