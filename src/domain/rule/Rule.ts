import type { AccountId } from '@/domain/account/Account';
import type { CategoryId } from '@/domain/category/Category';
import type { Brand } from '@/domain/shared/brand';

/** Identificador de regla. */
export type RuleId = Brand<string, 'RuleId'>;

/** Operador de coincidencia (sin regex en v1: evita ReDoS con patrones del usuario). */
export type RuleOperator = 'contains' | 'startsWith' | 'equals';

/** Filtro por signo del importe. */
export type AmountSign = 'any' | 'expense' | 'income';

/** Cómo nació la regla. */
export type RuleOrigin = 'manual' | 'learned';

/** Regla de categorización automática. */
export interface Rule {
  readonly id: RuleId;
  /** Patrón ya normalizado. */
  readonly pattern: string;
  readonly operator: RuleOperator;
  readonly amountSign: AmountSign;
  /** `null` = todas las cuentas. */
  readonly accountId: AccountId | null;
  readonly categoryId: CategoryId;
  /** Menor = antes; empates por `createdAt`. */
  readonly priority: number;
  readonly enabled: boolean;
  readonly origin: RuleOrigin;
  /** ISO datetime. */
  readonly createdAt: string;
}

// TODO(domain): src/domain/rule/ruleMatcher.ts
// export function matchRule(tx: Pick<Transaction, 'normalizedDescription' | 'amount' | 'accountId'>,
//   rules: readonly Rule[]): Rule | null;
// export function categorize(tx: Transaction, rules: readonly Rule[]): Transaction; // 'manual' intacto
// export function sortRules(rules: readonly Rule[]): readonly Rule[]; // prioridad, luego createdAt
