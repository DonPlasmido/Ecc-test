/** Resultado de una operación con fallo esperado (sin excepciones). */
export type Result<T, E> = Ok<T> | Err<E>;

/** Rama de éxito de `Result`. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** Rama de fallo de `Result`. */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** Construye la rama de éxito. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

/** Construye la rama de fallo. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}
