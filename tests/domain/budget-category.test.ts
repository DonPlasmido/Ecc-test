import { describe, expect, it } from 'vitest'
import { budgetStatus, NEAR_THRESHOLD_BASIS_POINTS } from '@/domain/budget/budgetStatus'
import { UNCATEGORIZED } from '@/domain/category/Category'
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories'
import { money } from './builders'

describe('budgetStatus', () => {
  it('uses an 80 % near threshold', () => {
    expect(NEAR_THRESHOLD_BASIS_POINTS).toBe(8_000)
  })

  it.each([
    [23_999, 'ok'],
    [24_000, 'near'],
    [30_000, 'near'],
    [30_001, 'over'],
    [0, 'ok'],
    [100_000, 'over'],
  ])('limit 300,00 EUR and spent %i cents is %s', (spent, expected) => {
    expect(budgetStatus(money(spent), money(30_000))).toBe(expected)
  })

  it('treats net refunds (negative spend) as ok', () => {
    expect(budgetStatus(money(-500), money(30_000))).toBe('ok')
  })

  it('handles a non-positive limit without dividing', () => {
    expect(budgetStatus(money(0), money(0))).toBe('ok')
    expect(budgetStatus(money(1), money(0))).toBe('over')
  })

  it('is exact on large amounts', () => {
    expect(budgetStatus(money(8_000_000_000_000), money(10_000_000_000_000))).toBe('near')
    expect(budgetStatus(money(7_999_999_999_999), money(10_000_000_000_000))).toBe('ok')
  })
})

describe('DEFAULT_CATEGORIES', () => {
  it('has unique stable ids and i18n name keys', () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.nameKey).toMatch(/^categories\./u)
      expect(category.name.length).toBeGreaterThan(0)
      expect(category.archived).toBe(false)
    }
  })

  it('includes the uncategorized sentinel', () => {
    expect(DEFAULT_CATEGORIES.some((c) => c.id === UNCATEGORIZED)).toBe(true)
  })

  it('is written in Spanish and covers expense, income and transfer kinds', () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name)
    expect(names).toContain('Supermercado')
    expect(names).toContain('Sin categoría')
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.kind))).toEqual(new Set(['expense', 'income', 'transfer']))
  })

  it('uses theme palette tokens for colors, not raw hex', () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.color).not.toMatch(/^#/u)
    }
  })
})
