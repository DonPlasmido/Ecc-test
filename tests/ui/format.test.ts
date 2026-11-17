import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatMonth, formatPercentFromBasisPoints } from '@/ui/i18n/format';

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
});
