import type { TransactionId } from '@/domain/transaction/Transaction'
import { describe, expect, it } from 'vitest'
import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category'
import type { AccountId } from '@/domain/account/Account'
import type { RuleId } from '@/domain/rule/Rule'
import { categorize, matchRule, sortRules } from '@/domain/rule/ruleMatcher'
import { suggestRule } from '@/domain/rule/ruleSuggestion'
import { money, rule, tx } from './builders'

const GROCERIES = 'cat-groceries' as CategoryId
const LEISURE = 'cat-leisure' as CategoryId
const SHOPPING = 'cat-shopping' as CategoryId
const SUBSCRIPTIONS = 'cat-subs' as CategoryId

describe('matchRule', () => {
  it('matches a whole word anywhere in the description', () => {
    const r = rule()
    expect(matchRule(tx({ normalizedDescription: 'COMPRA MERCADONA VALENCIA' }), [r])).toBe(r)
  })

  it('does not match inside a longer word (BAR vs BARCELONA)', () => {
    const r = rule({ pattern: 'BAR' })
    expect(matchRule(tx({ normalizedDescription: 'PAGO BARCELONA' }), [r])).toBeNull()
    expect(matchRule(tx({ normalizedDescription: 'MERCADO CENTRAL' }), [rule({ pattern: 'MERCADO' }), rule({ pattern: 'CENTRA' })])).not.toBeNull()
    expect(matchRule(tx({ normalizedDescription: 'MERCADO CENTRAL' }), [rule({ pattern: 'CENTRA' })])).toBeNull()
  })

  it('matches words glued to digits but not letters', () => {
    expect(matchRule(tx({ normalizedDescription: 'MERCADONA1234' }), [rule()])).not.toBeNull()
    expect(matchRule(tx({ normalizedDescription: 'XMERCADONA' }), [rule()])).toBeNull()
    expect(matchRule(tx({ normalizedDescription: 'A1234' }), [rule({ pattern: '123' })])).toBeNull()
  })

  it('matches patterns containing punctuation and several words', () => {
    expect(matchRule(tx({ normalizedDescription: 'NETFLIX.COM 1234' }), [rule({ pattern: 'NETFLIX.COM' })])).not.toBeNull()
    expect(matchRule(tx({ normalizedDescription: 'AMAZON PRIME ES' }), [rule({ pattern: 'AMAZON PRIME' })])).not.toBeNull()
  })

  it('finds a later occurrence when the first one is inside a longer word', () => {
    expect(matchRule(tx({ normalizedDescription: 'BARCELONA BAR' }), [rule({ pattern: 'BAR' })])).not.toBeNull()
  })

  it('supports startsWith and equals', () => {
    const starts = rule({ pattern: 'RECIBO', operator: 'startsWith' })
    expect(matchRule(tx({ normalizedDescription: 'RECIBO LUZ' }), [starts])).toBe(starts)
    expect(matchRule(tx({ normalizedDescription: 'PAGO RECIBO' }), [starts])).toBeNull()
    expect(matchRule(tx({ normalizedDescription: 'RECIBOS LUZ' }), [starts])).toBeNull()
    const equals = rule({ pattern: 'NOMINA', operator: 'equals' })
    expect(matchRule(tx({ normalizedDescription: 'NOMINA' }), [equals])).toBe(equals)
    expect(matchRule(tx({ normalizedDescription: 'NOMINA ENERO' }), [equals])).toBeNull()
  })

  it('ignores disabled rules and empty patterns', () => {
    expect(matchRule(tx({ normalizedDescription: 'MERCADONA' }), [rule({ enabled: false })])).toBeNull()
    expect(matchRule(tx({ normalizedDescription: 'MERCADONA' }), [rule({ pattern: '' })])).toBeNull()
  })

  it('filters by amount sign', () => {
    const expense = rule({ amountSign: 'expense' })
    const income = rule({ amountSign: 'income' })
    const base = { normalizedDescription: 'MERCADONA' }
    expect(matchRule(tx({ ...base, amount: money(-100) }), [expense])).toBe(expense)
    expect(matchRule(tx({ ...base, amount: money(100) }), [expense])).toBeNull()
    expect(matchRule(tx({ ...base, amount: money(100) }), [income])).toBe(income)
    expect(matchRule(tx({ ...base, amount: money(-100) }), [income])).toBeNull()
    expect(matchRule(tx({ ...base, amount: money(0) }), [expense, income])).toBeNull()
  })

  it('filters by account', () => {
    const scoped = rule({ accountId: 'acc-2' as AccountId })
    expect(matchRule(tx({ normalizedDescription: 'MERCADONA' }), [scoped])).toBeNull()
    expect(matchRule(tx({ normalizedDescription: 'MERCADONA', accountId: 'acc-2' as AccountId }), [scoped])).toBe(scoped)
  })

  it('picks by priority regardless of storage order, ties by createdAt', () => {
    const prime = rule({ id: 'a' as RuleId, pattern: 'AMAZON PRIME', priority: 1, categoryId: SUBSCRIPTIONS })
    const amazon = rule({ id: 'b' as RuleId, pattern: 'AMAZON', priority: 2, categoryId: SHOPPING })
    const t = tx({ normalizedDescription: 'AMAZON PRIME ES' })
    expect(matchRule(t, [amazon, prime])).toBe(prime)
    expect(matchRule(t, [prime, amazon])).toBe(prime)
    const reordered = [{ ...prime, priority: 3 }, amazon]
    expect(matchRule(t, reordered)).toBe(amazon)
    const older = rule({ id: 'o' as RuleId, pattern: 'AMAZON', priority: 1, createdAt: '2025-01-01T00:00:00.000Z' })
    const newer = rule({ id: 'n' as RuleId, pattern: 'AMAZON', priority: 1, createdAt: '2026-01-01T00:00:00.000Z' })
    expect(matchRule(t, [newer, older])).toBe(older)
  })

  it('returns null for no rules', () => {
    expect(matchRule(tx(), [])).toBeNull()
  })
})

