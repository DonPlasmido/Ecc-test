import type { Brand } from '@/domain/shared/brand';
import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { err, ok, type Result } from '@/domain/shared/Result';

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

function make(cents: number): Money {
  return { cents: (cents === 0 ? 0 : cents) as Cents }
}

/** Objeto compañero de `Money`: operaciones puras en céntimos enteros. */
export const Money: MoneyOperations = {
  ofCents(cents) {
    if (!Number.isInteger(cents)) {
      return err(domainError('money.notInteger', { value: String(cents) }))
    }
    if (!Number.isSafeInteger(cents)) {
      return err(domainError('money.outOfRange', { value: String(cents) }))
    }
    return ok(make(cents))
  },
  zero: () => make(0),
  add: (a, b) => make(a.cents + b.cents),
  subtract: (a, b) => make(a.cents - b.cents),
  negate: (a) => make(-a.cents),
  sum: (values) => make(values.reduce((total, v) => total + v.cents, 0)),
  isExpense: (a) => a.cents < 0,
  compare: (a, b) => (a.cents < b.cents ? -1 : a.cents > b.cents ? 1 : 0),
  ratioBasisPoints(part, whole) {
    if (whole.cents === 0) return 0
    return Number((BigInt(part.cents) * BigInt(BASIS_POINTS_FULL)) / BigInt(whole.cents))
  },
}
