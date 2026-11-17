import type { TransactionId } from '@/domain/transaction/Transaction';

/** Movimientos sobre los que se aplican las reglas. */
export type CategorizeScope = 'all' | 'uncategorized' | { readonly ids: readonly TransactionId[] };

/** Entrada de la recategorización. */
export interface CategorizeInput {
  readonly scope: CategorizeScope;
  /** Si es `true`, solo cuenta, no escribe. */
  readonly dryRun?: boolean;
}

/** Resultado de la recategorización. */
export interface CategorizeOutput {
  readonly changed: number;
  readonly sampleIds: readonly TransactionId[];
}

/** Aplica reglas a movimientos `'none'` y `'rule'` (nunca a `'manual'`). */
export interface CategorizeTransactions {
  execute(input: CategorizeInput): Promise<CategorizeOutput>;
}
