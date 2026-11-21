import { describe, expect, it } from 'vitest'
import { isAmbiguousAmount, parseSpanishAmount } from '@/domain/money/parseSpanishAmount'

function cents(text: string): number | null {
  const result = parseSpanishAmount(text)
  return result.ok ? result.value.cents : null
}

describe('parseSpanishAmount: Anglo-Saxon thousands with two separators', () => {
  it.each([
    ['1,850.00', 185000],
    ['-1,234.56', -123456],
    ['2,500.00', 250000],
    ['1,234,567.89', 123456789],
    ['(1,200.5)', -120050],
    ['1,850.00 EUR', 185000],
  ])('%s is unambiguous: %s cents', (text, expected) => {
    expect(cents(text)).toBe(expected)
    expect(isAmbiguousAmount(text)).toBe(false)
  })

  it.each(['1,85.00', '1,2345.00', '12,34,567.00', '1,850.000', '1.850,00.5', ',850.00'])('rejects malformed «%s»', (text) => {
    expect(cents(text)).toBeNull()
  })

  it('keeps single-separator readings unchanged', () => {
    expect(cents('1.234')).toBe(123400)
    expect(isAmbiguousAmount('1.234')).toBe(true)
    expect(cents('1,850')).toBeNull()
    expect(cents('1.234,56')).toBe(123456)
    expect(cents('-75.00')).toBe(-7500)
  })
})
