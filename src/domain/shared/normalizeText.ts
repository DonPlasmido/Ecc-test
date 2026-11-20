const COMBINING_MARKS = /\p{M}/gu
const WHITESPACE_RUNS = /\s+/gu

/** Normaliza texto para reglas, búsqueda y deduplicación: mayúsculas, sin tildes, espacios colapsados. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toUpperCase().replace(WHITESPACE_RUNS, ' ').trim()
}
