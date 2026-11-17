import type { Account, AccountId } from '@/domain/account/Account';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { ImportBatch, ImportBatchId } from '@/domain/import/ImportBatch';
import type { ImportProfile } from '@/domain/import/ImportProfile';
import type { Cents } from '@/domain/money/Money';
import type { Rule, RuleId } from '@/domain/rule/Rule';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';

let dbCounter = 0;

/** Nombre de BD único por test para aislar. */
export function uniqueDbName(prefix = 'cc-test'): string {
  dbCounter += 1;
  return `${prefix}-${dbCounter}-${Math.random().toString(36).slice(2)}`;
}

export const ACCOUNT_ID = 'acc-1' as AccountId;
export const BATCH_ID = 'batch-1' as ImportBatchId;

export function makeTransaction(n: number, overrides: Partial<Transaction> = {}): Transaction {
  const day = String((n % 28) + 1).padStart(2, '0');
  const month = String((Math.floor(n / 28) % 12) + 1).padStart(2, '0');
  const date = `2024-${month}-${day}` as IsoDate;
  const id = `tx-${String(n).padStart(7, '0')}`;
  return {
    id: id as TransactionId,
    accountId: ACCOUNT_ID,
    date,
    valueDate: null,
    amount: { cents: -(n + 1) as Cents },
    balance: null,
    rawDescription: `Compra ${n}`,
    description: `Compra ${n}`,
    normalizedDescription: `COMPRA ${n}`,
    categoryId: '__uncategorized__' as CategoryId,
    categorySource: 'none',
    ruleId: null,
    note: '',
    dedupKey: `${ACCOUNT_ID}|${date}|${-(n + 1)}|COMPRA ${n}|#0` as DedupKey,
    importBatchId: BATCH_ID,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeBatch(overrides: Partial<ImportBatch> = {}): ImportBatch {
  return {
    id: BATCH_ID,
    accountId: ACCOUNT_ID,
    fileName: 'extracto.csv',
    importedAt: '2024-02-01T10:00:00.000Z',
    rowCount: 2,
    inserted: 2,
    duplicates: 0,
    mapping: { headerRowIndex: 0, columns: ['date', 'description', 'amount'], amountConvention: 'signed' },
    ...overrides,
  };
}

export function makeAccount(id = 'acc-1', overrides: Partial<Account> = {}): Account {
  return { id: id as AccountId, name: `Cuenta ${id}`, ibanLast4: '1234', currency: 'EUR', createdAt: '2024-01-01T00:00:00.000Z', ...overrides };
}

export function makeCategory(id = 'cat-1', overrides: Partial<Category> = {}): Category {
  return { id: id as CategoryId, name: `Cat ${id}`, nameKey: null, kind: 'expense', color: 'blue', archived: false, ...overrides };
}

export function makeRule(id = 'rule-1', priority = 1, overrides: Partial<Rule> = {}): Rule {
  return {
    id: id as RuleId,
    pattern: 'MERCADONA',
    operator: 'contains',
    amountSign: 'any',
    accountId: null,
    categoryId: 'cat-1' as CategoryId,
    priority,
    enabled: true,
    origin: 'manual',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeBudget(id = 'bud-1', categoryId = 'cat-1', overrides: Partial<Budget> = {}): Budget {
  return {
    id: id as BudgetId,
    categoryId: categoryId as CategoryId,
    monthlyLimit: { cents: 25_000 as Cents },
    startMonth: '2024-01' as YearMonth,
    endMonth: null,
    ...overrides,
  };
}

export function makeProfile(signature = 'sig-1', overrides: Partial<ImportProfile> = {}): ImportProfile {
  return {
    headerSignature: signature,
    mapping: { headerRowIndex: 1, columns: ['date', 'ignore', 'description', 'debit', 'credit'], amountConvention: 'debitCredit' },
    accountId: ACCOUNT_ID,
    ...overrides,
  };
}
