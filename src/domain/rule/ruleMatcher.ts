import { UNCATEGORIZED } from '@/domain/category/Category'
import type { Rule } from '@/domain/rule/Rule'
import { matchesRulePattern } from '@/domain/rule/wordMatch'
import { recategorize, type Transaction } from '@/domain/transaction/Transaction'

type Matchable = Pick<Transaction, 'normalizedDescription' | 'amount' | 'accountId'>

function compareRules(a: Rule, b: Rule): number {
  if (a.priority !== b.priority) return a.priority - b.priority
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function signAllows(rule: Rule, cents: number): boolean {
  if (rule.amountSign === 'expense') return cents < 0
  if (rule.amountSign === 'income') return cents > 0
  return true
}

function applies(rule: Rule, tx: Matchable): boolean {
  return (
    rule.enabled &&
    (rule.accountId === null || rule.accountId === tx.accountId) &&
    signAllows(rule, tx.amount.cents) &&
    matchesRulePattern(tx.normalizedDescription, rule.pattern, rule.operator)
  )
}

/** Reglas ordenadas por prioridad, luego `createdAt` (y `id` como desempate final). */
export function sortRules(rules: readonly Rule[]): readonly Rule[] {
  return [...rules].sort(compareRules)
}

/** Primera regla (por prioridad) que aplica al movimiento, sin depender del orden de almacenamiento. */
export function matchRule(tx: Matchable, rules: readonly Rule[]): Rule | null {
  let best: Rule | null = null
  for (const rule of rules) {
    if ((best === null || compareRules(rule, best) < 0) && applies(rule, tx)) best = rule
  }
  return best
}

/** Aplica reglas; una categoría `'manual'` nunca se toca. */
export function categorize(tx: Transaction, rules: readonly Rule[]): Transaction {
  if (tx.categorySource === 'manual') return tx
  const rule = matchRule(tx, rules)
  if (rule !== null) return recategorize(tx, rule.categoryId, 'rule', rule.id, tx.updatedAt)
  if (tx.categorySource === 'rule') return recategorize(tx, UNCATEGORIZED, 'none', null, tx.updatedAt)
  return tx
}