describe('sortRules', () => {
  it('orders by priority, then createdAt, then id, without mutating', () => {
    const a = rule({ id: 'a' as RuleId, priority: 2 })
    const b = rule({ id: 'b' as RuleId, priority: 1, createdAt: '2026-02-01T00:00:00.000Z' })
    const c = rule({ id: 'c' as RuleId, priority: 1, createdAt: '2026-01-01T00:00:00.000Z' })
    const d = rule({ id: 'd' as RuleId, priority: 1, createdAt: '2026-01-01T00:00:00.000Z' })
    const input = [a, b, d, c]
    expect(sortRules(input).map((r) => r.id)).toEqual(['c', 'd', 'b', 'a'])
    expect(input.map((r) => r.id)).toEqual(['a', 'b', 'd', 'c'])
  })
})

describe('categorize', () => {
  it('assigns category, rule source and rule id', () => {
    const r = rule()
    const result = categorize(tx({ normalizedDescription: 'COMPRA MERCADONA' }), [r])
    expect(result).toMatchObject({ categoryId: GROCERIES, categorySource: 'rule', ruleId: r.id })
  })

  it('never overrides a manual category', () => {
    const manual = tx({ normalizedDescription: 'MERCADONA', categoryId: LEISURE, categorySource: 'manual' })
    expect(categorize(manual, [rule()])).toBe(manual)
  })

  it('leaves an uncategorized movement unchanged when nothing matches', () => {
    const t = tx({ normalizedDescription: 'MERCADO CENTRAL' })
    expect(categorize(t, [rule()])).toEqual(t)
  })

  it('resets a stale rule assignment when no rule matches anymore', () => {
    const stale = tx({ normalizedDescription: 'XYZ', categoryId: GROCERIES, categorySource: 'rule', ruleId: 'old' as RuleId })
    expect(categorize(stale, [])).toMatchObject({ categoryId: UNCATEGORIZED, categorySource: 'none', ruleId: null })
  })

  it('does not mutate the input', () => {
    const t = tx({ normalizedDescription: 'MERCADONA' })
    categorize(t, [rule()])
    expect(t.categorySource).toBe('none')
  })
})

