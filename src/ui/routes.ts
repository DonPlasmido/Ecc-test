/** Rutas del hash router (ADR-0005). Los filtros viven en la query del hash. */
export const ROUTES = {
  dashboard: '/',
  transactions: '/movimientos',
  import: '/importar',
  budgets: '/presupuestos',
  rules: '/reglas',
  settings: '/ajustes',
} as const;

export type RouteName = keyof typeof ROUTES;
