import { describe, expect, it } from 'vitest';
import {
  countActiveFilters,
  EMPTY_FILTERS,
  isValidIsoDate,
  parseEuros,
  parseFilterParams,
  toSearchParams,
  toTransactionFilter,
} from '@/ui/features/transactions/filterParams';

describe('filterParams', () => {
  it('round-trips every filter through the URL query', () => {
    const params = {
      q: 'mercadona',
      from: '2026-01-01',
      to: '2026-03-31',
      categoryIds: ['cat-groceries', 'cat-leisure'],
      accountIds: ['a1'],
      sign: 'expense',
      min: '10,5',
      max: '200',
      sort: 'amountAsc',
    } as const;

    expect(parseFilterParams(toSearchParams(params))).toEqual(params);
  });

  it('omits defaults so an unfiltered list has an empty query', () => {
    expect(toSearchParams(EMPTY_FILTERS).toString()).toBe('');
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it('ignores unknown sign and sort values', () => {
    const parsed = parseFilterParams(new URLSearchParams('tipo=both&orden=random&cat=,x,'));
    expect(parsed.sign).toBe('any');
    expect(parsed.sort).toBe('dateDesc');
    expect(parsed.categoryIds).toEqual(['x']);
  });

  it('parses euros with comma or dot into cents and rejects malformed amounts', () => {
    expect(parseEuros('12,5')).toBe(1250);
    expect(parseEuros(' 0.99 ')).toBe(99);
    expect(parseEuros('')).toBeNull();
    expect(parseEuros('12,345')).toBeUndefined();
    expect(parseEuros('-3')).toBeUndefined();
  });

  it('validates calendar dates', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('28/02/2026')).toBe(false);
  });

  it('builds the use-case filter dropping invalid or empty values', () => {
    const filter = toTransactionFilter({
      ...EMPTY_FILTERS,
      q: '  café ',
      from: 'nope',
      to: '2026-03-31',
      sign: 'income',
      min: 'abc',
      max: '20',
    });

    expect(filter).toEqual({ text: 'café', to: '2026-03-31', sign: 'income', maxCents: 2000 });
  });
});
