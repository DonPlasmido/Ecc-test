import type { AppContainer } from '@/composition/container.types';
import type {
  IndexHydrationState,
  TransactionIndexSnapshot,
  TransactionIndexStore,
} from '@/application/read-model/TransactionIndexStore';

/** Store del índice controlable desde los tests. */
export interface FakeIndexStore extends TransactionIndexStore {
  /** Simula un cambio de datos: nueva versión y, opcionalmente, tamaño/hidratación. */
  bump(change?: { size?: number; hydration?: IndexHydrationState }): void;
  listenerCount(): number;
}

export function createFakeIndexStore(initial?: Partial<TransactionIndexSnapshot>): FakeIndexStore {
  let snapshot: TransactionIndexSnapshot = {
    version: 0,
    size: 0,
    hydration: { status: 'ready' },
    ...initial,
  };
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    bump(change) {
      snapshot = {
        version: snapshot.version + 1,
        size: change?.size ?? snapshot.size,
        hydration: change?.hydration ?? snapshot.hydration,
      };
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

function unexpected(port: string): never {
  throw new Error(`fakeContainer: ${port} not provided for this test`);
}

/** Puerto cuyos métodos fallan con un mensaje claro si el test no los sobrescribe. */
function unprovided<T extends object>(port: string): T {
  return new Proxy({} as T, {
    get: (_target, property) =>
      typeof property === 'symbol' || property === 'then' ? undefined : () => unexpected(`${port}.${property}`),
  });
}

/** Contenedor falso para tests de UI: puertos sobrescribibles y store de índice controlable. */
export function createFakeContainer(
  overrides: Partial<Omit<AppContainer, 'indexStore'>> & { indexStore?: FakeIndexStore } = {},
): AppContainer & { indexStore: FakeIndexStore } {
  return {
    importStatement: unprovided('importStatement'),
    categorizeTransactions: unprovided('categorizeTransactions'),
    learnRuleFromCorrection: unprovided('learnRuleFromCorrection'),
    evaluateBudgets: unprovided('evaluateBudgets'),
    buildDashboard: unprovided('buildDashboard'),
    exportEncryptedBackup: unprovided('exportEncryptedBackup'),
    importEncryptedBackup: unprovided('importEncryptedBackup'),
    deleteAllData: unprovided('deleteAllData'),
    queryTransactions: unprovided('queryTransactions'),
    manageCatalog: unprovided('manageCatalog'),
    ...overrides,
    settings: overrides.settings ?? unprovided('settings'),
    storage: overrides.storage ?? unprovided('storage'),
    whenIndexIdle: overrides.whenIndexIdle ?? (() => Promise.resolve()),
    dispose: overrides.dispose ?? (() => undefined),
    indexStore: overrides.indexStore ?? createFakeIndexStore(),
  };
}
