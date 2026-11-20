import type { AccountId } from '@/domain/account/Account';
import type { CategoryId } from '@/domain/category/Category';
import { IsoDate } from '@/domain/date/IsoDate';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import type { Cents } from '@/domain/money/Money';
import { normalizeText } from '@/domain/shared/normalizeText';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';

export interface GenerateTransactionsOptions {
  readonly count: number;
  /** Semilla del PRNG: misma semilla, mismos datos. */
  readonly seed?: number;
  /** Primer día cubierto (inclusive). */
  readonly startDate?: string;
  /** Número de meses de 30 días cubiertos. */
  readonly months?: number;
  readonly accounts?: number;
  readonly categories?: number;
}

export const FIXTURE_MERCHANTS = [
  'Mercadona',
  'Carrefour Express',
  'Lidl',
  'Nómina Empresa SA',
  'Netflix',
  'Repsol Gasolinera',
  'Farmacia Central',
  'Amazon Marketplace',
  'Bizum recibido',
  'Cafetería Ñandú',
] as const;

/** PRNG determinista mulberry32 (datos de prueba, no criptográfico). */
export function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export const fixtureAccountId = (n: number): AccountId => `acc-${n}` as AccountId;
export const fixtureCategoryId = (n: number): CategoryId => `cat-${n}` as CategoryId;

/** Genera movimientos sintéticos deterministas (nunca datos reales). */
export function generateTransactions(options: GenerateTransactionsOptions): Transaction[] {
  const { count, seed = 42, startDate = '2024-01-01', months = 24, accounts = 3, categories = 12 } = options;
  const random = createPrng(seed);
  const startDay = IsoDate.toEpochDay(startDate as IsoDate);
  const spanDays = months * 30;
  const result: Transaction[] = [];
  for (let i = 0; i < count; i += 1) {
    const merchant = FIXTURE_MERCHANTS[Math.floor(random() * FIXTURE_MERCHANTS.length)] ?? 'Mercadona';
    const date = IsoDate.fromEpochDay(startDay + Math.floor(random() * spanDays));
    const isIncome = random() < 0.12;
    const magnitude = 100 + Math.floor(random() * 30_000);
    const raw = `${merchant.toUpperCase()} REF ${i}`;
    result.push({
      id: `tx-${seed}-${i}` as TransactionId,
      accountId: fixtureAccountId(Math.floor(random() * accounts)),
      date,
      valueDate: null,
      amount: { cents: (isIncome ? magnitude : -magnitude) as Cents },
      balance: null,
      rawDescription: raw,
      description: raw,
      normalizedDescription: normalizeText(raw),
      categoryId: fixtureCategoryId(Math.floor(random() * categories)),
      categorySource: 'none',
      ruleId: null,
      note: '',
      dedupKey: `dk-${seed}-${i}` as DedupKey,
      importBatchId: 'batch-1' as ImportBatchId,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }
  return result;
}
