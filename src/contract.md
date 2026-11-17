# Contrato compartido

Solo tipos, interfaces y constantes (fuente: `docs/architecture.md` §4–§9 y §12). Las firmas de funciones
pendientes están como `TODO(<módulo>)` en el archivo que las alojará. **Cambiar un contrato exige avisar a
todos los módulos**; añadir es seguro, renombrar o quitar no.

Convenciones: imports con alias `@/`, solo `import type` entre capas, `Result<T, DomainError>` para fallos
esperados, excepciones solo para lo inesperado, textos nunca en dominio/aplicación (códigos `DomainErrorCode`).

## Mapa archivo → módulo que implementa

| Archivo de contrato | Módulo | Qué implementa |
|---|---|---|
| `domain/shared/{brand,Result,DomainError}.ts` | domain | `ok`, `err`, `domainError`; `normalizeText.ts` |
| `domain/money/Money.ts` | domain | `const Money: MoneyOperations`; `parseSpanishAmount.ts` |
| `domain/date/{IsoDate,YearMonth}.ts` | domain | `const IsoDate: IsoDateOperations`; `parseSpanishDate.ts` |
| `domain/account/Account.ts`, `category/Category.ts` | domain | `defaultCategories.ts` |
| `domain/transaction/{Transaction,DedupKey}.ts` | domain | `recategorize`, `withNote`…; `baseFingerprint`, `assignDedupKeys` |
| `domain/rule/{Rule,ruleSuggestion}.ts` | domain | `ruleMatcher.ts` (`matchRule`, `categorize`, `sortRules`), `suggestRule` |
| `domain/budget/{Budget,budgetStatus}.ts` | domain | `budgetStatus()` |
| `domain/import/{RawTable,ColumnMapping,RowError,StatementFile}.ts` | domain | `detectHeaderRow.ts`, `detectColumnMapping.ts`, `normalizeRows.ts` |
| `domain/import/{ImportBatch,ImportProfile}.ts` | domain | (solo tipos) |
| `application/ports/inbound/*.ts` (9) | application | `use-cases/<Nombre>UseCase.ts` implementa la interfaz homónima |
| `application/read-model/TransactionIndex.ts` | application | índice columnar (`createTransactionIndex`) |
| `application/read-model/TransactionIndexStore.ts` | application | store versión + suscripción |
| `application/backup/BackupSnapshot.ts` | application | `migrateSnapshot.ts` |
| `ports/outbound/{TransactionRepository,CatalogRepositories,ImportBatchRepository,ImportProfileRepository,DataSnapshotPort}.ts` | indexeddb | `infrastructure/indexeddb/Idb*.ts` + `schema.ts`, `openDatabase.ts`, `mappers.ts` |
| `ports/outbound/StatementParserPort.ts` | parsing | `PapaCsvParser`, `ExcelJsXlsxParser`, `CompositeStatementParser`, `decodeText` |
| `ports/outbound/BackupCipherPort.ts` | crypto | `WebCryptoBackupCipher`, `backupEnvelope.ts` (constantes KDF/IV/magic, §10) |
| `ports/outbound/{ClockPort,IdGeneratorPort,StoragePersistencePort}.ts` | application (system) | `infrastructure/system/*` |
| `composition/container.types.ts` | application (composition) | `createContainer.ts`, `createTestContainer` |
| `ports/inbound/*`, `container.types.ts`, `TransactionIndexStore.ts` (consumo) | ui | hooks, páginas; solo `import type` |

Fakes en memoria de cada puerto de salida (`tests/fakes`) los escribe el módulo dueño del puerto.

## Notas

- `ImportBatch` e `ImportProfile` viven en el dominio (los usan `Transaction`, la copia y los repositorios);
  los archivos de puerto los reexportan.
- Errores de dominio: `domain/shared/DomainError.ts` (no hay `domain/errors.ts`). Nuevo código = añadirlo a
  `DOMAIN_ERROR_CODES` y a `ui/i18n/locales/*/errors.json`.
- `TransactionIndex` es una interfaz (no clase): `TransactionIndex.empty()` pasa a ser `createTransactionIndex()`.
