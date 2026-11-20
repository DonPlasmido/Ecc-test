# Infrastructure Codemap

<!-- Generated: 2026-11-20 | Files: src/infrastructure/** (~27 .ts) | Implementa puertos de application -->

**Entry points:** `src/infrastructure/indexeddb/openDatabase.ts`, `src/infrastructure/parsing/CompositeStatementParser.ts`, `src/infrastructure/crypto/WebCryptoBackupCipher.ts`

## IndexedDB (`indexeddb/`)

Base `cuentas-claras`, `DB_VERSION = 1` (`schema.ts`, `upgradeSchema`).

| Store | keyPath | Índices |
|---|---|---|
| transactions | id | byDedupKey (unique), byDate, byAccountDate, byCategoryDate, byImportBatch |
| accounts | id | — |
| categories | id | — |
| rules | id | byPriority |
| budgets | id | byCategory |
| importBatches | id | byImportedAt |
| importProfiles | headerSignature | — |
| meta | key | — (`settings`, `schemaVersion`) |

| Clase | Puerto |
|---|---|
| IdbTransactionRepository | TransactionRepository |
| IdbAccountRepository, IdbCategoryRepository, IdbRuleRepository, IdbBudgetRepository (`IdbCatalogRepositories.ts`) | CatalogRepositories |
| IdbImportBatchRepository, IdbImportProfileRepository | ImportBatch / ImportProfile |
| IdbDataSnapshot | DataSnapshotPort |
| IdbSettingsRepository | SettingsRepository |

`mappers.ts`: entidad ↔ registro (`transactionToRecord`, `budgetFromRecord`…). `CorruptRecordError` si un registro no valida.

## Parsing (`parsing/`)

- `CompositeStatementParser`: `route()` por extensión y firma (ZIP → XLSX; `.xls`, OLE2, PDF → rechazo); `checkFileSize` (20 MB).
- `PapaCsvParser`: autodetección de delimitador, `skipEmptyLines: 'greedy'`.
- `ExcelJsXlsxParser`: `import('exceljs')` dinámico; `zipGuard.ts` (`inspectZip`) limita entradas y ratio.
- `decodeText.ts`: UTF-8 estricto, fallback windows-1252.
- `limits.ts`: `MAX_FILE_BYTES` 20 MB, `MAX_ROWS` 200 000, `MAX_COLS` 200, `MAX_SHEETS` 10, `MAX_ZIP_ENTRIES` 100, `MAX_ZIP_RATIO` 100.

## Crypto (`crypto/`)

- `WebCryptoBackupCipher`: PBKDF2-SHA-256 (`DEFAULT_KDF_ITERATIONS` 600 000, mín. 100 000), AES-GCM 256.
- `backupEnvelope.ts`: magic `CCBK`, cabecera JSON versionada (`v`, `kdf`, `cipher`), sal 16 B, IV 12 B, tag 16 B. Límites de tamaño de cabecera y envelope.

## System (`system/`)

- `SystemClock` (ClockPort), `CryptoRandomIdGenerator` (IdGeneratorPort, `crypto.randomUUID`), `NavigatorStoragePersistence` (`navigator.storage.persist/estimate`).

## Tests

`tests/infrastructure/indexeddb/`, `tests/infrastructure/parsing/`, `tests/infrastructure/crypto/`, `tests/infrastructure/system/` (fake-indexeddb).

## Related

[INDEX](INDEX.md) · [application](application.md) · [composition](composition.md)
