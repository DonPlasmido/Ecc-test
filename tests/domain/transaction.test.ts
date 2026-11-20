import { describe, expect, it } from 'vitest'
import type { CategoryId } from '@/domain/category/Category'
import type { RuleId } from '@/domain/rule/Rule'
import { assignDedupKeys, baseFingerprint } from '@/domain/transaction/DedupKey'
import { recategorize, withDescription, withNote } from '@/domain/transaction/Transaction'
import { ACCOUNT, draft, isoDate, money, tx } from './builders'

const NOW = '2026-02-01T09:00:00.000Z'

describe('Transaction helpers', () => {
  it('recategorize returns a new copy with category, source, rule and updatedAt', () => {
    const original = tx()
    const result = recategorize(original, 'cat-a' as CategoryId, 'rule', 'rule-1' as RuleId, NOW)
    expect(result).toEqual({ ...original, categoryId: 'cat-a', categorySource: 'rule', ruleId: 'rule-1', updatedAt: NOW })
    expect(result).not.toBe(original)
    expect(original.categorySource).toBe('none')
  })

  it('recategorize keeps rawDescription, dedupKey and createdAt', () => {
    const result = recategorize(tx(), 'cat-a' as CategoryId, 'manual', null, NOW)
    expect(result.rawDescription).toBe('Cafe Central')
    expect(result.dedupKey).toBe('k#0')
    expect(result.createdAt).toBe('2026-01-06T10:00:00.000Z')
    expect(result.ruleId).toBeNull()
  })

  it('withDescription changes only the editable description and does not touch the dedup inputs', () => {
    const original = tx()
    const result = withDescription(original, 'Mi cafe', NOW)
    expect(result.description).toBe('Mi cafe')
    expect(result.rawDescription).toBe(original.rawDescription)
    expect(result.normalizedDescription).toBe(original.normalizedDescription)
    expect(result.updatedAt).toBe(NOW)
  })

  it('withNote changes only the note', () => {
    const result = withNote(tx(), 'reembolsable', NOW)
    expect(result.note).toBe('reembolsable')
    expect(result.updatedAt).toBe(NOW)
    expect(result.description).toBe('Cafe Central')
  })
})

describe('baseFingerprint', () => {
  it('joins account, date, cents, normalized description and balance', () => {
    const fp = baseFingerprint(draft({ balance: money(195_490), amount: money(-4_510) }))
    expect(fp).toBe('acc-1|2026-01-05|-4510|CAFE CENTRAL|195490')
  })

  it('leaves the balance empty when absent', () => {
    expect(baseFingerprint(draft())).toBe('acc-1|2026-01-05|-450|CAFE CENTRAL|')
  })

  it('differs by account, date, amount, description and balance', () => {
    const base = baseFingerprint(draft())
    expect(baseFingerprint(draft({ accountId: 'acc-2' as typeof ACCOUNT }))).not.toBe(base)
    expect(baseFingerprint(draft({ date: isoDate('2026-01-06') }))).not.toBe(base)
    expect(baseFingerprint(draft({ amount: money(-451) }))).not.toBe(base)
    expect(baseFingerprint(draft({ normalizedDescription: 'OTRO' }))).not.toBe(base)
    expect(baseFingerprint(draft({ balance: money(0) }))).not.toBe(base)
  })

  it('ignores the raw (editable-case) description, source line and value date', () => {
    expect(baseFingerprint(draft({ rawDescription: 'cafe   central', sourceLine: 99, valueDate: isoDate('2026-01-07') }))).toBe(
      baseFingerprint(draft()),
    )
  })
})

describe('assignDedupKeys', () => {
  it('appends occurrence counters to identical movements', () => {
    const keyed = assignDedupKeys([draft(), draft({ sourceLine: 3 }), draft({ sourceLine: 4 })])
    expect(keyed.map((d) => d.dedupKey)).toEqual([
      'acc-1|2026-01-05|-450|CAFE CENTRAL|#0',
      'acc-1|2026-01-05|-450|CAFE CENTRAL|#1',
      'acc-1|2026-01-05|-450|CAFE CENTRAL|#2',
    ])
  })

  it('counts each fingerprint independently', () => {
    const keyed = assignDedupKeys([draft(), draft({ amount: money(-100) }), draft()])
    expect(keyed.map((d) => d.dedupKey.slice(-2))).toEqual(['#0', '#0', '#1'])
  })

  it('is deterministic and keeps the draft fields', () => {
    const input = [draft(), draft({ sourceLine: 3 })]
    const first = assignDedupKeys(input)
    expect(assignDedupKeys(input)).toEqual(first)
    expect(first[1]).toMatchObject({ sourceLine: 3, rawDescription: 'Cafe Central' })
  })

  it('does not mutate the input', () => {
    const input = [draft()]
    assignDedupKeys(input)
    expect('dedupKey' in (input[0] ?? {})).toBe(false)
  })

  it('returns an empty list for no drafts', () => {
    expect(assignDedupKeys([])).toEqual([])
  })

  it('overlapping imports yield the same keys for the shared movements', () => {
    const march = [draft({ date: isoDate('2026-03-20') }), draft({ date: isoDate('2026-03-20') })]
    const overlap = [draft({ date: isoDate('2026-03-20') }), draft({ date: isoDate('2026-03-20') }), draft({ date: isoDate('2026-03-21') })]
    const keysA = new Set(assignDedupKeys(march).map((d) => d.dedupKey))
    const keysB = assignDedupKeys(overlap).map((d) => d.dedupKey)
    expect(keysB.filter((k) => !keysA.has(k))).toHaveLength(1)
  })

  it('handles 10k drafts', () => {
    const many = Array.from({ length: 10_000 }, (_, i) => draft({ amount: money(-(i % 50)) }))
    const keys = new Set(assignDedupKeys(many).map((d) => d.dedupKey))
    expect(keys.size).toBe(10_000)
  })
})
