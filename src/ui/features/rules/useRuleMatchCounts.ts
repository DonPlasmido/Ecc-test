import { useEffect, useState } from 'react';
import type { Rule } from '@/domain/rule/Rule';
import { useContainer } from '@/ui/hooks/useContainer';
import { useTransactionIndex } from '@/ui/hooks/useTransactionIndex';
import { countMatches, criteriaKey } from './ruleMatches';

/** Recuento por regla: número, `undefined` mientras se calcula o `null` si no se pudo calcular. */
export type MatchCountOf = (rule: Rule) => number | null | undefined;

interface Counts {
  /** Versión de datos del índice con la que se calcularon. */
  readonly version: number;
  readonly byKey: ReadonlyMap<string, number | null>;
}

const EMPTY: Counts = { version: -1, byKey: new Map() };

/**
 * Nº de movimientos que coinciden con cada regla. Se recalcula al cambiar los datos (`snapshot.version`)
 * y solo para criterios nuevos: reordenar o renombrar no repite el trabajo.
 */
export function useRuleMatchCounts(rules: readonly Rule[]): MatchCountOf {
  const { queryTransactions } = useContainer();
  const { version } = useTransactionIndex();
  const [counts, setCounts] = useState<Counts>(EMPTY);

  useEffect(() => {
    const isSameVersion = counts.version === version;
    const known = isSameVersion ? counts.byKey : new Map<string, number | null>();
    const byKey = new Map(rules.map((rule) => [criteriaKey(rule), rule] as const));
    const missing = [...byKey.keys()].filter((key) => !known.has(key));
    if (missing.length === 0 && isSameVersion) return undefined;
    let isActive = true;
    const run = async () => {
      const next = new Map(known);
      // En serie: el puerto conserva pocos resultados de búsqueda a la vez.
      for (const key of missing) {
        const rule = byKey.get(key);
        if (!isActive || rule === undefined) return;
        const count = await countMatches(queryTransactions, rule).then(
          (summary) => summary.count,
          () => null, // Sin recuento: la regla se sigue mostrando y la lista no se rompe.
        );
        next.set(key, count);
      }
      if (isActive) setCounts({ version, byKey: next });
    };
    void run();
    return () => {
      isActive = false;
    };
  }, [rules, version, queryTransactions, counts]);

  return (rule) => (counts.version === version ? counts.byKey.get(criteriaKey(rule)) : undefined);
}
