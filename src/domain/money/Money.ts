import type { Brand } from '@/domain/shared/brand';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';

/** Céntimos de euro: entero seguro (`Number.isSafeInteger`) con signo (ADR-0003). */
export type Cents = Brand<number, 'Cents'>;

/** Importe en EUR (moneda única). Negativo = gasto. */
export interface Money {
  readonly cents: Cents;
}

/** Puntos básicos: entero, 10000 = 100 %. */
export const BASIS_POINTS_FULL = 10_000;

/** Operaciones puras del VO `Money` (forma del objeto compañero `Money`). */
export interface MoneyOperations {
  /** Rechaza no enteros o fuera de safe integer. */
  ofCents(cents: number): Result<Money, DomainError>;
  zero(): Money;
  add(a: Money, b: Money): Money;
  subtract(a: Money, b: Money): Money;
  negate(a: Money): Money;
  sum(values: readonly Money[]): Money;
  /** `cents < 0`. */
  isExpense(a: Money): boolean;
  compare(a: Money, b: Money): -1 | 0 | 1;
  /** Entero, 10000 = 100 %. */
  ratioBasisPoints(part: Money, whole: Money): number;
}

// TODO(domain): implementar el objeto compañero en este archivo.
// export const Money: MoneyOperations = { ... };
// TODO(domain): src/domain/money/parseSpanishAmount.ts ("1.234,56" | "-12,30" | "12,30-", sin parseFloat)
// export function parseSpanishAmount(text: string): Result<Money, DomainError>;
