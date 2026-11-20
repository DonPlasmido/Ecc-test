import type { AccountRepository, BudgetRepository, CategoryRepository, RuleRepository } from '@/application/ports/outbound/CatalogRepositories';
import type { Account, AccountId } from '@/domain/account/Account';
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories';
import { ACCOUNT } from '../domain/builders';
import { FixedClock } from '../fakes/FixedClock';
import {
  InMemoryAccountRepository,
  InMemoryBudgetRepository,
  InMemoryCategoryRepository,
  InMemoryRuleRepository,
} from '../fakes/InMemoryCatalogRepositories';
import { InMemoryDataSnapshot } from '../fakes/InMemoryDataSnapshot';
import { InMemoryImportBatchRepository } from '../fakes/InMemoryImportBatchRepository';
import { InMemoryImportProfileRepository } from '../fakes/InMemoryImportProfileRepository';
import { createInMemoryState, type InMemoryState } from '../fakes/InMemoryState';
import { InMemorySettingsRepository } from '../fakes/InMemorySettingsRepository';
import { InMemoryTransactionRepository } from '../fakes/InMemoryTransactionRepository';
import { SequentialIdGenerator } from '../fakes/SequentialIdGenerator';

export interface World {
  readonly state: InMemoryState;
  readonly clock: FixedClock;
  readonly ids: SequentialIdGenerator;
  readonly transactions: InMemoryTransactionRepository;
  readonly batches: InMemoryImportBatchRepository;
  readonly profiles: InMemoryImportProfileRepository;
  readonly accounts: AccountRepository;
  readonly categories: CategoryRepository;
  readonly rules: RuleRepository;
  readonly budgets: BudgetRepository;
  readonly snapshot: InMemoryDataSnapshot;
  readonly settings: InMemorySettingsRepository;
}

export const TEST_ACCOUNT: Account = {
  id: ACCOUNT as AccountId,
  name: 'Cuenta corriente',
  ibanLast4: '1234',
  currency: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Mundo en memoria con categorías por defecto y una cuenta (`acc-1`). */
export function createWorld(): World {
  const state = createInMemoryState();
  for (const c of DEFAULT_CATEGORIES) state.categories.set(c.id, c);
  state.accounts.set(TEST_ACCOUNT.id, TEST_ACCOUNT);
  const clock = new FixedClock();
  return {
    state,
    clock,
    ids: new SequentialIdGenerator(),
    transactions: new InMemoryTransactionRepository(state),
    batches: new InMemoryImportBatchRepository(state),
    profiles: new InMemoryImportProfileRepository(state),
    accounts: new InMemoryAccountRepository(state),
    categories: new InMemoryCategoryRepository(state),
    rules: new InMemoryRuleRepository(state),
    budgets: new InMemoryBudgetRepository(state),
    snapshot: new InMemoryDataSnapshot(state, clock),
    settings: new InMemorySettingsRepository(state),
  };
}
