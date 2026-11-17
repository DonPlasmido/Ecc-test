import type { AppContainer } from '@/composition/container.types';
import type {
  TransactionIndexSnapshot,
  TransactionIndexStore,
} from '@/application/read-model/TransactionIndexStore';

/** Error que lanzan los casos de uso del contenedor provisional. */
export class NotWiredError extends Error {
  constructor(member: string) {
    super(`not wired: ${member} (falta src/composition/createContainer.ts)`);
    this.name = 'NotWiredError';
  }
}

/** Objeto cuyos métodos rechazan con `NotWiredError` al invocarse. */
function notWired<T extends object>(port: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      if (typeof property === 'symbol' || property === 'then') return undefined;
      // Todos los métodos de los puertos son asíncronos: el fallo llega como promesa rechazada.
      return async () => {
        throw new NotWiredError(`${port}.${property}`);
      };
    },
  });
}

const IDLE_SNAPSHOT: TransactionIndexSnapshot = { version: 0, size: 0, hydration: { status: 'idle' } };

const idleIndexStore: TransactionIndexStore = {
  subscribe: () => () => undefined,
  getSnapshot: () => IDLE_SNAPSHOT,
};

/**
 * Contenedor vacío para tests de hooks que no necesitan casos de uso reales.
 * El índice está vacío; cualquier caso de uso lanza "not wired".
 */
export function createStubContainer(): AppContainer {
  return {
    importStatement: notWired('importStatement'),
    categorizeTransactions: notWired('categorizeTransactions'),
    learnRuleFromCorrection: notWired('learnRuleFromCorrection'),
    evaluateBudgets: notWired('evaluateBudgets'),
    buildDashboard: notWired('buildDashboard'),
    exportEncryptedBackup: notWired('exportEncryptedBackup'),
    importEncryptedBackup: notWired('importEncryptedBackup'),
    queryTransactions: notWired('queryTransactions'),
    manageCatalog: notWired('manageCatalog'),
    settings: notWired('settings'),
    storage: notWired('storage'),
    whenIndexIdle: () => Promise.resolve(),
    dispose: () => undefined,
    indexStore: idleIndexStore,
  };
}
