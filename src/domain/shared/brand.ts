/** Tipo nominal: impide confundir valores estructuralmente iguales (p. ej. dos ids `string`). */
export type Brand<T, Name extends string> = T & { readonly __brand: Name };
