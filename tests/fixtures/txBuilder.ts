import type { AccountId } from '@/domain/account/Account';
import type { CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import type { Cents } from '@/domain/money/Money';
import { normalizeText } from '@/domain/shared/normalizeText';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';

export interface TxSpec {
  readonly id: string;
  readonly date?: string;
  readonly cents?: number;
  readonly desc?: string;
  readonly description?: string;
  readonly cat?: string;
  readonly acc?: string;
  readonly balance?: number | null;
}

/** Construye un movimiento mínimo para tests. */
export function tx(spec: TxSpec): Transaction {
  const raw = spec.desc ?? 'Compra';
  return {
    id: spec.id as TransactionId,
    accountId: (spec.acc ?? 'a1') as AccountId,
    date: (spec.date ?? '2026-03-10') as IsoDate,
    valueDate: null,
    amount: { cents: (spec.cents ?? -1000) as Cents },
    balance: spec.balance == null ? null : { cents: spec.balance as Cents },
    rawDescription: raw,
    description: spec.description ?? raw,
    normalizedDescription: normalizeText(raw),
    categoryId: (spec.cat ?? 'c1') as CategoryId,
    categorySource: 'none',
    ruleId: null,
    note: '',
    dedupKey: `dk-${spec.id}` as DedupKey,
    importBatchId: 'b1' as ImportBatchId,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