describe('suggestRule', () => {
  const history = (items: readonly [string, CategoryId][]) =>
    items.map(([normalizedDescription, categoryId]) => ({ normalizedDescription, categoryId }))

  it('proposes the merchant token, dropping bank noise and numbers (AC-019)', () => {
    const suggestion = suggestRule(tx({ normalizedDescription: 'COMPRA TARJ NETFLIX.COM 1234' }), LEISURE)
    expect(suggestion).toEqual({ pattern: 'NETFLIX.COM', operator: 'contains', categoryId: LEISURE, amountSign: 'any' })
  })

  it('prefers the longest meaningful token when history cannot discriminate', () => {
    const suggestion = suggestRule(tx({ normalizedDescription: 'PAGO MOVIL MERCADONA SA ****1234 12/05' }), GROCERIES)
    expect(suggestion?.pattern).toBe('MERCADONA')
  })

  it('ignores corporate suffixes and short tokens', () => {
    const suggestion = suggestRule(tx({ normalizedDescription: 'RECIBO ZAS SL' }), GROCERIES)
    expect(suggestion?.pattern).toBe('ZAS')
  })

  it('discards candidates whose precision on the history is below 0.8', () => {
    const past = history([
      ['COMPRA CAFE ROMA', LEISURE],
      ['COMPRA CAFE LUNA', LEISURE],
      ['COMPRA PANADERIA SOL', GROCERIES],
      ['COMPRA PANADERIA MAR', GROCERIES],
    ])
    const suggestion = suggestRule(tx({ normalizedDescription: 'COMPRA CAFE SOL' }), LEISURE, past)
    expect(suggestion?.pattern).toBe('CAFE')
  })

  it('counts uncategorized past movements as non-conflicting', () => {
    const past = history([
      ['NETFLIX.COM 1', UNCATEGORIZED],
      ['NETFLIX.COM 2', UNCATEGORIZED],
      ['NETFLIX.COM 3', LEISURE],
    ])
    expect(suggestRule(tx({ normalizedDescription: 'NETFLIX.COM 9' }), LEISURE, past)?.pattern).toBe('NETFLIX.COM')
  })

  it('falls back to the full normalized concept when no candidate is precise enough', () => {
    const past = history([
      ['TIENDA PEPE', GROCERIES],
      ['TIENDA PEPE', GROCERIES],
      ['TIENDA PEPE', GROCERIES],
    ])
    const suggestion = suggestRule(tx({ normalizedDescription: 'TIENDA PEPE' }), LEISURE, past)
    expect(suggestion?.pattern).toBe('TIENDA PEPE')
  })

  it('discards candidates matching more than 5 % of a large history', () => {
    const noise = Array.from({ length: 200 }, (_, i) => [`COMPRA TIENDA ${i}`, LEISURE] as [string, CategoryId])
    const past = history([...noise, ['COMPRA LIBRERIA ALFA', LEISURE]])
    const suggestion = suggestRule(tx({ normalizedDescription: 'COMPRA LIBRERIA BETA' }), LEISURE, past)
    expect(suggestion?.pattern).toBe('LIBRERIA')
  })

  it('does not count the movement itself twice when it is part of the history', () => {
    const self = tx({ normalizedDescription: 'NETFLIX.COM 1234' })
    const suggestion = suggestRule(self, LEISURE, [self])
    expect(suggestion?.pattern).toBe('NETFLIX.COM')
  })

  it('excludes the movement itself by id when the history holds a copy with its old category', () => {
    const self = tx({ normalizedDescription: 'COMPRA MERCADONA 1234' })
    const past = [
      { id: self.id, normalizedDescription: self.normalizedDescription, categoryId: SHOPPING },
      { id: 'tx-2' as TransactionId, normalizedDescription: 'COMPRA MERCADONA 55', categoryId: GROCERIES },
    ]
    expect(suggestRule(self, GROCERIES, past)?.pattern).toBe('MERCADONA')
  })

  it('fallback drops tokens containing digits', () => {
    const past = history([['TIENDA PEPE', GROCERIES], ['TIENDA PEPE', GROCERIES], ['TIENDA PEPE', GROCERIES]])
    const suggestion = suggestRule(tx({ normalizedDescription: 'TIENDA PEPE 28001 REF123' }), LEISURE, past)
    expect(suggestion?.pattern).toBe('TIENDA PEPE')
  })

  it('prefers the simplest pattern among equally precise candidates', () => {
    const past = history([
      ['AMAZON PRIME ES', SUBSCRIPTIONS],
      ['AMAZON MARKETPLACE', SHOPPING],
      ['AMAZON MARKETPLACE', SHOPPING],
      ['AMAZON EU', SHOPPING],
    ])
    const suggestion = suggestRule(tx({ normalizedDescription: 'AMAZON PRIME ES' }), SUBSCRIPTIONS, past)
    expect(suggestion?.pattern).toBe('PRIME')
  })

  it('returns null for the uncategorized target or when there is nothing to match on', () => {
    expect(suggestRule(tx({ normalizedDescription: 'MERCADONA' }), UNCATEGORIZED)).toBeNull()
    expect(suggestRule(tx({ normalizedDescription: '' }), LEISURE)).toBeNull()
    expect(suggestRule(tx({ normalizedDescription: '12 34' }), LEISURE)).toBeNull()
  })

  it('works with an English concept and generated patterns match the original text', () => {
    const t = tx({ normalizedDescription: 'CARD PURCHASE SPOTIFY AB' })
    const suggestion = suggestRule(t, LEISURE)
    expect(suggestion?.pattern).toBe('SPOTIFY')
    const generated = rule({ pattern: suggestion?.pattern ?? '', categoryId: LEISURE })
    expect(matchRule(t, [generated])).toBe(generated)
  })
})
