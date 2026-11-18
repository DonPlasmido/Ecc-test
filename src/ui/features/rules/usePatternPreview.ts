import { useEffect, useState } from 'react';
import { normalizeText } from '@/domain/shared/normalizeText';
import { useContainer } from '@/ui/hooks/useContainer';
import { useTransactionIndex } from '@/ui/hooks/useTransactionIndex';
import { countMatches, criteriaKey, MIN_PATTERN_LENGTH, type MatchCriteria, type MatchSummary } from './ruleMatches';

/** Espera tras la última pulsación antes de contar (no recorre el índice en cada tecla). */
export const PREVIEW_DEBOUNCE_MS = 300;
/** Conceptos de ejemplo que se muestran bajo el patrón. */
export const PREVIEW_SAMPLES = 3;

export type PatternPreview =
  | { readonly status: 'tooShort' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & MatchSummary);

interface Settled {
  readonly key: string;
  readonly version: number;
  readonly result: MatchSummary | null;
}

/** Vista previa de coincidencias mientras se escribe un patrón (con espera y sin carreras). */
export function usePatternPreview(criteria: MatchCriteria): PatternPreview {
  const { queryTransactions } = useContainer();
  const { version } = useTransactionIndex();
  const normalized = { ...criteria, pattern: normalizeText(criteria.pattern) };
  const isTooShort = normalized.pattern.length < MIN_PATTERN_LENGTH;
  const key = criteriaKey(normalized);
  const [settled, setSettled] = useState<Settled | null>(null);

  const { pattern, operator, amountSign, accountId } = normalized;
  useEffect(() => {
    if (isTooShort) return undefined;
    let isActive = true;
    const timer = window.setTimeout(() => {
      countMatches(queryTransactions, { pattern, operator, amountSign, accountId }, PREVIEW_SAMPLES).then(
        (result) => {
          if (isActive) setSettled({ key, version, result });
        },
        () => {
          if (isActive) setSettled({ key, version, result: null });
        },
      );
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [isTooShort, key, version, queryTransactions, pattern, operator, amountSign, accountId]);

  if (isTooShort) return { status: 'tooShort' };
  if (settled === null || settled.key !== key || settled.version !== version) return { status: 'loading' };
  return settled.result === null ? { status: 'error' } : { status: 'ready', ...settled.result };
}
