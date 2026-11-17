import type { CategoryId } from '@/domain/category/Category';
import type { AmountSign, RuleOperator } from '@/domain/rule/Rule';

/** Longitud mínima (letras) del token significativo de una sugerencia. */
export const MIN_SUGGESTION_TOKEN_LETTERS = 3;

/** Regla propuesta a partir de una corrección manual. */
export interface RuleSuggestion {
  /** Patrón normalizado, p. ej. `'MERCADONA'`. */
  readonly pattern: string;
  readonly operator: RuleOperator;
  readonly categoryId: CategoryId;
  readonly amountSign: AmountSign;
}

// TODO(domain): implementar en este archivo (quita ruido bancario y elige el token más largo).
// export function suggestRule(tx: Transaction, newCategoryId: CategoryId): RuleSuggestion | null;
