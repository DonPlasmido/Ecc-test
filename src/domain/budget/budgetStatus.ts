/** Umbral de aviso: 80 % (en puntos básicos). */
export const NEAR_THRESHOLD_BASIS_POINTS = 8_000;

/** Estado de un presupuesto en un mes. */
export type BudgetStatus = 'ok' | 'near' | 'over';

// TODO(domain): implementar en este archivo (enteros; over si spent > limit;
// near si spent*10000 >= limit*8000).
// export function budgetStatus(spent: Money, limit: Money): BudgetStatus;
