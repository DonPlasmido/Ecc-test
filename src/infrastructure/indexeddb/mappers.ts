import type { AccountId } from '@/domain/account/Account';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import type { CategoryId } from '@/domain/category/Category';
import { IsoDate } from '@/domain/date/IsoDate';
import { parseYearMonth } from '@/domain/date/YearMonth';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import { Money } from '@/domain/money/Money';
import type { RuleId } from '@/domain/rule/Rule';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';
import type { BudgetRecord, TransactionRecord } from './schema';

// Los registros de cuentas, categorías, reglas, lotes y perfiles son idénticos al tipo de dominio
// (solo datos planos, sin Money), por lo que se guardan tal cual.

const CATEGORY_SOURCES: readonly Transaction['categorySource'][] = ['none', 'rule', 'manual'];

/** Registro de IndexedDB/backup que no cumple las invariantes del dominio. */
export class CorruptRecordError extends Error {
  constructor(
    readonly store: string,
    readonly recordId: string,
    readonly field: string,
    readonly reason: string,
  ) {
    super(`Corrupt ${store} record "${recordId}": invalid ${field} (${reason})`);
    this.name = 'CorruptRecordError';
  }
}

interface Reader {
  value<T>(field: string, result: Result<T, DomainError>): T;
  text(field: string, value: unknown): string;
  oneOf<T extends string>(field: string, value: unknown, allowed: readonly T[]): T;
}

function readerFor(store: string, record: { id: unknown }): Reader {
  const recordId = typeof record.id === 'string' ? record.id : '?';
  const fail = (field: string, reason: string): never => {
    throw new CorruptRecordError(store, recordId, field, reason);
  };
  return {
    value: (field, result) => (result.ok ? result.value : fail(field, result.error.code)),
    text: (field, value) => (typeof value === 'string' ? value : fail(field, 'not a string')),
    oneOf: (field, value, allowed) => allowed.find((item) => item === value) ?? fail(field, 'unexpected value'),
  };
}

const toCents = (money: Money | null): number | null => (money === null ? null : money.cents);

function moneyOf(read: Reader, field: string, cents: number): Money {
  return read.value(field, Money.ofCents(cents));
}

function optional<T>(value: unknown, parse: (v: string) => T, read: Reader, field: string): T | null {
  return value === null ? null : parse(read.text(field, value));
}

export function transactionToRecord(tx: Transaction): TransactionRecord {
  return {
    id: tx.id,
    accountId: tx.accountId,
    date: tx.date,
    valueDate: tx.valueDate,
    amountCents: tx.amount.cents,
    balanceCents: toCents(tx.balance),
    rawDescription: tx.rawDescription,
    description: tx.description,
    normalizedDescription: tx.normalizedDescription,
    categoryId: tx.categoryId,
    categorySource: tx.categorySource,
    ruleId: tx.ruleId,
    note: tx.note,
    dedupKey: tx.dedupKey,
    importBatchId: tx.importBatchId,
    ...(tx.sourceLine === undefined ? {} : { sourceLine: tx.sourceLine }),
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

/** Reconstruye una transacción validando en el borde; lanza `CorruptRecordError` si el registro está corrupto. */
export function transactionFromRecord(r: TransactionRecord): Transaction {
  const read = readerFor('transactions', r);
  const isoDate = (field: string) => (text: string) => read.value(field, IsoDate.parse(text));
  return {
    id: read.text('id', r.id) as TransactionId,
    accountId: read.text('accountId', r.accountId) as AccountId,
    date: isoDate('date')(read.text('date', r.date)),
    valueDate: optional(r.valueDate, isoDate('valueDate'), read, 'valueDate'),
    amount: moneyOf(read, 'amountCents', r.amountCents),
    balance: r.balanceCents === null ? null : moneyOf(read, 'balanceCents', r.balanceCents),
    rawDescription: read.text('rawDescription', r.rawDescription),
    description: read.text('description', r.description),
    normalizedDescription: read.text('normalizedDescription', r.normalizedDescription),
    categoryId: read.text('categoryId', r.categoryId) as CategoryId,
    categorySource: read.oneOf('categorySource', r.categorySource, CATEGORY_SOURCES),
    ruleId: optional(r.ruleId, (v) => v as RuleId, read, 'ruleId'),
    note: read.text('note', r.note),
    dedupKey: read.text('dedupKey', r.dedupKey) as DedupKey,
    importBatchId: read.text('importBatchId', r.importBatchId) as ImportBatchId,
    ...(typeof r.sourceLine === 'number' ? { sourceLine: r.sourceLine } : {}),
    createdAt: read.text('createdAt', r.createdAt),
    updatedAt: read.text('updatedAt', r.updatedAt),
  };
}

export function budgetToRecord(b: Budget): BudgetRecord {
  return {
    id: b.id,
    categoryId: b.categoryId,
    monthlyLimitCents: b.monthlyLimit.cents,
    startMonth: b.startMonth,
    endMonth: b.endMonth,
  };
}

/** Reconstruye un presupuesto validando en el borde; lanza `CorruptRecordError` si el registro está corrupto. */
export function budgetFromRecord(r: BudgetRecord): Budget {
  const read = readerFor('budgets', r);
  const month = (field: string) => (text: string) => read.value(field, parseYearMonth(text));
  return {
    id: read.text('id', r.id) as BudgetId,
    categoryId: read.text('categoryId', r.categoryId) as CategoryId,
    monthlyLimit: moneyOf(read, 'monthlyLimitCents', r.monthlyLimitCents),
    startMonth: month('startMonth')(read.text('startMonth', r.startMonth)),
    endMonth: optional(r.endMonth, month('endMonth'), read, 'endMonth'),
  };
}
