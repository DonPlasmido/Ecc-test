import { WebCryptoBackupCipher } from '@/infrastructure/crypto/WebCryptoBackupCipher';
import { CompositeStatementParser } from '@/infrastructure/parsing/CompositeStatementParser';
import { FixedClock } from '../../tests/fakes/FixedClock';
import {
  InMemoryAccountRepository,
  InMemoryBudgetRepository,
  InMemoryCategoryRepository,
  InMemoryRuleRepository,
} from '../../tests/fakes/InMemoryCatalogRepositories';
import { InMemoryDataSnapshot } from '../../tests/fakes/InMemoryDataSnapshot';
import { InMemoryImportProfileRepository } from '../../tests/fakes/InMemoryImportProfileRepository';
import { createInMemoryState } from '../../tests/fakes/InMemoryState';
import { InMemorySettingsRepository } from '../../tests/fakes/InMemorySettingsRepository';
import { InMemoryTransactionRepository } from '../../tests/fakes/InMemoryTransactionRepository';
import { SequentialIdGenerator } from '../../tests/fakes/SequentialIdGenerator';
import { buildContainer, type ContainerPorts } from './buildContainer';
import type { AppContainer } from './container.types';

/** Iteraciones PBKDF2 de los tests (rápidas; el rango aceptado se rebaja a juego). */
const TEST_KDF_ITERATIONS = 1000;

const noStorage: ContainerPorts['storage'] = {
  requestPersistence: () => Promise.resolve(false),
  estimate: () => Promise.resolve(null),
};

/**
 * Mismo cableado que `createContainer` pero con fakes en memoria, reloj fijo, ids secuenciales y cifrador
 * rápido, para tests de UI y E2E de integración. Cualquier puerto puede sustituirse con `overrides`.
 */
export function createTestContainer(overrides: Partial<ContainerPorts> = {}): Promise<AppContainer> {
  const state = createInMemoryState();
  const clock = new FixedClock();
  return buildContainer({
    transactions: new InMemoryTransactionRepository(state),
    profiles: new InMemoryImportProfileRepository(state),
    accounts: new InMemoryAccountRepository(state),
    categories: new InMemoryCategoryRepository(state),
    rules: new InMemoryRuleRepository(state),
    budgets: new InMemoryBudgetRepository(state),
    snapshot: new InMemoryDataSnapshot(state, clock),
    settings: new InMemorySettingsRepository(state),
    parser: new CompositeStatementParser(),
    cipher: new WebCryptoBackupCipher({
      iterations: TEST_KDF_ITERATIONS,
      iterationLimits: { min: 1, max: 5 * TEST_KDF_ITERATIONS },
    }),
    clock,
    ids: new SequentialIdGenerator(),
    storage: noStorage,
    ...overrides,
  });
}
