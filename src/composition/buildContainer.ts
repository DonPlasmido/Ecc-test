import type {
  AccountRepository,
  BudgetRepository,
  CategoryRepository,
  RuleRepository,
} from '@/application/ports/outbound/CatalogRepositories';
import type { BackupCipherPort } from '@/application/ports/outbound/BackupCipherPort';
import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { DataSnapshotPort } from '@/application/ports/outbound/DataSnapshotPort';
import type { IdGeneratorPort } from '@/application/ports/outbound/IdGeneratorPort';
import type { ImportProfileRepository } from '@/application/ports/outbound/ImportProfileRepository';
import type { SettingsRepository } from '@/application/ports/outbound/SettingsRepository';
import type { StatementParserPort } from '@/application/ports/outbound/StatementParserPort';
import type { StoragePersistencePort } from '@/application/ports/outbound/StoragePersistencePort';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import { createTransactionIndex } from '@/application/read-model/TransactionIndex';
import { createTransactionIndexStore } from '@/application/read-model/TransactionIndexStore';
import { BuildDashboardUseCase } from '@/application/use-cases/BuildDashboardUseCase';
import { CategorizeTransactionsUseCase } from '@/application/use-cases/CategorizeTransactionsUseCase';
import { DeleteAllDataUseCase } from '@/application/use-cases/DeleteAllDataUseCase';
import { EvaluateBudgetsUseCase } from '@/application/use-cases/EvaluateBudgetsUseCase';
import { ExportEncryptedBackupUseCase } from '@/application/use-cases/ExportEncryptedBackupUseCase';
import { ImportEncryptedBackupUseCase } from '@/application/use-cases/ImportEncryptedBackupUseCase';
import { ImportStatementUseCase } from '@/application/use-cases/ImportStatementUseCase';
import { LearnRuleFromCorrectionUseCase } from '@/application/use-cases/LearnRuleFromCorrectionUseCase';
import { ManageCatalogUseCase } from '@/application/use-cases/ManageCatalogUseCase';
import { QueryTransactionsUseCase } from '@/application/use-cases/QueryTransactionsUseCase';
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories';
import type { AppContainer } from './container.types';
import { IndexSync } from './IndexSync';

/** Puertos de salida ya construidos (reales o fakes) que el cableado necesita. */
export interface ContainerPorts {
  readonly transactions: TransactionRepository;
  readonly profiles: ImportProfileRepository;
  readonly accounts: AccountRepository;
  readonly categories: CategoryRepository;
  readonly rules: RuleRepository;
  readonly budgets: BudgetRepository;
  readonly snapshot: DataSnapshotPort;
  readonly settings: SettingsRepository;
  readonly parser: StatementParserPort;
  readonly cipher: BackupCipherPort;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly storage: StoragePersistencePort;
  readonly dispose?: () => void;
}

/**
 * Siembra las categorías por defecto solo con el catálogo vacío (respeta las que la persona borre) y en
 * una sola transacción: un fallo no puede dejar un catálogo a medias (silent-failures MEDIA-8).
 */
export async function seedDefaultCategories(categories: CategoryRepository): Promise<void> {
  if ((await categories.list()).length > 0) return;
  await categories.saveMany(DEFAULT_CATEGORIES);
}

/** Cableado común: índice, store, casos de uso singleton y `onDataChanged` → reconciliación del índice. */
export async function buildContainer(ports: ContainerPorts): Promise<AppContainer> {
  await seedDefaultCategories(ports.categories);

  const index = createTransactionIndex();
  const indexStore = createTransactionIndexStore(index);
  const sync = new IndexSync(ports.transactions, index, indexStore);
  await sync.hydrate();
  const onDataChanged = sync.notifyDataChanged;
  const { transactions, rules, categories, clock, ids } = ports;

  void ports.storage.requestPersistence().catch(() => false);

  return {
    importStatement: new ImportStatementUseCase({
      parser: ports.parser,
      transactions,
      profiles: ports.profiles,
      rules,
      accounts: ports.accounts,
      clock,
      ids,
      onDataChanged,
    }),
    categorizeTransactions: new CategorizeTransactionsUseCase({ transactions, rules, clock, onDataChanged }),
    learnRuleFromCorrection: new LearnRuleFromCorrectionUseCase({ transactions, index, rules, categories, clock, ids, onDataChanged }),
    evaluateBudgets: new EvaluateBudgetsUseCase({ budgets: ports.budgets, transactions }),
    buildDashboard: new BuildDashboardUseCase({ index }),
    exportEncryptedBackup: new ExportEncryptedBackupUseCase({
      snapshot: ports.snapshot,
      cipher: ports.cipher,
      clock,
      settings: ports.settings,
    }),
    importEncryptedBackup: new ImportEncryptedBackupUseCase({ snapshot: ports.snapshot, cipher: ports.cipher, onDataChanged }),
    deleteAllData: new DeleteAllDataUseCase({ snapshot: ports.snapshot, onDataChanged }),
    queryTransactions: new QueryTransactionsUseCase({ index, transactions, clock, ids }),
    manageCatalog: new ManageCatalogUseCase({
      accounts: ports.accounts,
      categories,
      rules,
      budgets: ports.budgets,
      transactions,
      clock,
      ids,
      onDataChanged,
    }),
    indexStore,
    settings: ports.settings,
    storage: ports.storage,
    whenIndexIdle: () => sync.whenIdle(),
    dispose: () => ports.dispose?.(),
  };
}
