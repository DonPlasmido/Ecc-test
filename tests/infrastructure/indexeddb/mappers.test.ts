import { describe, expect, it } from 'vitest';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { Cents } from '@/domain/money/Money';
import {
  budgetFromRecord,
  budgetToRecord,
  transactionFromRecord,
  transactionToRecord,
} from '@/infrastructure/indexeddb/mappers';
import { makeBudget, makeTransaction } from './fixtures';

describe('transaction mapper', () => {
  it('stores Money as integer cents in a flat record', () => {
    const tx = makeTransaction(1, { amount: { cents: -1234 as Cents } });
    const record = transactionToRecord(tx);
    expect(record.amountCents).toBe(-1234);
    expect(record.balanceCents).toBeNull();
    expect(record).not.toHaveProperty('amount');
    expect(record).not.toHaveProperty('balance');
  });

  it('round-trips a transaction with balance and value date', () => {
    const tx = makeTransaction(2, {
      balance: { cents: 100_000 as Cents },
      valueDate: '2024-03-04' as IsoDate,
      categorySource: 'manual',
      note: 'ñandú 🦩',
    });
    expect(transactionFromRecord(transactionToRecord(tx))).toEqual(tx);
  });

  it('round-trips a zero balance without turning it into null', () => {
    const tx = makeTransaction(3, { balance: { cents: 0 as Cents } });
    expect(transactionFromRecord(transactionToRecord(tx)).balance).toEqual({ cents: 0 });
  });

  it('does not mutate its input', () => {
    const tx = makeTransaction(4);
    const snapshot = structuredClone(tx);
    transactionToRecord(tx);
    expect(tx).toEqual(snapshot);
  });
});

describe('budget mapper', () => {
  it('stores the monthly limit as cents and round-trips', () => {
    const budget = makeBudget('b1', 'c1', { endMonth: null });
    const record = budgetToRecord(budget);
    expect(record.monthlyLimitCents).toBe(25_000);
    expect(budgetFromRecord(record)).toEqual(budget);
  });
});
