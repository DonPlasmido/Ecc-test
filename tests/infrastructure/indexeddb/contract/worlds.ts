import type { ImportBatchRepository } from '@/application/ports/outbound/ImportBatchRepository';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import { IdbImportBatchRepository } from '@/infrastructure/indexeddb/IdbImportBatchRepository';
import { IdbTransactionRepository } from '@/infrastructure/indexeddb/IdbTransactionRepository';
import { openDatabase } from '@/infrastructure/indexeddb/openDatabase';
import { InMemoryImportBatchRepository } from '../../../fakes/InMemoryImportBatchRepository';
import { createInMemoryState } from '../../../fakes/InMemoryState';
import { InMemoryTransactionRepository } from '../../../fakes/InMemoryTransactionRepository';
import { uniqueDbName } from '../fixtures';

/** Conjunto de puertos de salida bajo prueba (misma forma para la impl. Idb y el fake). */
export interface World {
  readonly transactions: TransactionRepository;
  readonly importBatches: ImportBatchRepository;
  dispose(): void;
}

export type WorldFactory = () => Promise<World>;

export const idbWorld: WorldFactory = async () => {
  const db = await openDatabase(uniqueDbName());
  return {
    transactions: new IdbTransactionRepository(db),
    importBatches: new IdbImportBatchRepository(db),
    dispose: () => db.close(),
  };
};

export const fakeWorld: WorldFactory = () => {
  const state = createInMemoryState();
  return Promise.resolve({
    transactions: new InMemoryTransactionRepository(state),
    importBatches: new InMemoryImportBatchRepository(state),
    dispose: () => undefined,
  });
};

export const WORLDS: ReadonlyArray<readonly [string, WorldFactory]> = [
  ['IndexedDB', idbWorld],
  ['in-memory fake', fakeWorld],
];
