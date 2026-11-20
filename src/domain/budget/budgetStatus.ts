import { BASIS_POINTS_FULL, type Money } from '@/domain/money/Money';

/** Umbral de aviso: 80 % (en puntos básicos). */
export const NEAR_THRESHOLD_BASIS_POINTS = 8_000;

/** Estado de un presupuesto en un mes. */
export type BudgetStatus = 'ok' | 'near' | 'over';

/** Estado con aritmética entera exacta: over si spent > limit; near si spent*10000 >= limit*8000. */
export function budgetStatus(spent: Money, limit: Money): BudgetStatus {
  if (limit.cents <= 0) return spent.cents > 0 ? 'over' : 'ok';
  if (spent.cents > limit.cents) return 'over';
  const spentScaled = BigInt(spent.cents) * BigInt(BASIS_POINTS_FULL);
  const nearFrom = BigInt(limit.cents) * BigInt(NEAR_THRESHOLD_BASIS_POINTS);
  return spentScaled >= nearFrom ? 'near' : 'ok';
}
