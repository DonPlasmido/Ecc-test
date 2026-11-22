import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category'
import type { AmountSign, RuleOperator } from '@/domain/rule/Rule'
import { matchesRulePattern } from '@/domain/rule/wordMatch'
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction'

/** Longitud mínima (letras) del token significativo de una sugerencia. */
export const MIN_SUGGESTION_TOKEN_LETTERS = 3

/** Precisión mínima sobre el histórico para aceptar un candidato. */
export const MIN_SUGGESTION_PRECISION = 0.8
const MAX_CANDIDATE_TOKENS = 3

/** Regla propuesta a partir de una corrección manual. */
export interface RuleSuggestion {
  /** Patrón normalizado, p. ej. `'MERCADONA'`. */
  readonly pattern: string
  readonly operator: RuleOperator
  readonly categoryId: CategoryId
  readonly amountSign: AmountSign
}

/** Movimiento del histórico contra el que se puntúan los candidatos. */
export type SuggestionHistoryItem = Pick<Transaction, 'normalizedDescription' | 'categoryId'> & {
  /** Si se aporta, el movimiento con el mismo id se excluye del histórico (los repositorios devuelven copias). */
  readonly id?: TransactionId
}

/** Ruido bancario (español e inglés) y sufijos societarios que nunca identifican un comercio. */
const NOISE_WORDS: ReadonlySet<string> = new Set([
  'COMPRA', 'COMPRAS', 'TARJ', 'TARJETA', 'PAGO', 'PAGOS', 'MOVIL', 'RECIBO', 'RECIBOS', 'TRANSFERENCIA', 'TRANSF',
  'BIZUM', 'ADEUDO', 'DOMICILIACION', 'CARGO', 'ABONO', 'EN', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'POR', 'CON',
  'REF', 'REFERENCIA', 'NUM', 'SL', 'SA', 'SLU', 'SAU', 'SLL', 'CARD', 'PURCHASE', 'PAYMENT', 'TRANSFER', 'DEBIT',
  'CREDIT', 'THE', 'AND', 'FOR', 'WITH', 'FROM', 'LTD', 'INC', 'LLC',
  // Monederos y verbos de Bizum: dicen cómo se pagó, no a quién (prueba con extracto estilo imagin).
  'APPLE', 'GOOGLE', 'SAMSUNG', 'PAY', 'GPAY', 'CONTACTLESS', 'ENVIADO', 'ENVIADA', 'RECIBIDO', 'RECIBIDA',
  // Palabras de operación y de negocio genérico: describen el tipo de movimiento, no al comercio.
  'INMEDIATA', 'FAVOR', 'CONCEPTO', 'CUENTA', 'CAJERO', 'REINTEGRO', 'ESTACION', 'SERVICIO', 'SUPERMERCADOS', 'SEGUROS',
  'BBVA', 'SANTANDER', 'CAIXABANK', 'SABADELL', 'BANKINTER', 'BAR', 'CAFETERIA', 'RESTAURANTE', 'AVDA', 'LDA', 'ESPANA',
  // Ciudades españolas comunes: el lugar de la compra no identifica al comercio.
  'MADRID', 'BARCELONA', 'VALENCIA', 'SEVILLA', 'ZARAGOZA', 'MALAGA', 'BILBAO', 'ALICANTE', 'MURCIA', 'GRANADA',
  'VALLADOLID', 'CORDOBA', 'PALMA', 'VIGO', 'GIJON',
])

/** Agregadores de pago: por sí solos no dicen qué se compró; se proponen junto al siguiente token. */
const AGGREGATORS: ReadonlySet<string> = new Set(['PAYPAL', 'AMAZON', 'UBER', 'APPLE.COM'])

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu
const LETTERS = /\p{L}/gu
const DIGITS = /\p{N}/gu

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

function stripEdges(text: string): string {
  return text.replace(EDGE_PUNCTUATION, '')
}

function isSignificant(token: string): boolean {
  const core = stripEdges(token)
  const letters = count(core, LETTERS)
  const digits = count(core, DIGITS)
  // Los tokens con letras y dígitos mezclados (AB12CD34) son referencias, no comercios.
  return letters >= MIN_SUGGESTION_TOKEN_LETTERS && digits === 0 && !NOISE_WORDS.has(core)
}

function isAggregator(token: string): boolean {
  return AGGREGATORS.has(stripEdges(token))
}

interface Candidate {
  readonly pattern: string
  readonly position: number
  readonly tokens: number
}

