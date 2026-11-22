import { describe, expect, it } from 'vitest';
import {
  formatBudgetPercent,
  formatDate,
  formatMoney,
  formatMonth,
  formatPercentFromBasisPoints,
  formatVariationPercent,
} from '@/ui/i18n/format';

/** Normaliza espacios duros de `Intl` para comparar. */
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('format', () => {
  it('formats euros with a visible sign except for zero (es)', () => {
    expect(plain(formatMoney(-4230, 'es'))).toBe('-42,30 €');
    // es-ES no agrupa los miles con 4 cifras (CLDR minimumGroupingDigits = 2)
    expect(plain(formatMoney(123456, 'es'))).toBe('+1234,56 €');
    expect(plain(formatMoney(1234567, 'es'))).toBe('+12.345,67 €');
    expect(plain(formatMoney(0, 'es'))).toBe('0,00 €');
  });

  it('formats euros in English with dot decimals', () => {
    expect(formatMoney(-4230, 'en')).toBe('-€42.30');
    expect(formatMoney(4230, 'en', false)).toBe('€42.30');
  });

  it('formats ISO dates in UTC without timezone shift', () => {
    expect(formatDate('2026-03-15', 'es')).toBe('15/03/2026');
    expect(formatDate('2026-01-01', 'en')).toBe('01/01/2026');
  });

  it('returns invalid dates untouched', () => {
    expect(formatDate('15/03/2026', 'es')).toBe('15/03/2026');
    expect(formatMonth('2026', 'es')).toBe('2026');
  });

  it('formats months and basis-point percentages', () => {
    expect(formatMonth('2026-03', 'en', 'long')).toBe('March 2026');
    expect(plain(formatPercentFromBasisPoints(8_000, 'es'))).toBe('80 %');
    expect(formatPercentFromBasisPoints(13_500, 'en')).toBe('135%');
  });

  it('never rounds a budget percentage across its status boundary', () => {
    const percent = (spent: number, limit: number, bp: number, status: 'ok' | 'near' | 'over') =>
      plain(formatBudgetPercent({ spentCents: spent, limitCents: limit, usedBasisPoints: bp, status }, 'es'));
    expect(percent(79_990, 100_013, 7_999, 'ok')).toBe('79 %');
    expect(percent(80_000, 100_000, 8_000, 'near')).toBe('80 %');
    expect(percent(80_000, 80_000, 10_000, 'near')).toBe('100 %');
    expect(percent(80_000, 79_992, 10_001, 'over')).toBe('101 %');
    expect(percent(80_000, 79_999, 10_000, 'over')).toBe('101 %');
    expect(percent(54_000, 40_000, 13_500, 'over')).toBe('135 %');
  });

  it('keeps one decimal for small variations', () => {
    expect(plain(formatVariationPercent(46, 'es'))).toBe('0,5 %');
    expect(plain(formatVariationPercent(888, 'es'))).toBe('8,9 %');
    expect(formatVariationPercent(888, 'en')).toBe('8.9%');
    expect(plain(formatVariationPercent(1_000, 'es'))).toBe('10 %');
    expect(plain(formatVariationPercent(9_700, 'es'))).toBe('97 %');
  });
});
