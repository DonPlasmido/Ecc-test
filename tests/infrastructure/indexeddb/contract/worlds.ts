import type {
  AccountRepository,
  BudgetRepository,
  CategoryRepository,
  RuleRepository,
} from '@/application/ports/outbound/CatalogRepositories';
import type { DataSnapshotPort } from '@/application/ports/outbound/DataSnapshotPort';
import type { ImportBatchRepository } from '@/application/ports/outbound/ImportBatchRepository';
import type { ImportProfileRepository } from '@/application/ports/outbound/ImportProfileRepository';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import {
  IdbAccountRepository,
  IdbBudgetRepository,
  IdbCategoryRepository,
  IdbRuleRepository,
} from '@/infrastructure/indexeddb/IdbCatalogRepositories';
import { IdbDataSnapshot } from '@/infrastructure/indexeddb/IdbDataSnapshot';
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
import { InMemoryDataSnapshot } from '../../../fakes/InMemoryDataSnapshot';
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
  readonly snapshot: DataSnapshotPort;
  dispose(): void;
}

export const EXPORTED_AT = '2024-06-01T12:00:00.000Z';
const FIXED_CLOCK = { now: () => EXPORTED_AT };

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
    snapshot: new IdbDataSnapshot(db, FIXED_CLOCK),
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
    snapshot: new InMemoryDataSnapshot(state, FIXED_CLOCK),
    dispose: () => undefined,
  });
};

export const WORLDS: ReadonlyArray<readonly [string, WorldFactory]> = [
  ['IndexedDB', idbWorld],
  ['in-memory fake', fakeWorld],
];
