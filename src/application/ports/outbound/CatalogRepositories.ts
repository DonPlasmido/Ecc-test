import type { Account, AccountId } from '@/domain/account/Account';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { Rule, RuleId } from '@/domain/rule/Rule';

/** Persistencia de cuentas. */
export interface AccountRepository {
  list(): Promise<readonly Account[]>;
  /** Alta o reemplazo por `id`. */
  save(a: Account): Promise<void>;
  delete(id: AccountId): Promise<void>;
}

/** Persistencia de categorías. */
export interface CategoryRepository {
  list(): Promise<readonly Category[]>;
  save(c: Category): Promise<void>;
  /** Guarda varias en una sola transacción (todas o ninguna). */
  saveMany(c: readonly Category[]): Promise<void>;
  delete(id: CategoryId): Promise<void>;
}

/** Persistencia de reglas. */
export interface RuleRepository {
  list(): Promise<readonly Rule[]>;
  save(r: Rule): Promise<void>;
  /** En una sola transacción (reordenación de prioridades). */
  saveMany(r: readonly Rule[]): Promise<void>;
  delete(id: RuleId): Promise<void>;
}

/** Persistencia de presupuestos. */
export interface BudgetRepository {
  list(): Promise<readonly Budget[]>;
  save(b: Budget): Promise<void>;
  delete(id: BudgetId): Promise<void>;
}
