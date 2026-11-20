import type { TFunction } from 'i18next';
import type { DomainError } from '@/domain/shared/DomainError';

/** Traduce un `DomainError` (código estable = clave en `errors.json`, ADR-0007). */
export function errorMessage(t: TFunction, error: DomainError | null | undefined): string {
  const fallback = t('unexpected', { ns: 'errors' });
  if (!error) return fallback;
  return t(error.code, {
    ns: 'errors',
    defaultValue: fallback,
    value: error.details?.value ?? '',
    field: error.details?.field ?? '',
    expected: error.details?.expected ?? '',
  });
}
