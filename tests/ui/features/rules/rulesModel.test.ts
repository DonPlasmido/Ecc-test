import { describe, expect, it } from 'vitest';
import { UNCATEGORIZED, type Category, type CategoryId } from '@/domain/category/Category';
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories';
import type { RuleId } from '@/domain/rule/Rule';
import { isFixedCategory, ruleTargetCategories, suggestColor, toColorToken } from '@/ui/features/rules/categoryModel';
import { countMatches, criteriaKey } from '@/ui/features/rules/ruleMatches';
import { moveRule, upsertById } from '@/ui/features/rules/rulesModel';
import { cat, createRulesContainer, rule } from './seedRules';

const RULES = [rule('a', 'AAA', cat('groceries'), 1), rule('b', 'BBB', cat('leisure'), 2), rule('c', 'CCC', cat('travel'), 3)];

describe('moveRule', () => {
  it('swaps a rule with its upper neighbour and renumbers priorities 1..n', () => {
    // Act
    const moved = moveRule(RULES, 'b' as RuleId, 'up');

    // Assert
    expect(moved?.map((r) => [r.id, r.priority])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 3],
    ]);
    expect(RULES.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns null at the edges or for an unknown rule', () => {
    expect(moveRule(RULES, 'a' as RuleId, 'up')).toBeNull();
    expect(moveRule(RULES, 'c' as RuleId, 'down')).toBeNull();
    expect(moveRule(RULES, 'zzz' as RuleId, 'down')).toBeNull();
  });
});

describe('upsertById', () => {
  it('replaces an existing item and appends a new one without mutating the input', () => {
    const items = [{ id: '1', v: 'a' }, { id: '2', v: 'b' }] as const;

    expect(upsertById(items, { id: '2', v: 'x' })).toEqual([{ id: '1', v: 'a' }, { id: '2', v: 'x' }]);
    expect(upsertById(items, { id: '3', v: 'c' })).toHaveLength(3);
    expect(items).toHaveLength(2);
  });
});

describe('categoryModel', () => {
  it('maps stored colour tokens onto the 8-tone palette, grey otherwise', () => {
    expect(toColorToken('chart-11')).toBe('cat-3');
    expect(toColorToken('income-1')).toBe('cat-3');
    expect(toColorToken('cat-8')).toBe('cat-8');
    expect(toColorToken('neutral')).toBe('neutral');
  });

  it('never offers «Sin categoría» or archived categories as rule targets, except the current one', () => {
    const archived: Category = { ...(DEFAULT_CATEGORIES[1] as Category), archived: true };
    const categories = [DEFAULT_CATEGORIES[0] as Category, archived, DEFAULT_CATEGORIES[2] as Category];

    expect(ruleTargetCategories(categories, null).map((c) => c.id)).toEqual([cat('restaurants')]);
    expect(ruleTargetCategories(categories, archived.id).map((c) => c.id)).toEqual([archived.id, cat('restaurants')]);
    expect(isFixedCategory(UNCATEGORIZED)).toBe(true);
    expect(isFixedCategory('cat-x' as CategoryId)).toBe(false);
  });

  it('suggests the least used palette colour for a new category', () => {
    expect(suggestColor([])).toBe('cat-1');
    const used = (['cat-1', 'cat-2'] as const).map((color, i) => ({ ...(DEFAULT_CATEGORIES[1] as Category), id: `c${i}` as CategoryId, color }));
    expect(suggestColor(used)).toBe('cat-3');
  });
});

describe('countMatches', () => {
  it('counts whole-word matches only (MERCADONA, not MERCADO) and returns samples', async () => {
    // Arrange
    const { queryTransactions } = await createRulesContainer();
    const criteria = { pattern: 'mercadona', operator: 'contains', amountSign: 'any', accountId: null } as const;

    // Act
    const summary = await countMatches(queryTransactions, criteria, 1);

    // Assert
    expect(summary.count).toBe(2);
    expect(summary.samples).toHaveLength(1);
  });

  it('honours the operator and the amount sign', async () => {
    const { queryTransactions } = await createRulesContainer();
    const base = { accountId: null } as const;

    expect((await countMatches(queryTransactions, { ...base, pattern: 'central', operator: 'startsWith', amountSign: 'any' })).count).toBe(0);
    expect((await countMatches(queryTransactions, { ...base, pattern: 'nomina acme sl', operator: 'equals', amountSign: 'any' })).count).toBe(1);
    expect((await countMatches(queryTransactions, { ...base, pattern: 'nomina', operator: 'contains', amountSign: 'expense' })).count).toBe(0);
  });

  it('returns zero without querying for patterns shorter than 2 characters', async () => {
    const { queryTransactions } = await createRulesContainer();

    const summary = await countMatches(queryTransactions, { pattern: ' m ', operator: 'contains', amountSign: 'any', accountId: null });

    expect(summary).toEqual({ count: 0, samples: [] });
  });

  it('builds the same key for equal criteria', () => {
    expect(criteriaKey(RULES[0]!)).toBe(criteriaKey(rule('other', 'AAA', cat('travel'), 9)));
    expect(criteriaKey(RULES[0]!)).not.toBe(criteriaKey(RULES[1]!));
  });
});
