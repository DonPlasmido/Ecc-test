import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category'
import type { AmountSign, RuleOperator } from '@/domain/rule/Rule'
import { matchesRulePattern } from '@/domain/rule/wordMatch'
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction'

/** Longitud mínima (letras) del token significativo de una sugerencia. */
export const MIN_SUGGESTION_TOKEN_LETTERS = 3

/** Precisión mínima sobre el histórico para aceptar un candidato. */
export const MIN_SUGGESTION_PRECISION = 0.8
/** Un candidato que cubre más de este porcentaje del histórico es demasiado amplio. */
export const MAX_SUGGESTION_COVERAGE = 0.05
/** Con menos histórico que esto, la cobertura no discrimina y no se aplica el tope. */
export const MIN_HISTORY_FOR_COVERAGE_CAP = 100
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
])

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
  return letters >= MIN_SUGGESTION_TOKEN_LETTERS && letters >= count(core, DIGITS) && !NOISE_WORDS.has(core)
}

/** Ventanas de 1 a 3 tokens significativos consecutivos del texto original. */
function candidatePatterns(normalized: string): readonly string[] {
  const tokens = normalized.split(' ')
  const found = new Set<string>()
  for (let start = 0; start < tokens.length; start += 1) {
    for (let size = 1; size <= MAX_CANDIDATE_TOKENS && start + size <= tokens.length; size += 1) {
      const window = tokens.slice(start, start + size)
      if (!window.every(isSignificant)) break
      found.add(stripEdges(window.join(' ')))
    }
  }
  return [...found]
}

interface ScoredCandidate {
  readonly pattern: string
  readonly precision: number
  readonly matches: number
  readonly tokens: number
  readonly letters: number
}

function score(pattern: string, history: readonly SuggestionHistoryItem[], categoryId: CategoryId): ScoredCandidate | null {
  let matches = 0
  let hits = 0
  for (const item of history) {
    if (!matchesRulePattern(item.normalizedDescription, pattern, 'contains')) continue
    matches += 1
    if (item.categoryId === categoryId || item.categoryId === UNCATEGORIZED) hits += 1
  }
  const precision = (hits + 1) / (matches + 1)
  const tooBroad =
    history.length >= MIN_HISTORY_FOR_COVERAGE_CAP && (matches + 1) / (history.length + 1) > MAX_SUGGESTION_COVERAGE
  if (precision < MIN_SUGGESTION_PRECISION || tooBroad) return null
  return { pattern, precision, matches, tokens: pattern.split(' ').length, letters: count(pattern, LETTERS) }
}

function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  return b.precision - a.precision || b.matches - a.matches || a.tokens - b.tokens || b.letters - a.letters
}

/**
 * Propone (nunca crea) una regla a partir de una corrección manual. Candidatos de 1-3 tokens
 * significativos puntuados por precisión sobre `history` (se excluye `tx` por `id` si el elemento lo trae).
 * Sin candidato válido, propone el concepto normalizado sin tokens con dígitos. Siempre `contains` y `any`.
 */
export function suggestRule(
  tx: Transaction,
  newCategoryId: CategoryId,
  history: readonly SuggestionHistoryItem[] = [],
): RuleSuggestion | null {
  if (newCategoryId === UNCATEGORIZED) return null
  const others = history.filter((item) => item.id === undefined || item.id !== tx.id)
  const best = candidatePatterns(tx.normalizedDescription)
    .map((pattern) => score(pattern, others, newCategoryId))
    .filter((c): c is ScoredCandidate => c !== null)
    .sort(compareCandidates)[0]
  const pattern = best?.pattern ?? fullConcept(tx.normalizedDescription)
  if (pattern === null) return null
  return { pattern, operator: 'contains', categoryId: newCategoryId, amountSign: 'any' }
}

/** Concepto completo sin tokens con dígitos (referencias, importes, fechas). */
function fullConcept(normalized: string): string | null {
  const concept = normalized
    .split(' ')
    .filter((token) => count(token, DIGITS) === 0)
    .join(' ')
    .trim()
  return count(concept, LETTERS) >= MIN_SUGGESTION_TOKEN_LETTERS ? concept : null
}
