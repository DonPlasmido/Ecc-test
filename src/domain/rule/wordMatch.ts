import type { RuleOperator } from '@/domain/rule/Rule'

const LETTER = /^\p{L}$/u
const DIGIT = /^\p{N}$/u

/** Dos caracteres "se pegan" si ambos son letras o ambos dígitos: rompen el límite de palabra. */
function glued(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return false
  return (LETTER.test(a) && LETTER.test(b)) || (DIGIT.test(a) && DIGIT.test(b))
}

function hasBoundaries(description: string, start: number, pattern: string): boolean {
  const before = start === 0 ? undefined : description[start - 1]
  const after = description[start + pattern.length]
  return !glued(before, pattern[0]) && !glued(after, pattern[pattern.length - 1])
}

function containsWord(description: string, pattern: string): boolean {
  let from = description.indexOf(pattern)
  while (from !== -1) {
    if (hasBoundaries(description, from, pattern)) return true
    from = description.indexOf(pattern, from + 1)
  }
  return false
}

/**
 * Coincidencia por palabra completa entre una descripción y un patrón, ambos ya normalizados.
 * `BAR` no coincide con `BARCELONA`; sí con `BAR2` o `PAGO BAR`.
 */
export function matchesRulePattern(description: string, pattern: string, operator: RuleOperator): boolean {
  if (pattern === '') return false
  switch (operator) {
    case 'equals':
      return description === pattern
    case 'startsWith':
      return description.startsWith(pattern) && hasBoundaries(description, 0, pattern)
    case 'contains':
      return containsWord(description, pattern)
  }
}
