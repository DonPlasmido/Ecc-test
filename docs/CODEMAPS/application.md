# Application Codemap

<!-- Generated: 2026-11-20 | Files: src/application/** (~45 .ts) | Depende solo de domain -->

**Entry points:** `src/application/use-cases/*UseCase.ts` (10 casos de uso), `src/application/ports/inbound/*.ts`

## Casos de uso

| Caso de uso | Puerto de entrada | Puertos de salida usados |
|---|---|---|
| ImportStatementUseCase | ImportStatement (`preview`, `commit`) | StatementParser, Transaction, ImportProfile, Rule, Account, Clock, Id |
| CategorizeTransactionsUseCase | CategorizeTransactions | Transaction, Rule, Clock |
| LearnRuleFromCorrectionUseCase | LearnRuleFromCorrection (`correct`, `accept`) | Transaction, Rule, Category, Clock, Id |
| EvaluateBudgetsUseCase | EvaluateBudgets | Budget, Transaction |
| BuildDashboardUseCase | BuildDashboard (≤ 24 meses) | TransactionIndex |
| QueryTransactionsUseCase | QueryTransactions (`search`, `page`, `update`; página de 100) | TransactionIndex, Transaction |
| ManageCatalogUseCase | ManageCatalog (cuentas, categorías, reglas, presupuestos) | Catalog repos, Transaction |
| ExportEncryptedBackupUseCase | ExportEncryptedBackup | DataSnapshot, BackupCipher, Clock, Settings |
| ImportEncryptedBackupUseCase | ImportEncryptedBackup | DataSnapshot, BackupCipher |
| DeleteAllDataUseCase | DeleteAllData | DataSnapshot |

Auxiliares: `use-cases/applyRules.ts` (reaplicar reglas), `use-cases/storageErrors.ts` (detección de cuota).

## Puertos de salida (`ports/outbound/`)

- `TransactionRepository`: `existingDedupKeys`, `insertImport`, `deleteByImportBatch`, …
- `CatalogRepositories`: Account, Category, Rule, Budget repositories
- `ImportBatchRepository`, `ImportProfileRepository`, `SettingsRepository`
- `DataSnapshotPort` (`replaceAll`, export atómico), `BackupCipherPort`
- `StatementParserPort` (`supports`, `parse`), `ClockPort`, `IdGeneratorPort`, `StoragePersistencePort`

## Read-model

- `read-model/TransactionIndex.ts`: `createTransactionIndex()`, columnar (TypedArrays). Métodos: `hydrate`, `applyUpserts`, `applyDeletes`, `filter`, `idsAt`, `sumAt`, `totalsByMonthAndCategory`, `latestBalances`, `onChange`.
- `read-model/TransactionIndexStore.ts`: versión + estado de hidratación (`useSyncExternalStore`).
- `read-model/monthMath.ts`: aritmética de meses.

## Backup

- `backup/BackupSnapshot.ts` (DTO versionado), `backup/migrateSnapshot.ts` (migraciones de formato).
- `BACKUP_FORMAT_VERSION`, `MIN_BACKUP_PASSWORD_LENGTH = 12`, `BACKUP_FILE_EXTENSION = '.ccbackup'`.

## Tests

`tests/application/use-cases/`, `tests/application/read-model/`, `tests/application/backup/`; harness en `tests/application/harness.ts`.

## Related

[INDEX](INDEX.md) · [domain](domain.md) · [infrastructure](infrastructure.md)
