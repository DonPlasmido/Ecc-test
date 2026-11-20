import type { Account, AccountId } from '@/domain/account/Account';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import type { Category, CategoryId, CategoryKind } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Money } from '@/domain/money/Money';
import type { AmountSign, Rule, RuleId, RuleOperator } from '@/domain/rule/Rule';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';

/** Alta (sin `id`) o edición (con `id`) de cuenta. */
export interface SaveAccountInput {
  readonly id?: AccountId;
  readonly name: string;
  readonly ibanLast4: string | null;
}

/** Alta (sin `id`) o edición (con `id`) de categoría. */
export interface SaveCategoryInput {
  readonly id?: CategoryId;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly color: string;
  readonly archived: boolean;
}

/** Alta (sin `id`, se añade al final) o edición (con `id`) de regla. El patrón se normaliza. */
export interface SaveRuleInput {
  readonly id?: RuleId;
  readonly pattern: string;
  readonly operator: RuleOperator;
  readonly amountSign: AmountSign;
  readonly accountId: AccountId | null;
  readonly categoryId: CategoryId;
  readonly enabled: boolean;
}

/** Alta (sin `id`) o edición (con `id`) de presupuesto. */
export interface SaveBudgetInput {
  readonly id?: BudgetId;
  readonly categoryId: CategoryId;
  readonly monthlyLimit: Money;
  readonly startMonth: YearMonth;
  readonly endMonth: YearMonth | null;
}

/** CRUD sencillo de cuentas, categorías, reglas y presupuestos (YAGNI: un solo puerto). */
export interface ManageCatalog {
  listAccounts(): Promise<readonly Account[]>;
  saveAccount(input: SaveAccountInput): Promise<Result<Account, DomainError>>;
  /** Falla con `account.inUse` si tiene movimientos. */
  deleteAccount(id: AccountId): Promise<Result<void, DomainError>>;

  listCategories(): Promise<readonly Category[]>;
  saveCategory(input: SaveCategoryInput): Promise<Result<Category, DomainError>>;
  /** Falla con `category.inUse` si hay movimientos, reglas o presupuestos que la usan (archivar en su lugar). */
  deleteCategory(id: CategoryId): Promise<Result<void, DomainError>>;

  /** Ordenadas por prioridad. */
  listRules(): Promise<readonly Rule[]>;
  saveRule(input: SaveRuleInput): Promise<Result<Rule, DomainError>>;
  deleteRule(id: RuleId): Promise<Result<void, DomainError>>;
  /** Reasigna prioridades según el orden dado (debe contener todas las reglas). */
  reorderRules(orderedIds: readonly RuleId[]): Promise<Result<readonly Rule[], DomainError>>;

  listBudgets(): Promise<readonly Budget[]>;
  saveBudget(input: SaveBudgetInput): Promise<Result<Budget, DomainError>>;
  deleteBudget(id: BudgetId): Promise<Result<void, DomainError>>;
}