/** Ventanas de 1 a 3 tokens significativos consecutivos; un agregador nunca va solo. */
function candidatePatterns(normalized: string): readonly Candidate[] {
  const tokens = normalized.split(' ')
  const found = new Map<string, Candidate>()
  for (let start = 0; start < tokens.length; start += 1) {
    for (let size = 1; size <= MAX_CANDIDATE_TOKENS && start + size <= tokens.length; size += 1) {
      const window = tokens.slice(start, start + size)
      if (!window.every(isSignificant)) break
      if (size === 1 && isAggregator(window[0] ?? '')) continue
      const pattern = stripEdges(window.join(' '))
      if (!found.has(pattern)) found.set(pattern, { pattern, position: start, tokens: size })
    }
  }
  return [...found.values()]
}

interface ScoredCandidate extends Candidate {
  readonly precision: number
}

/** Los movimientos sin categorizar son neutros: no suman acierto ni error. */
function score(candidate: Candidate, history: readonly SuggestionHistoryItem[], categoryId: CategoryId): ScoredCandidate | null {
  let hits = 0
  let errors = 0
  for (const item of history) {
    if (!matchesRulePattern(item.normalizedDescription, candidate.pattern, 'contains')) continue
    if (item.categoryId === categoryId) hits += 1
    else if (item.categoryId !== UNCATEGORIZED) errors += 1
  }
  const precision = (hits + 1) / (hits + errors + 1)
  return precision < MIN_SUGGESTION_PRECISION ? null : { ...candidate, precision }
}

/** Mayor precisión; en empate, el primer token significativo (el comercio suele ir primero) y el más corto. */
function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  return b.precision - a.precision || a.position - b.position || a.tokens - b.tokens
}

function signOf(cents: number): AmountSign {
  if (cents < 0) return 'expense'
  return cents > 0 ? 'income' : 'any'
}

/**
 * Propone (nunca crea) una regla a partir de una corrección manual. Candidatos de 1-3 tokens
 * significativos puntuados por precisión sobre `history` (se excluye `tx` por `id` si el elemento lo trae).
 * Sin candidato válido, propone la ventana contigua más larga sin dígitos, si no choca con otras categorías.
 * Siempre `contains`; el signo se deduce del importe del movimiento corregido.
 */
export function suggestRule(
  tx: Transaction,
  newCategoryId: CategoryId,
  history: readonly SuggestionHistoryItem[] = [],
): RuleSuggestion | null {
  if (newCategoryId === UNCATEGORIZED) return null
  const others = history.filter((item) => item.id === undefined || item.id !== tx.id)
  const normalized = tx.normalizedDescription
  const best =
    candidatePatterns(normalized)
      .map((candidate) => score(candidate, others, newCategoryId))
      .filter((c): c is ScoredCandidate => c !== null)
      .sort(compareCandidates)[0] ?? fallbackCandidate(normalized, others, newCategoryId)
  if (best === null) return null
  return { pattern: best.pattern, operator: 'contains', categoryId: newCategoryId, amountSign: signOf(tx.amount.cents) }
}

function trimNoise(tokens: readonly string[]): readonly string[] {
  let from = 0
  let to = tokens.length
  while (from < to && NOISE_WORDS.has(stripEdges(tokens[from] ?? ''))) from += 1
  while (to > from && NOISE_WORDS.has(stripEdges(tokens[to - 1] ?? ''))) to -= 1
  return tokens.slice(from, to)
}

/** Ventana contigua más larga (en letras) sin tokens con dígitos, sin ruido en los extremos. */
function longestDigitFreeWindow(normalized: string): string | null {
  const runs: string[][] = [[]]
  for (const token of normalized.split(' ')) {
    if (count(token, DIGITS) > 0) runs.push([])
    else runs[runs.length - 1]?.push(token)
  }
  let best: string | null = null
  for (const run of runs) {
    const pattern = stripEdges(trimNoise(run).join(' '))
    if (count(pattern, LETTERS) > count(best ?? '', LETTERS)) best = pattern
  }
  return best !== null && count(best, LETTERS) >= MIN_SUGGESTION_TOKEN_LETTERS ? best : null
}

/** Último recurso: debe casar con el propio movimiento, no ser un agregador y no chocar con otras categorías. */
function fallbackCandidate(
  normalized: string,
  history: readonly SuggestionHistoryItem[],
  categoryId: CategoryId,
): ScoredCandidate | null {
  const pattern = longestDigitFreeWindow(normalized)
  if (pattern === null || AGGREGATORS.has(pattern)) return null
  if (!matchesRulePattern(normalized, pattern, 'contains')) return null
  return score({ pattern, position: 0, tokens: pattern.split(' ').length }, history, categoryId)
}
