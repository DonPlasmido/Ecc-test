import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { ROUTES } from './routes';

// Una carga diferida por ruta: el panel y la importación quedan fuera del chunk inicial (§11).
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TransactionsPage = lazy(() =>
  import('./features/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage })),
);
const ImportPage = lazy(() => import('./features/import/ImportPage').then((m) => ({ default: m.ImportPage })));
const BudgetsPage = lazy(() => import('./features/budgets/BudgetsPage').then((m) => ({ default: m.BudgetsPage })));
const RulesPage = lazy(() => import('./features/rules/RulesPage').then((m) => ({ default: m.RulesPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => import('./features/not-found/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path={ROUTES.transactions} element={<TransactionsPage />} />
        <Route path={ROUTES.import} element={<ImportPage />} />
        <Route path={ROUTES.budgets} element={<BudgetsPage />} />
        <Route path={ROUTES.rules} element={<RulesPage />} />
        <Route path={ROUTES.settings} element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
