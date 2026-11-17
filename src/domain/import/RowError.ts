import type { DomainError } from '@/domain/shared/DomainError';

/** Error en una fila concreta del extracto; la fila se descarta y el resto se importa. */
export interface RowError {
  /** Línea 1-based del archivo de origen. */
  readonly line: number;
  readonly error: DomainError;
}
