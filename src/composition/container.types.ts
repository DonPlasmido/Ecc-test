import type { BuildDashboard } from '@/application/ports/inbound/BuildDashboard';
import type { CategorizeTransactions } from '@/application/ports/inbound/CategorizeTransactions';
import type { EvaluateBudgets } from '@/application/ports/inbound/EvaluateBudgets';
import type { ExportEncryptedBackup } from '@/application/ports/inbound/ExportEncryptedBackup';
import type { ImportEncryptedBackup } from '@/application/ports/inbound/ImportEncryptedBackup';
import type { ImportStatement } from '@/application/ports/inbound/ImportStatement';
import type { LearnRuleFromCorrection } from '@/application/ports/inbound/LearnRuleFromCorrection';
import type { ManageCatalog } from '@/application/ports/inbound/ManageCatalog';
import type { QueryTransactions } from '@/application/ports/inbound/QueryTransactions';
import type { TransactionIndexStore } from '@/application/read-model/TransactionIndexStore';

/** Lo único que la UI recibe: puertos de entrada y el observable de versión de datos. */
export interface AppContainer {
  readonly importStatement: ImportStatement;
  readonly categorizeTransactions: CategorizeTransactions;
  readonly learnRuleFromCorrection: LearnRuleFromCorrection;
  readonly evaluateBudgets: EvaluateBudgets;
  readonly buildDashboard: BuildDashboard;
  readonly exportEncryptedBackup: ExportEncryptedBackup;
  readonly importEncryptedBackup: ImportEncryptedBackup;
  readonly queryTransactions: QueryTransactions;
  readonly manageCatalog: ManageCatalog;
  readonly indexStore: TransactionIndexStore;
}

// TODO(composition): src/composition/createContainer.ts
// export async function createContainer(): Promise<AppContainer>;
