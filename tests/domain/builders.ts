import type { AccountId } from '@/domain/account/Account'
import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category'
import type { IsoDate } from '@/domain/date/IsoDate'
import type { ImportBatchId } from '@/domain/import/ImportBatch'
import type { RawCell, RawTable } from '@/domain/import/RawTable'
import type { Cents, Money } from '@/domain/money/Money'
import type { Rule, RuleId } from '@/domain/rule/Rule'
import type { DedupKey } from '@/domain/transaction/DedupKey'
import type { Transaction, TransactionDraft, TransactionId } from '@/domain/transaction/Transaction'

export const ACCOUNT = 'acc-1' as AccountId

export function money(cents: number): Money {
  return { cents: cents as Cents }
}

export function isoDate(value: string): IsoDate {
  return value as IsoDate
}

export function draft(overrides: Partial<TransactionDraft> = {}): TransactionDraft {
  return {
    accountId: ACCOUNT,
    date: isoDate('2026-01-05'),
    valueDate: null,
    amount: money(-450),
    balance: null,
    rawDescription: 'Cafe Central',
    normalizedDescription: 'CAFE CENTRAL',
    sourceLine: 2,
    ...overrides,
  }
}

export function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1' as TransactionId,
    accountId: ACCOUNT,
    date: isoDate('2026-01-05'),
    valueDate: null,
    amount: money(-450),
    balance: null,
    rawDescription: 'Cafe Central',
    description: 'Cafe Central',
    normalizedDescription: 'CAFE CENTRAL',
    categoryId: UNCATEGORIZED,
    categorySource: 'none',
    ruleId: null,
    note: '',
    dedupKey: 'k#0' as DedupKey,
    importBatchId: 'batch-1' as ImportBatchId,
    createdAt: '2026-01-06T10:00:00.000Z',
    updatedAt: '2026-01-06T10:00:00.000Z',
    ...overrides,
  }
}

export function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule-1' as RuleId,
    pattern: 'MERCADONA',
    operator: 'contains',
    amountSign: 'any',
    accountId: null,
    categoryId: 'cat-groceries' as CategoryId,
    priority: 1,
    enabled: true,
    origin: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function text(value: string): RawCell {
  return { kind: 'text', value }
}

export function num(value: number): RawCell {
  return { kind: 'number', value }
}

export function dateCell(value: string): RawCell {
  return { kind: 'date', value: value as IsoDate }
}

export const EMPTY: RawCell = { kind: 'empty' }

/** Builds a RawTable; plain strings become text cells ('' becomes an empty cell). */
export function table(rows: readonly (readonly (RawCell | string)[])[]): RawTable {
  return {
    sourceName: 'test.csv',
    rows: rows.map((row) => row.map((cell) => (typeof cell === 'string' ? (cell === '' ? EMPTY : text(cell)) : cell))),
  }
}
