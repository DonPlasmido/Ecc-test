# UI Codemap

<!-- Generated: 2026-11-20 | Files: src/ui/** (~120 .ts/.tsx/.css) | React 19, HashRouter -->

**Entry points:** `src/main.tsx` → `src/ui/App.tsx` → `src/ui/AppRoutes.tsx`

## Árbol de proveedores

```
App
└ I18nextProvider
  └ ThemeProvider
    └ ErrorBoundary
      └ ContainerProvider (AppContainer)
        └ NotificationsProvider (Toast)
          └ HashRouter
            └ AppRoutes → AppLayout (BottomNav, IndexStatusBanner)
                 └ lazy(): Dashboard · Transactions · Import · Budgets · Rules · Settings · NotFound
```

## Módulos

| Carpeta | Contenido |
|---|---|
| `App.tsx`, `AppRoutes.tsx`, `routes.ts` | Proveedores, rutas lazy, `ROUTES` (`/`, `/movimientos`, `/importar`, `/presupuestos`, `/reglas`, `/ajustes`) |
| `container/` | `ContainerContext.tsx` |
| `hooks/` | `useContainer`, `useAsync`, `useTransactionIndex` (useSyncExternalStore) |
| `features/dashboard/` | DashboardPage, MonthPicker, SpendingHeadline, CategorySpending, MonthlyTrend, AccountBalances, BudgetsAtRisk; `useDashboard`, `dashboardModel` |
| `features/transactions/` | TransactionsPage, TransactionFilters, TransactionDetailDialog, RuleSuggestionDialog; `useTransactionFilters`, `useTransactionResults`, `filterParams` |
| `features/import/` | ImportPage, FilePicker, AccountPicker, MappingEditor, PreviewPanel, PreviewTable, ImportSummary; `useImportFlow`, `importModel`, `problemMessage` |
| `features/budgets/` | BudgetsPage, BudgetCard, BudgetFormDialog, DeleteBudgetDialog, MonthSwitcher; `useBudgetsData` |
| `features/rules/` | RulesPage, RulesSection, CategoriesSection (categorías viven aquí), RuleFormDialog, CategoryFormDialog, ApplyRules; `useCatalog`, `useRuleMatchCounts` |
| `features/settings/` | SettingsPage, BackupSection, ExportBackupDialog, RestoreBackup, PasswordField, DeleteAllDataSection, StorageSection, LanguageSelect, ThemeSelect |
| `features/not-found/` | NotFoundPage |
| `components/` | Button, Dialog, Field, Select, Toast, EmptyState, Skeleton, MoneyText, DateText, CategoryChip, BudgetProgressBar, VirtualTransactionList; `charts/` (BarChart, LineChart, ChartTable) |
| `layout/` | AppLayout, BottomNav, Page, IndexStatusBanner, ErrorBoundary, BootError, PlaceholderNotice |
| `i18n/` | `i18n.ts` (es eager, en bajo demanda), `format.ts` (Intl), `useLanguage.ts`, `errorMessage.ts`; `locales/{es,en}/` × 8 namespaces |
| `theme/` | `theme.ts` (preferencia, `applyTheme`), `ThemeProvider.tsx`; estilos en `styles/tokens.css` |
| `dev/` | `stubContainer.ts` (contenedor de desarrollo) |

## Reglas de UI

- Sin estado global: datos vía casos de uso + `useTransactionIndex`; navegación en la query del hash.
- Textos de extractos solo como texto (sin `dangerouslySetInnerHTML`; grep en `src/` no encuentra usos).
- Lista de movimientos: `VirtualTransactionList` con altura fija; páginas de 100.
- Carga diferida por ruta; `exceljs` solo entra al importar.

## Tests

`tests/ui/` (components, hooks, features/*, layout, i18nKeys, charts, VirtualTransactionList) y `tests/indexHtml.csp.test.ts` (CSP de `index.html`).

## Related

[INDEX](INDEX.md) · [composition](composition.md) · [application](application.md)
