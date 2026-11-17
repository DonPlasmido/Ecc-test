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

// TODO(domain): implementar constructores puros en este archivo.
// export function ok<T>(value: T): Ok<T>;
// export function err<E>(error: E): Err<E>;
