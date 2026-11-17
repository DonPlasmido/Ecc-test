import { describe, expect, it } from 'vitest'
import { Money } from '@/domain/money/Money'
import { parseSpanishAmount } from '@/domain/money/parseSpanishAmount'
import { money } from './builders'

describe('Money', () => {
  it('ofCents accepts integers including negatives and zero', () => {
    expect(Money.ofCents(-4510)).toEqual({ ok: true, value: { cents: -4510 } })
    expect(Money.ofCents(0)).toEqual({ ok: true, value: { cents: 0 } })
  })

  it('ofCents normalizes negative zero', () => {
    const result = Money.ofCents(-0)
    expect(result.ok && Object.is(result.value.cents, 0)).toBe(true)
  })

  it.each([[1.5], [Number.NaN], [Number.POSITIVE_INFINITY]])('ofCents rejects non-integer %s', (value) => {
    expect(Money.ofCents(value)).toEqual({
      ok: false,
      error: { code: 'money.notInteger', details: { value: String(value) } },
    })
  })

  it('ofCents rejects values beyond safe integer', () => {
    const result = Money.ofCents(2 ** 53)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('money.outOfRange')
  })

  it('zero, add, subtract, negate', () => {
    expect(Money.zero()).toEqual(money(0))
    expect(Money.add(money(10), money(-3))).toEqual(money(7))
    expect(Money.subtract(money(10), money(15))).toEqual(money(-5))
    expect(Money.negate(money(10))).toEqual(money(-10))
    expect(Object.is(Money.negate(money(0)).cents, 0)).toBe(true)
  })

  it('does not mutate its operands', () => {
    const a = money(5)
    Money.add(a, money(1))
    expect(a).toEqual(money(5))
  })

  it('sum of empty list is zero and sums exactly', () => {
    expect(Money.sum([])).toEqual(money(0))
    expect(Money.sum([money(10), money(20), money(-5)])).toEqual(money(25))
  })

  it('sums 100k values without rounding error', () => {
    const values = Array.from({ length: 100_000 }, () => money(1))
    expect(Money.sum(values)).toEqual(money(100_000))
    const tenths = Array.from({ length: 10 }, () => money(10))
    expect(Money.sum(tenths)).toEqual(money(100))
  })

  it('isExpense is true only for negatives', () => {
    expect(Money.isExpense(money(-1))).toBe(true)
    expect(Money.isExpense(money(0))).toBe(false)
    expect(Money.isExpense(money(1))).toBe(false)
  })

  it('compare returns -1, 0, 1', () => {
    expect(Money.compare(money(1), money(2))).toBe(-1)
    expect(Money.compare(money(2), money(2))).toBe(0)
    expect(Money.compare(money(3), money(2))).toBe(1)
  })

  it('ratioBasisPoints returns integer basis points (truncated)', () => {
    expect(Money.ratioBasisPoints(money(24_000), money(30_000))).toBe(8_000)
    expect(Money.ratioBasisPoints(money(1), money(3))).toBe(3_333)
    expect(Money.ratioBasisPoints(money(30_001), money(30_000))).toBe(10_000)
    expect(Money.ratioBasisPoints(money(60_000), money(30_000))).toBe(20_000)
  })

  it('ratioBasisPoints returns 0 when whole is zero', () => {
    expect(Money.ratioBasisPoints(money(100), money(0))).toBe(0)
  })
})

describe('parseSpanishAmount', () => {
  it.each([
    ['1.234,56', 123_456],
    ['-12,50', -1_250],
    ['1234,56-', -123_456],
    ['(1.234,56)', -123_456],
    ['12.50', 1_250],
    ['1.234,56 €', 123_456],
    ['€ 1.234,56', 123_456],
    ['1.234,56 EUR', 123_456],
    ['  -45,10  ', -4_510],
    [' -45,10 €', -4_510],
    ['1.234.567,89', 123_456_789],
    ['-0,01', -1],
    ['+12,00', 1_200],
    ['12', 1_200],
    ['12,30-', -1_230],
    ['0,00', 0],
    ['-0,00', 0],
    ['12,5', 1_250],
    ['1.234', 123_400],
    ['1234', 123_400],
    ['- 12,50', -1_250],
    ['−12,50', -1_250],
    ['+12,30', 1_230],
    ['12,30+', 1_230],
    ['0,5', 50],
    ['999999999999,99', 99_999_999_999_999],
  ])('parses %j as %i cents', (input, cents) => {
    const result = parseSpanishAmount(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.cents).toBe(cents)
      expect(Object.is(result.value.cents, -0)).toBe(false)
    }
  })

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['1,2,3'],
    ['1,234.56'],
    ['12,345'],
    ['12,'],
    ['1.23.456'],
    ['--12,50'],
    ['-12,50-'],
    ['(12,50'],
    ['12,50)'],
    ['-(12,50)'],
    ['12.5000'],
    ['1 2,50'],
    ['12,50 dólares'],
    ['€'],
    ['-'],
    ['NaN'],
    ['1e5'],
  ])('rejects %j as invalid amount', (input) => {
    const result = parseSpanishAmount(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('money.invalidAmount')
  })

  it('reports the offending value in details (trimmed)', () => {
    const result = parseSpanishAmount('x'.repeat(200))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.details?.value?.length).toBeLessThanOrEqual(50)
  })

  it('rejects amounts beyond the safe integer range', () => {
    const result = parseSpanishAmount('99999999999999999999,99')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('money.outOfRange')
  })
})
