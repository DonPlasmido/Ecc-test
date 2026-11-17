import type { CategoryId } from '@/domain/category/Category';
import type { RuleId } from '@/domain/rule/Rule';
import type { RuleSuggestion } from '@/domain/rule/ruleSuggestion';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';
import type { TransactionId } from '@/domain/transaction/Transaction';

/** Corrección manual de categoría. */
export interface CorrectCategoryInput {
  readonly transactionId: TransactionId;
  readonly categoryId: CategoryId;
}

/** Sugerencia de regla tras la corrección y nº de movimientos que afectaría. */
export interface CorrectCategoryOutput {
  readonly suggestion: RuleSuggestion | null;
  readonly affectedCount: number;
}

/** Aceptación (opcionalmente editada) de la sugerencia. */
export interface AcceptSuggestionInput {
  readonly suggestion: RuleSuggestion;
  readonly applyToExisting: boolean;
}

/** Regla creada y movimientos recategorizados. */
export interface AcceptSuggestionOutput {
  readonly ruleId: RuleId;
  readonly recategorized: number;
}

/** Aprende reglas a partir de correcciones manuales. */
export interface LearnRuleFromCorrection {
  /** 1) Guarda la corrección manual y propone regla si procede. */
  correct(input: CorrectCategoryInput): Promise<Result<CorrectCategoryOutput, DomainError>>;
  /** 2) Crea la regla aceptada y, si se pide, la aplica a los existentes. */
  accept(input: AcceptSuggestionInput): Promise<Result<AcceptSuggestionOutput, DomainError>>;
}
