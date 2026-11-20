import { describe, expect, it } from 'vitest'
import { IsoDate } from '@/domain/date/IsoDate'
import { hasAmbiguousDates, isAmbiguousDate, parseSpanishDate } from '@/domain/date/parseSpanishDate'
import { parseYearMonth } from '@/domain/date/YearMonth'
import { isoDate } from './builders'

describe('IsoDate', () => {
  it('parses valid dates', () => {
    expect(IsoDate.parse('2026-01-05')).toEqual({ ok: true, value: '2026-01-05' })
    expect(IsoDate.parse('2024-02-29').ok).toBe(true)
  })

  it.each([['2026-02-29'], ['2026-04-31'], ['2026-13-01'], ['2026-00-10'], ['2026-01-00'], ['2026-01-32']])(
    'rejects the impossible date %s',
    (input) => {
      const result = IsoDate.parse(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('date.invalidDate')
    },
  )

  it.each([[''], ['05/01/2026'], ['2026-1-5'], ['abc'], [' 2026-01-05'], ['2026-01-05T10:00']])(
    'rejects the malformed text %j',
    (input) => {
      const result = IsoDate.parse(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('date.invalidFormat')
    },
  )

  it('toYearMonth keeps year and month', () => {
    expect(IsoDate.toYearMonth(isoDate('2026-03-17'))).toBe('2026-03')
  })

  it('toEpochDay maps the epoch and known dates', () => {
    expect(IsoDate.toEpochDay(isoDate('1970-01-01'))).toBe(0)
    expect(IsoDate.toEpochDay(isoDate('1970-01-02'))).toBe(1)
    expect(IsoDate.toEpochDay(isoDate('1969-12-31'))).toBe(-1)
    expect(IsoDate.toEpochDay(isoDate('2000-03-01'))).toBe(11_017)
    expect(IsoDate.toEpochDay(isoDate('2026-01-05'))).toBe(20_458)
  })

  it('fromEpochDay inverts toEpochDay across leap years', () => {
    for (const text of ['1969-12-31', '1970-01-01', '2000-02-29', '2024-02-29', '2026-12-31', '2100-03-01']) {
      expect(IsoDate.fromEpochDay(IsoDate.toEpochDay(isoDate(text)))).toBe(text)
    }
  })

  it('consecutive epoch days are consecutive calendar days', () => {
    const start = IsoDate.toEpochDay(isoDate('2023-12-25'))
    for (let n = 0; n < 800; n += 1) {
      const a = IsoDate.fromEpochDay(start + n)
      const b = IsoDate.fromEpochDay(start + n + 1)
      expect(a < b).toBe(true)
    }
  })

  it('compare orders chronologically', () => {
    expect(IsoDate.compare(isoDate('2026-01-05'), isoDate('2026-01-06'))).toBe(-1)
    expect(IsoDate.compare(isoDate('2026-01-05'), isoDate('2026-01-05'))).toBe(0)
    expect(IsoDate.compare(isoDate('2027-01-01'), isoDate('2026-12-31'))).toBe(1)
  })
})

describe('parseYearMonth', () => {
  it('accepts valid months', () => {
    expect(parseYearMonth('2026-03')).toEqual({ ok: true, value: '2026-03' })
  })

  it.each([['2026-13'], ['2026-00'], ['2026-3'], ['abc'], ['']])('rejects %j', (input) => {
    expect(parseYearMonth(input).ok).toBe(false)
  })
})

describe('parseSpanishDate', () => {
  it.each([
    ['05/01/2026', '2026-01-05'],
    ['1/2/2026', '2026-02-01'],
    ['03/04/2025', '2025-04-03'],
    ['03-04-25', '2025-04-03'],
    ['03.04.2025', '2025-04-03'],
    ['2025-04-03', '2025-04-03'],
    ['2025/04/03', '2025-04-03'],
    ['  05/01/2026  ', '2026-01-05'],
    ['29/02/2024', '2024-02-29'],
    ['31/12/99', '1999-12-31'],
    ['01/01/00', '2000-01-01'],
    ['01/01/26', '2026-01-01'],
    ['01/01/27', '2027-01-01'],
    ['01/01/28', '1928-01-01'],
    ['01/01/69', '1969-01-01'],
    ['01/01/70', '1970-01-01'],
  ])('parses %j as %s (always dd/mm)', (input, expected) => {
    expect(parseSpanishDate(input)).toEqual({ ok: true, value: expected })
  })

  it('pivots two-digit years relative to the supplied reference year', () => {
    expect(parseSpanishDate('01/01/69', 2060)).toEqual({ ok: true, value: '1969-01-01' })
    expect(parseSpanishDate('01/01/61', 2060)).toEqual({ ok: true, value: '2061-01-01' })
    expect(parseSpanishDate('01/01/62', 2040)).toEqual({ ok: true, value: '1962-01-01' })
    expect(parseSpanishDate('01/01/2062', 2040)).toEqual({ ok: true, value: '2062-01-01' })
  })

  it.each([['03/04-2025'], ['03-04/25'], ['03.04/2025'], ['2025-04/03'], ['2025/04-03']])(
    'rejects mixed separators in %s',
    (input) => {
      const result = parseSpanishDate(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('date.invalidFormat')
    },
  )

  it.each([['29/02/2026'], ['31/04/2026'], ['31/02/2026'], ['00/01/2026'], ['2026/13/01'], ['01/13/2026']])(
    'rejects the impossible date %s',
    (input) => {
      const result = parseSpanishDate(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('date.invalidDate')
    },
  )

  it.each([[''], ['abc'], ['1,2,3'], ['05/01'], ['05/01/20260'], ['05/01/202'], ['5 de enero'], ['2026-01']])(
    'rejects the malformed text %j',
    (input) => {
      const result = parseSpanishDate(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('date.invalidFormat')
    },
  )

  it('never depends on the time zone', () => {
    const original = process.env.TZ
    try {
      for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Auckland']) {
        process.env.TZ = tz
        expect(parseSpanishDate('31/03/2026')).toEqual({ ok: true, value: '2026-03-31' })
        expect(parseSpanishDate('25/10/2026')).toEqual({ ok: true, value: '2026-10-25' })
      }
    } finally {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    }
  })
})

describe('date ambiguity', () => {
  it('flags dates where day and month could be swapped', () => {
    expect(isAmbiguousDate('03/04/2025')).toBe(true)
    expect(isAmbiguousDate('3-4-25')).toBe(true)
  })

  it('does not flag dates that are unambiguous', () => {
    expect(isAmbiguousDate('13/04/2025')).toBe(false)
    expect(isAmbiguousDate('04/13/2025')).toBe(false)
    expect(isAmbiguousDate('05/05/2025')).toBe(false)
    expect(isAmbiguousDate('2025-04-03')).toBe(false)
    expect(isAmbiguousDate('garbage')).toBe(false)
  })

  it('hasAmbiguousDates is true only when every valid date is ambiguous', () => {
    expect(hasAmbiguousDates(['03/04/2025', '05/06/2025'])).toBe(true)
    expect(hasAmbiguousDates(['03/04/2025', '25/06/2025'])).toBe(false)
    expect(hasAmbiguousDates(['03/04/2025', 'basura'])).toBe(true)
    expect(hasAmbiguousDates([])).toBe(false)
    expect(hasAmbiguousDates(['05/05/2025', '03/04/2025'])).toBe(true)
    expect(hasAmbiguousDates(['05/05/2025', '25/06/2025'])).toBe(false)
    expect(hasAmbiguousDates(['05/05/2025'])).toBe(false)
    expect(hasAmbiguousDates(['basura'])).toBe(false)
  })
})
