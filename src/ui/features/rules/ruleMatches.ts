import type { QueryTransactions, TransactionFilter } from '@/application/ports/inbound/QueryTransactions';
import type { Rule } from '@/domain/rule/Rule';
import { matchesRulePattern } from '@/domain/rule/wordMatch';
import { normalizeText } from '@/domain/shared/normalizeText';

/** Mismo mínimo que valida `saveRule` (patrón normalizado). */
export const MIN_PATTERN_LENGTH = 2;
/** Filas por página al recorrer los candidatos del índice. */
const MATCH_PAGE_SIZE = 500;

/** Lo que decide si una regla coincide con un movimiento. */
export type MatchCriteria = Pick<Rule, 'pattern' | 'operator' | 'amountSign' | 'accountId'>;

/** Recuento de movimientos que coinciden y algunos conceptos de ejemplo. */
export interface MatchSummary {
  readonly count: number;
  readonly samples: readonly string[];
}

const NO_MATCHES: MatchSummary = { count: 0, samples: [] };

/** Clave estable de los criterios (para cachear recuentos entre reordenaciones). */
export function criteriaKey(criteria: MatchCriteria): string {
  return [criteria.pattern, criteria.operator, criteria.amountSign, criteria.accountId ?? ''].join('\u0000');
}

function candidateFilter(criteria: MatchCriteria): TransactionFilter {
  return {
    text: criteria.pattern,
    sign: criteria.amountSign,
    ...(criteria.accountId === null ? {} : { accountIds: [criteria.accountId] }),
  };
}

/**
 * Cuenta los movimientos que coinciden con los criterios de una regla. La búsqueda por texto del índice
 * (subcadena) da un superconjunto; cada candidato se confirma con el mismo motor que aplica las reglas
 * (`matchesRulePattern`: palabra completa y operador).
 */
export async function countMatches(
  query: QueryTransactions,
  raw: MatchCriteria,
  sampleSize = 0,
): Promise<MatchSummary> {
  const criteria = { ...raw, pattern: normalizeText(raw.pattern) };
  if (criteria.pattern.length < MIN_PATTERN_LENGTH) return NO_MATCHES;
  const { resultId, total } = await query.search({ filter: candidateFilter(criteria), sort: 'dateDesc' });
  let count = 0;
  const samples: string[] = [];
  for (let offset = 0; offset < total; offset += MATCH_PAGE_SIZE) {
    const rows = await query.page({ resultId, offset, limit: MATCH_PAGE_SIZE });
    if (rows.length === 0) break;
    for (const tx of rows) {
      if (!matchesRulePattern(tx.normalizedDescription, criteria.pattern, criteria.operator)) continue;
      count += 1;
      if (samples.length < sampleSize) samples.push(tx.description);
    }
  }
  return { count, samples };
}
