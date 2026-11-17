import { isoDateFromParts, type IsoDate } from '@/domain/date/IsoDate'
import { domainError, type DomainError } from '@/domain/shared/DomainError'
import { err, type Result } from '@/domain/shared/Result'

const MAX_REPORTED_LENGTH = 50
/**
 * Año de referencia por defecto para los años de 2 dígitos. El dominio no lee el reloj:
 * quien necesite otro año lo pasa como parámetro.
 */
export const DEFAULT_REFERENCE_YEAR = 2026
/** Un año de 2 dígitos puede caer como mucho este número de años por delante del de referencia. */
const MAX_YEARS_AHEAD = 1
const CENTURY = 100
/** Mismo separador en toda la fecha (referencia inversa `\2`). */
const DAY_FIRST = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{2}|\d{4})$/u
const YEAR_FIRST = /^(\d{4})([/-])(\d{1,2})\2(\d{1,2})$/u
const MAX_MONTH = 12

/** Años de 2 dígitos: siglo XXI salvo que quede más de un año por delante de `referenceYear`. */
function fullYear(digits: string, referenceYear: number): number {
  const year = Number(digits)
  if (digits.length === 4) return year
  const candidate = 2000 + year
  return candidate > referenceYear + MAX_YEARS_AHEAD ? candidate - CENTURY : candidate
}

/** Interpreta fechas españolas (dd/mm/aaaa, dd-mm-aa, dd.mm.aaaa) o aaaa-mm-dd, con un único separador. Siempre día primero. */
export function parseSpanishDate(text: string, referenceYear: number = DEFAULT_REFERENCE_YEAR): Result<IsoDate, DomainError> {
  const trimmed = text.trim()
  const dayFirst = DAY_FIRST.exec(trimmed)
  if (dayFirst !== null) {
    return isoDateFromParts(fullYear(dayFirst[4] ?? '', referenceYear), Number(dayFirst[3]), Number(dayFirst[1]))
  }
  const yearFirst = YEAR_FIRST.exec(trimmed)
  if (yearFirst !== null) {
    return isoDateFromParts(Number(yearFirst[1]), Number(yearFirst[3]), Number(yearFirst[4]))
  }
  return err(domainError('date.invalidFormat', { value: text.slice(0, MAX_REPORTED_LENGTH) }))
}

/** `true` si dd/mm y mm/dd darían fechas válidas y distintas (p. ej. 03/04/2025). */
export function isAmbiguousDate(text: string): boolean {
  const match = DAY_FIRST.exec(text.trim())
  if (match === null) return false
  const first = Number(match[1])
  const second = Number(match[3])
  return first <= MAX_MONTH && second <= MAX_MONTH && first !== second && first >= 1 && second >= 1
}

/** Fecha dd/mm/aaaa con día = mes (05/05): valdría igual en ambos órdenes, no aporta información. */
function hasSameDayAndMonth(text: string): boolean {
  const match = DAY_FIRST.exec(text.trim())
  return match !== null && Number(match[1]) === Number(match[3])
}

/**
 * `true` si todas las fechas interpretables del archivo que discriminan el formato son ambiguas:
 * hay que confirmar el formato. Las fechas con día = mes se ignoran.
 */
export function hasAmbiguousDates(texts: readonly string[]): boolean {
  const informative = texts.filter((t) => parseSpanishDate(t).ok && !hasSameDayAndMonth(t))
  return informative.length > 0 && informative.every(isAmbiguousDate)
}
