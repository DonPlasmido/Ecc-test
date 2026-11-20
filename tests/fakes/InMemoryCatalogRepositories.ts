import type {
  AccountRepository,
  BudgetRepository,
  CategoryRepository,
  RuleRepository,
} from '@/application/ports/outbound/CatalogRepositories';
import type { Account, AccountId } from '@/domain/account/Account';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { Rule, RuleId } from '@/domain/rule/Rule';
import { compareKeys, copy, valuesByKey, type InMemoryState } from './InMemoryState';

/** Fake en memoria de `AccountRepository` (lista por `id`). */
export class InMemoryAccountRepository implements AccountRepository {
  constructor(private readonly state: InMemoryState) {}

  list(): Promise<readonly Account[]> {
    return Promise.resolve(valuesByKey(this.state.accounts));
  }

  save(a: Account): Promise<void> {
    this.state.accounts.set(a.id, copy(a));
    return Promise.resolve();
  }

  delete(id: AccountId): Promise<void> {
    this.state.accounts.delete(id);
    return Promise.resolve();
  }
}

/** Fake en memoria de `CategoryRepository` (lista por `id`). */
export class InMemoryCategoryRepository implements CategoryRepository {
  constructor(private readonly state: InMemoryState) {}

  list(): Promise<readonly Category[]> {
    return Promise.resolve(valuesByKey(this.state.categories));
  }

  save(c: Category): Promise<void> {
    this.state.categories.set(c.id, copy(c));
    return Promise.resolve();
  }

  saveMany(categories: readonly Category[]): Promise<void> {
    for (const c of categories) this.state.categories.set(c.id, copy(c));
    return Promise.resolve();
  }

  delete(id: CategoryId): Promise<void> {
    this.state.categories.delete(id);
    return Promise.resolve();
  }
}

/** Fake en memoria de `RuleRepository` (lista por prioridad, luego `id`). */
export class InMemoryRuleRepository implements RuleRepository {
  constructor(private readonly state: InMemoryState) {}

  list(): Promise<readonly Rule[]> {
    const sorted = [...this.state.rules.values()].sort(
      (a, b) => compareKeys(a.priority, b.priority) || compareKeys(a.id, b.id),
    );
    return Promise.resolve(sorted.map(copy));
  }

  save(r: Rule): Promise<void> {
    this.state.rules.set(r.id, copy(r));
    return Promise.resolve();
  }

  saveMany(rules: readonly Rule[]): Promise<void> {
    for (const r of rules) this.state.rules.set(r.id, copy(r));
    return Promise.resolve();
  }

  delete(id: RuleId): Promise<void> {
    this.state.rules.delete(id);
    return Promise.resolve();
  }
}

/** Fake en memoria de `BudgetRepository` (lista por `id`). */
export class InMemoryBudgetRepository implements BudgetRepository {
  constructor(private readonly state: InMemoryState) {}

  list(): Promise<readonly Budget[]> {
    return Promise.resolve(valuesByKey(this.state.budgets));
  }

  save(b: Budget): Promise<void> {
    this.state.budgets.set(b.id, copy(b));
    return Promise.resolve();
  }

  delete(id: BudgetId): Promise<void> {
    this.state.budgets.delete(id);
    return Promise.resolve();
  }
}
