import { WebCryptoBackupCipher, type WebCryptoBackupCipherOptions } from '@/infrastructure/crypto/WebCryptoBackupCipher';
import {
  IdbAccountRepository,
  IdbBudgetRepository,
  IdbCategoryRepository,
  IdbRuleRepository,
} from '@/infrastructure/indexeddb/IdbCatalogRepositories';
import { IdbDataSnapshot } from '@/infrastructure/indexeddb/IdbDataSnapshot';
import { IdbImportProfileRepository } from '@/infrastructure/indexeddb/IdbImportProfileRepository';
import { IdbSettingsRepository } from '@/infrastructure/indexeddb/IdbSettingsRepository';
import { IdbTransactionRepository } from '@/infrastructure/indexeddb/IdbTransactionRepository';
import { openDatabase } from '@/infrastructure/indexeddb/openDatabase';
import { CompositeStatementParser } from '@/infrastructure/parsing/CompositeStatementParser';
import { BroadcastChannelChanges } from '@/infrastructure/system/BroadcastChannelChanges';
import { CryptoRandomIdGenerator } from '@/infrastructure/system/CryptoRandomIdGenerator';
import { NavigatorStoragePersistence } from '@/infrastructure/system/NavigatorStoragePersistence';
import { SystemClock } from '@/infrastructure/system/SystemClock';
import { buildContainer } from './buildContainer';
import type { AppContainer } from './container.types';

/** Canal de aviso entre pestañas de la app. */
const CROSS_TAB_CHANNEL = 'cuentas-claras';

export interface CreateContainerOptions {
  /** Nombre de la base IndexedDB (por defecto la de producción). */
  readonly dbName?: string;
  /** Parámetros del cifrador (por defecto PBKDF2 con 600.000 iteraciones); solo se rebajan en tests. */
  readonly cipherOptions?: WebCryptoBackupCipherOptions;
}

/** Composition root de producción: IndexedDB + parsers + WebCrypto + reloj del sistema. */
export async function createContainer(options: CreateContainerOptions = {}): Promise<AppContainer> {
  const db = await openDatabase(options.dbName);
  const clock = new SystemClock();
  return buildContainer({
    transactions: new IdbTransactionRepository(db),
    profiles: new IdbImportProfileRepository(db),
    accounts: new IdbAccountRepository(db),
    categories: new IdbCategoryRepository(db),
    rules: new IdbRuleRepository(db),
    budgets: new IdbBudgetRepository(db),
    snapshot: new IdbDataSnapshot(db, clock),
    settings: new IdbSettingsRepository(db),
    parser: new CompositeStatementParser(),
    cipher: new WebCryptoBackupCipher(options.cipherOptions),
    clock,
    ids: new CryptoRandomIdGenerator(),
    storage: new NavigatorStoragePersistence(),
    crossTab: new BroadcastChannelChanges(CROSS_TAB_CHANNEL),
    dispose: () => db.close(),
  });
}
