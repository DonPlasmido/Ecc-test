import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';

/**
 * Borra todos los datos del dispositivo (movimientos, cuentas, reglas, presupuestos, importaciones y
 * ajustes guardados) en una única transacción y deja las categorías por defecto, como en una instalación
 * nueva. La UI pide confirmación explícita antes de llamarlo.
 */
export interface DeleteAllData {
  execute(): Promise<Result<void, DomainError>>;
}
