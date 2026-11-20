# Codemaps: índice

<!-- Generated: 2026-11-20 | Files scanned: 225 (src/**/*.ts,tsx) | Fuente: lectura de src/ y package.json -->

Proyecto: Cuentas Claras, SPA/PWA sin backend. Un solo paquete (no monorepo). Entrada: `src/main.tsx`.
Capas (dependencia hacia dentro): `ui` → `composition` → `application` → `domain`; `infrastructure` implementa los puertos de `application`.

```
            ┌────────── ui (React, hash router, i18n, tema) ──────────┐
            │  features/* → hooks/useContainer → AppContainer          │
            └──────────────────────────┬───────────────────────────────┘
                                       │ puertos de entrada
┌──────────────────── composition ─────┴──────────────────────────────┐
│ createContainer → buildContainer → IndexSync (índice + reconciliar)  │
└──────────┬─────────────────────────────────────────────┬────────────┘
           ▼                                             ▼
┌─── application ───────────────┐              ┌─── infrastructure ─────────┐
│ use-cases/* ─ ports/outbound  │◄── implem. ──│ indexeddb/* parsing/* crypto│
│ read-model/TransactionIndex   │              │ system/*                    │
└──────────────┬────────────────┘              └────────────────────────────┘
               ▼
┌─── domain (puro, sin librerías) ───────────────────────────────────────┐
│ money · date · account · category · transaction · rule · budget · import│
│ shared (Result, DomainError)                                           │
└────────────────────────────────────────────────────────────────────────┘
```

| Mapa | Contenido | Archivo |
|---|---|---|
| Domain | Entidades, VO (Money, IsoDate), reglas puras | [domain.md](domain.md) |
| Application | 10 casos de uso, puertos, índice de lectura, copia | [application.md](application.md) |
| Infrastructure | IndexedDB (8 stores), parsers CSV/XLSX, WebCrypto, sistema | [infrastructure.md](infrastructure.md) |
| Composition | Cableado, `IndexSync`, `createTestContainer` | [composition.md](composition.md) |
| UI | Rutas, páginas, hooks, i18n, tema, componentes | [ui.md](ui.md) |

## Rutas (hash)

| Ruta | Página | Feature |
|---|---|---|
| `#/` | DashboardPage | `ui/features/dashboard` |
| `#/movimientos` | TransactionsPage | `ui/features/transactions` |
| `#/importar` | ImportPage | `ui/features/import` |
| `#/presupuestos` | BudgetsPage | `ui/features/budgets` |
| `#/reglas` | RulesPage (reglas + categorías) | `ui/features/rules` |
| `#/ajustes` | SettingsPage (copia, idioma, tema, borrar) | `ui/features/settings` |
| `*` | NotFoundPage | `ui/features/not-found` |

## Flujos transversales

- **Importar**: `FilePicker` → `useImportFlow` → `ImportStatementUseCase.preview` → `CompositeStatementParser` → `detectColumnMapping` → (confirmar) → `commit` → `assignDedupKeys` → `existingDedupKeys` → `insertImport` (IndexedDB, 1 tx) → `onDataChanged` → `IndexSync` → `TransactionIndex`. Tour: `.tours/flujo-importacion.tour`.
- **Panel / listas**: UI → `BuildDashboard` / `QueryTransactions` → `TransactionIndex` (memoria, sin IndexedDB en la consulta).
- **Copia cifrada**: `ExportEncryptedBackup` → `DataSnapshotPort` → `BackupSnapshot` → `BackupCipherPort` (PBKDF2 + AES-GCM) → `.ccbackup`.

Ver también: [docs/architecture.md](../architecture.md) (diseño y desviaciones), [docs/adr/](../adr/README.md).
