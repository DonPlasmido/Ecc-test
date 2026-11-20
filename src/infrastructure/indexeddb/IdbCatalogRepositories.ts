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
import { budgetFromRecord, budgetToRecord } from './mappers';
import type { CuentasClarasDatabase } from './schema';

/** Cuentas: lista por `id`. */
export class IdbAccountRepository implements AccountRepository {
  constructor(private readonly db: CuentasClarasDatabase) {}

  async list(): Promise<readonly Account[]> {
    return this.db.getAll('accounts');
  }

  async save(a: Account): Promise<void> {
    await this.db.put('accounts', a);
  }

  async delete(id: AccountId): Promise<void> {
    await this.db.delete('accounts', id);
  }
}

/** Categorías: lista por `id`. */
export class IdbCategoryRepository implements CategoryRepository {
  constructor(private readonly db: CuentasClarasDatabase) {}

  async list(): Promise<readonly Category[]> {
    return this.db.getAll('categories');
  }

  async save(c: Category): Promise<void> {
    await this.db.put('categories', c);
  }

  async saveMany(categories: readonly Category[]): Promise<void> {
    if (categories.length === 0) return;
    const tx = this.db.transaction('categories', 'readwrite');
    await Promise.all([...categories.map((c) => tx.store.put(c)), tx.done]);
  }

  async delete(id: CategoryId): Promise<void> {
    await this.db.delete('categories', id);
  }
}

/** Reglas: lista por prioridad (índice `byPriority`), empates por `id`. */
export class IdbRuleRepository implements RuleRepository {
  constructor(private readonly db: CuentasClarasDatabase) {}

  async list(): Promise<readonly Rule[]> {
    return this.db.getAllFromIndex('rules', 'byPriority');
  }

  async save(r: Rule): Promise<void> {
    await this.db.put('rules', r);
  }

  async saveMany(rules: readonly Rule[]): Promise<void> {
    if (rules.length === 0) return;
    const tx = this.db.transaction('rules', 'readwrite');
    await Promise.all([...rules.map((r) => tx.store.put(r)), tx.done]);
  }

  async delete(id: RuleId): Promise<void> {
    await this.db.delete('rules', id);
  }
}

/** Presupuestos: lista por `id`; el límite se guarda en céntimos. */
export class IdbBudgetRepository implements BudgetRepository {
  constructor(private readonly db: CuentasClarasDatabase) {}

  async list(): Promise<readonly Budget[]> {
    return (await this.db.getAll('budgets')).map(budgetFromRecord);
  }

  async save(b: Budget): Promise<void> {
    await this.db.put('budgets', budgetToRecord(b));
  }

  async delete(id: BudgetId): Promise<void> {
    await this.db.delete('budgets', id);
  }
}
