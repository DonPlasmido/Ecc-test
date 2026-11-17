import type { Brand } from '@/domain/shared/brand';

/** Identificador de cuenta. */
export type AccountId = Brand<string, 'AccountId'>;

/** Moneda admitida (v1: solo EUR). */
export type Currency = 'EUR';

/** Cuenta bancaria del usuario. Nunca se guarda el IBAN completo. */
export interface Account {
  readonly id: AccountId;
  readonly name: string;
  /** Últimos 4 dígitos del IBAN, o `null`. */
  readonly ibanLast4: string | null;
  readonly currency: Currency;
  /** ISO datetime. */
  readonly createdAt: string;
}
