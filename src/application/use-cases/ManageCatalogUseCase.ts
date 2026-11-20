import type {
  ManageCatalog,
  SaveAccountInput,
  SaveBudgetInput,
  SaveCategoryInput,
  SaveRuleInput,
} from '@/application/ports/inbound/ManageCatalog';
import type {
  AccountRepository,
  BudgetRepository,
  CategoryRepository,
  RuleRepository,
} from '@/application/ports/outbound/CatalogRepositories';
import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { IdGeneratorPort } from '@/application/ports/outbound/IdGeneratorPort';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import { readAll } from '@/application/use-cases/applyRules';
import type { Account, AccountId } from '@/domain/account/Account';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import { UNCATEGORIZED, type Category, type CategoryId } from '@/domain/category/Category';
import type { Rule, RuleId } from '@/domain/rule/Rule';
import { domainError, type DomainError, type DomainErrorCode } from '@/domain/shared/DomainError';
import { normalizeText } from '@/domain/shared/normalizeText';
import { err, ok, type Result } from '@/domain/shared/Result';

const MIN_PATTERN_LENGTH = 2;
const IBAN_LAST4 = /^\d{4}$/u;

export interface ManageCatalogDeps {
  readonly accounts: AccountRepository;
  readonly categories: CategoryRepository;
  readonly rules: RuleRepository;
  readonly budgets: BudgetRepository;
  readonly transactions: TransactionRepository;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly onDataChanged?: () => void;
}

const fail = (code: DomainErrorCode, field?: string): Result<never, DomainError> =>
  err(field === undefined ? domainError(code) : domainError(code, { field }));

/** CRUD de cuentas, categorías, reglas y presupuestos con sus invariantes. */
export class ManageCatalogUseCase implements ManageCatalog {
  constructor(private readonly deps: ManageCatalogDeps) {}

  listAccounts(): Promise<readonly Account[]> {
    return this.deps.accounts.list();
  }

  async saveAccount(input: SaveAccountInput): Promise<Result<Account, DomainError>> {
    const name = input.name.trim();
    if (name === '') return fail('account.invalidName', 'name');
    if (input.ibanLast4 !== null && !IBAN_LAST4.test(input.ibanLast4)) return fail('account.invalidName', 'ibanLast4');
    const existing = input.id === undefined ? null : await this.findAccount(input.id);
    if (input.id !== undefined && existing === null) return fail('account.notFound');
    const account: Account = {
      id: input.id ?? (this.deps.ids.next() as AccountId),
      name,
      ibanLast4: input.ibanLast4,
      currency: 'EUR',
      createdAt: existing?.createdAt ?? this.deps.clock.now(),
    };
    await this.deps.accounts.save(account);
    this.changed();
    return ok(account);
  }

  async deleteAccount(id: AccountId): Promise<Result<void, DomainError>> {
    if ((await this.findAccount(id)) === null) return fail('account.notFound');
    if ((await readAll(this.deps.transactions)).some((t) => t.accountId === id)) return fail('account.inUse');
    await this.deps.accounts.delete(id);
    this.changed();
    return ok(undefined);
  }

  listCategories(): Promise<readonly Category[]> {
    return this.deps.categories.list();
  }

  async saveCategory(input: SaveCategoryInput): Promise<Result<Category, DomainError>> {
    const name = input.name.trim();
    if (name === '') return fail('category.invalidName', 'name');
    const existing = input.id === undefined ? null : await this.findCategory(input.id);
    if (input.id !== undefined && existing === null) return fail('category.notFound');
    const category: Category = {
      id: input.id ?? (this.deps.ids.next() as CategoryId),
      name,
      nameKey: existing !== null && existing.name === name ? existing.nameKey : null,
      kind: input.kind,
      color: input.color,
      archived: input.archived,
    };
    await this.deps.categories.save(category);
    this.changed();
    return ok(category);
  }

  async deleteCategory(id: CategoryId): Promise<Result<void, DomainError>> {
    if ((await this.findCategory(id)) === null) return fail('category.notFound');
    if (id === UNCATEGORIZED) return fail('category.inUse');
    const { rules, budgets, transactions } = this.deps;
    const inUse =
      (await rules.list()).some((r) => r.categoryId === id) ||
      (await budgets.list()).some((b) => b.categoryId === id) ||
      (await readAll(transactions)).some((t) => t.categoryId === id);
    if (inUse) return fail('category.inUse');
    await this.deps.categories.delete(id);
    this.changed();
    return ok(undefined);
  }

  listRules(): Promise<readonly Rule[]> {
    return this.deps.rules.list();
  }

