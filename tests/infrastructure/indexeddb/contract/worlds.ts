import type {
  AccountRepository,
  BudgetRepository,
  CategoryRepository,
  RuleRepository,
} from '@/application/ports/outbound/CatalogRepositories';
import type { ImportBatchRepository } from '@/application/ports/outbound/ImportBatchRepository';
import type { ImportProfileRepository } from '@/application/ports/outbound/ImportProfileRepository';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import {
  IdbAccountRepository,
  IdbBudgetRepository,
  IdbCategoryRepository,
  IdbRuleRepository,
} from '@/infrastructure/indexeddb/IdbCatalogRepositories';
import { IdbImportBatchRepository } from '@/infrastructure/indexeddb/IdbImportBatchRepository';
import { IdbImportProfileRepository } from '@/infrastructure/indexeddb/IdbImportProfileRepository';
import { IdbTransactionRepository } from '@/infrastructure/indexeddb/IdbTransactionRepository';
import { openDatabase } from '@/infrastructure/indexeddb/openDatabase';
import {
  InMemoryAccountRepository,
  InMemoryBudgetRepository,
  InMemoryCategoryRepository,
  InMemoryRuleRepository,
} from '../../../fakes/InMemoryCatalogRepositories';
import { InMemoryImportBatchRepository } from '../../../fakes/InMemoryImportBatchRepository';
import { InMemoryImportProfileRepository } from '../../../fakes/InMemoryImportProfileRepository';
import { createInMemoryState } from '../../../fakes/InMemoryState';
import { InMemoryTransactionRepository } from '../../../fakes/InMemoryTransactionRepository';
import { uniqueDbName } from '../fixtures';

/** Conjunto de puertos de salida bajo prueba (misma forma para la impl. Idb y el fake). */
export interface World {
  readonly transactions: TransactionRepository;
  readonly importBatches: ImportBatchRepository;
  readonly accounts: AccountRepository;
  readonly categories: CategoryRepository;
  readonly rules: RuleRepository;
  readonly budgets: BudgetRepository;
  readonly importProfiles: ImportProfileRepository;
  dispose(): void;
}

export type WorldFactory = () => Promise<World>;

export const idbWorld: WorldFactory = async () => {
  const db = await openDatabase(uniqueDbName());
  return {
    transactions: new IdbTransactionRepository(db),
    importBatches: new IdbImportBatchRepository(db),
    accounts: new IdbAccountRepository(db),
    categories: new IdbCategoryRepository(db),
    rules: new IdbRuleRepository(db),
    budgets: new IdbBudgetRepository(db),
    importProfiles: new IdbImportProfileRepository(db),
    dispose: () => db.close(),
  };
};

export const fakeWorld: WorldFactory = () => {
  const state = createInMemoryState();
  return Promise.resolve({
    transactions: new InMemoryTransactionRepository(state),
    importBatches: new InMemoryImportBatchRepository(state),
    accounts: new InMemoryAccountRepository(state),
    categories: new InMemoryCategoryRepository(state),
    rules: new InMemoryRuleRepository(state),
    budgets: new InMemoryBudgetRepository(state),
    importProfiles: new InMemoryImportProfileRepository(state),
    dispose: () => undefined,
  });
};

export const WORLDS: ReadonlyArray<readonly [string, WorldFactory]> = [
  ['IndexedDB', idbWorld],
  ['in-memory fake', fakeWorld],
];
