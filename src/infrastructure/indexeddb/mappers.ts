import type { AccountId } from '@/domain/account/Account';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import type { CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import type { Cents, Money } from '@/domain/money/Money';
import type { RuleId } from '@/domain/rule/Rule';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';
import type { BudgetRecord, TransactionRecord } from './schema';

// Los registros de cuentas, categorías, reglas, lotes y perfiles son idénticos al tipo de dominio
// (solo datos planos, sin Money), por lo que se guardan tal cual.

const toCents = (money: Money | null): number | null => (money === null ? null : money.cents);
const toMoney = (cents: number | null): Money | null => (cents === null ? null : { cents: cents as Cents });

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
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

export function transactionFromRecord(r: TransactionRecord): Transaction {
  return {
    id: r.id as TransactionId,
    accountId: r.accountId as AccountId,
    date: r.date as IsoDate,
    valueDate: r.valueDate as IsoDate | null,
    amount: { cents: r.amountCents as Cents },
    balance: toMoney(r.balanceCents),
    rawDescription: r.rawDescription,
    description: r.description,
    normalizedDescription: r.normalizedDescription,
    categoryId: r.categoryId as CategoryId,
    categorySource: r.categorySource,
    ruleId: r.ruleId as RuleId | null,
    note: r.note,
    dedupKey: r.dedupKey as DedupKey,
    importBatchId: r.importBatchId as ImportBatchId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
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

export function budgetFromRecord(r: BudgetRecord): Budget {
  return {
    id: r.id as BudgetId,
    categoryId: r.categoryId as CategoryId,
    monthlyLimit: { cents: r.monthlyLimitCents as Cents },
    startMonth: r.startMonth as YearMonth,
    endMonth: r.endMonth as YearMonth | null,
  };
}