  async saveRule(input: SaveRuleInput): Promise<Result<Rule, DomainError>> {
    const pattern = normalizeText(input.pattern);
    if (pattern.length < MIN_PATTERN_LENGTH) return fail('rule.invalidPattern', 'pattern');
    if ((await this.findCategory(input.categoryId)) === null) return fail('category.notFound');
    if (input.accountId !== null && (await this.findAccount(input.accountId)) === null) return fail('account.notFound');
    const rules = await this.deps.rules.list();
    const existing = input.id === undefined ? null : (rules.find((r) => r.id === input.id) ?? null);
    if (input.id !== undefined && existing === null) return fail('rule.notFound');
    const rule: Rule = {
      id: input.id ?? (this.deps.ids.next() as RuleId),
      pattern,
      operator: input.operator,
      amountSign: input.amountSign,
      accountId: input.accountId,
      categoryId: input.categoryId,
      priority: existing?.priority ?? rules.reduce((max, r) => Math.max(max, r.priority), 0) + 1,
      enabled: input.enabled,
      origin: existing?.origin ?? 'manual',
      createdAt: existing?.createdAt ?? this.deps.clock.now(),
    };
    await this.deps.rules.save(rule);
    this.changed();
    return ok(rule);
  }

  async deleteRule(id: RuleId): Promise<Result<void, DomainError>> {
    if (!(await this.deps.rules.list()).some((r) => r.id === id)) return fail('rule.notFound');
    await this.deps.rules.delete(id);
    this.changed();
    return ok(undefined);
  }

  async reorderRules(orderedIds: readonly RuleId[]): Promise<Result<readonly Rule[], DomainError>> {
    const rules = await this.deps.rules.list();
    const byId = new Map(rules.map((r) => [r.id, r]));
    const complete = orderedIds.length === rules.length && new Set(orderedIds).size === rules.length;
    if (!complete || orderedIds.some((id) => !byId.has(id))) return fail('rule.notFound');
    const reordered = orderedIds.map((id, index) => ({ ...(byId.get(id) as Rule), priority: index + 1 }));
    await this.deps.rules.saveMany(reordered);
    this.changed();
    return ok(reordered);
  }

  listBudgets(): Promise<readonly Budget[]> {
    return this.deps.budgets.list();
  }

  async saveBudget(input: SaveBudgetInput): Promise<Result<Budget, DomainError>> {
    if (input.monthlyLimit.cents <= 0) return fail('budget.invalidLimit', 'monthlyLimit');
    if (input.endMonth !== null && input.endMonth < input.startMonth) return fail('budget.invalidRange', 'endMonth');
    if ((await this.findCategory(input.categoryId)) === null) return fail('category.notFound');
    const budgets = await this.deps.budgets.list();
    if (input.id !== undefined && !budgets.some((b) => b.id === input.id)) return fail('budget.notFound');
    const budget: Budget = {
      id: input.id ?? (this.deps.ids.next() as BudgetId),
      categoryId: input.categoryId,
      monthlyLimit: input.monthlyLimit,
      startMonth: input.startMonth,
      endMonth: input.endMonth,
    };
    const clash = budgets.some((b) => b.id !== budget.id && b.categoryId === budget.categoryId && rangesOverlap(b, budget));
    if (clash) return fail('budget.duplicateCategory', 'categoryId');
    await this.deps.budgets.save(budget);
    this.changed();
    return ok(budget);
  }

  async deleteBudget(id: BudgetId): Promise<Result<void, DomainError>> {
    if (!(await this.deps.budgets.list()).some((b) => b.id === id)) return fail('budget.notFound');
    await this.deps.budgets.delete(id);
    this.changed();
    return ok(undefined);
  }

  private async findAccount(id: AccountId): Promise<Account | null> {
    return (await this.deps.accounts.list()).find((a) => a.id === id) ?? null;
  }

  private async findCategory(id: CategoryId): Promise<Category | null> {
    return (await this.deps.categories.list()).find((c) => c.id === id) ?? null;
  }

  private changed(): void {
    this.deps.onDataChanged?.();
  }
}

/** Dos presupuestos se solapan si algún mes está activo en ambos (fin `null` = sin fin). */
function rangesOverlap(a: Budget, b: Budget): boolean {
  const aStartsBeforeBEnds = b.endMonth === null || a.startMonth <= b.endMonth;
  const bStartsBeforeAEnds = a.endMonth === null || b.startMonth <= a.endMonth;
  return aStartsBeforeBEnds && bStartsBeforeAEnds;
}
