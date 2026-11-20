import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnRuleFromCorrectionUseCase } from '@/application/use-cases/LearnRuleFromCorrectionUseCase';
import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category';
import type { RuleId } from '@/domain/rule/Rule';
import type { RuleSuggestion } from '@/domain/rule/ruleSuggestion';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { TransactionId } from '@/domain/transaction/Transaction';
import { rule, tx } from '../../domain/builders';
import { createWorld, type World } from '../harness';

const LEISURE = 'cat-leisure' as CategoryId;
const GIFTS = 'cat-gifts' as CategoryId;
const NETFLIX = { rawDescription: 'NETFLIX.COM 1234', normalizedDescription: 'NETFLIX.COM 1234' };

let w: World;
let onDataChanged: ReturnType<typeof vi.fn<() => void>>;

function useCase(): LearnRuleFromCorrectionUseCase {
  return new LearnRuleFromCorrectionUseCase({
    transactions: w.transactions,
    rules: w.rules,
    categories: w.categories,
    clock: w.clock,
    ids: w.ids,
    onDataChanged,
  });
}

function put(id: string, overrides: Parameters<typeof tx>[0] = {}): void {
  w.state.transactions.set(id, tx({ id: id as TransactionId, dedupKey: `${id}#0` as DedupKey, ...overrides }));
}

function suggestion(overrides: Partial<RuleSuggestion> = {}): RuleSuggestion {
  return { pattern: 'NETFLIX.COM', operator: 'contains', categoryId: LEISURE, amountSign: 'any', ...overrides };
}

beforeEach(() => {
  w = createWorld();
  onDataChanged = vi.fn<() => void>();
});

describe('LearnRuleFromCorrectionUseCase.correct', () => {
  it('saves the manual correction and proposes a rule with the affected count', async () => {
    put('t0', NETFLIX);
    for (let i = 1; i <= 5; i += 1) put(`t${i}`, { rawDescription: `NETFLIX.COM ${i}000`, normalizedDescription: `NETFLIX.COM ${i}000` });
    put('other', { normalizedDescription: 'CAFE CENTRAL' });

    const result = await useCase().correct({ transactionId: 't0' as TransactionId, categoryId: LEISURE });

    expect(result).toEqual({ ok: true, value: { suggestion: { pattern: 'NETFLIX.COM', operator: 'contains', categoryId: LEISURE, amountSign: 'any' }, affectedCount: 5 } });
    expect(w.state.transactions.get('t0')).toMatchObject({ categoryId: LEISURE, categorySource: 'manual', ruleId: null, updatedAt: w.clock.now() });
    expect(w.state.rules.size).toBe(0);
    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  it('does not count manually categorized movements as affected', async () => {
    put('t0', NETFLIX);
    put('t1', { ...NETFLIX, categoryId: GIFTS, categorySource: 'manual' });
    put('t2', NETFLIX);

    const result = await useCase().correct({ transactionId: 't0' as TransactionId, categoryId: LEISURE });

    expect(result.ok && result.value.affectedCount).toBe(1);
  });

  it('proposes no rule when moving back to uncategorized', async () => {
    put('t0', { ...NETFLIX, categoryId: LEISURE, categorySource: 'manual' });

    const result = await useCase().correct({ transactionId: 't0' as TransactionId, categoryId: UNCATEGORIZED });

    expect(result).toEqual({ ok: true, value: { suggestion: null, affectedCount: 0 } });
    expect(w.state.transactions.get('t0')?.categoryId).toBe(UNCATEGORIZED);
  });

  it('fails with transaction.notFound and writes nothing', async () => {
    const result = await useCase().correct({ transactionId: 'ghost' as TransactionId, categoryId: LEISURE });

    expect(result).toEqual({ ok: false, error: { code: 'transaction.notFound' } });
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  it('fails with category.notFound and leaves the movement untouched', async () => {
    put('t0', NETFLIX);

    const result = await useCase().correct({ transactionId: 't0' as TransactionId, categoryId: 'ghost' as CategoryId });

    expect(result).toEqual({ ok: false, error: { code: 'category.notFound' } });
    expect(w.state.transactions.get('t0')?.categorySource).toBe('none');
  });

  it('works without onDataChanged', async () => {
    put('t0', NETFLIX);

    const result = await new LearnRuleFromCorrectionUseCase({ transactions: w.transactions, rules: w.rules, categories: w.categories, clock: w.clock, ids: w.ids }).correct({ transactionId: 't0' as TransactionId, categoryId: LEISURE });

    expect(result.ok).toBe(true);
  });
});

describe('LearnRuleFromCorrectionUseCase.accept', () => {
  it('creates a learned rule at the end of the priorities with a normalized pattern', async () => {
    await w.rules.save(rule({ id: 'r1' as RuleId, priority: 4 }));

    const result = await useCase().accept({ suggestion: suggestion({ pattern: ' netflix.com ' }), applyToExisting: false });

    expect(result).toEqual({ ok: true, value: { ruleId: 'id-1', recategorized: 0 } });
    expect(w.state.rules.get('id-1')).toMatchObject({ pattern: 'NETFLIX.COM', operator: 'contains', amountSign: 'any', accountId: null, categoryId: LEISURE, priority: 5, enabled: true, origin: 'learned', createdAt: w.clock.now() });
  });

  it('does not touch existing movements unless asked', async () => {
    put('t1', NETFLIX);

    await useCase().accept({ suggestion: suggestion(), applyToExisting: false });

    expect(w.state.transactions.get('t1')?.categorySource).toBe('none');
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  it('recategorizes matching movements but never manual ones', async () => {
    put('t1', NETFLIX);
    put('t2', NETFLIX);
    put('manual', { ...NETFLIX, categoryId: GIFTS, categorySource: 'manual' });
    put('other', { normalizedDescription: 'CAFE CENTRAL' });

    const result = await useCase().accept({ suggestion: suggestion(), applyToExisting: true });

    expect(result).toEqual({ ok: true, value: { ruleId: 'id-1', recategorized: 2 } });
    expect(w.state.transactions.get('t1')).toMatchObject({ categoryId: LEISURE, categorySource: 'rule', ruleId: 'id-1' });
    expect(w.state.transactions.get('manual')).toMatchObject({ categoryId: GIFTS, categorySource: 'manual' });
    expect(w.state.transactions.get('other')?.categorySource).toBe('none');
    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  it('does not steal movements already claimed by a higher-priority rule, nor reset unrelated ones', async () => {
    await w.rules.save(rule({ id: 'r1' as RuleId, pattern: 'NETFLIX', categoryId: GIFTS, priority: 1 }));
    put('claimed', { ...NETFLIX, categoryId: GIFTS, categorySource: 'rule', ruleId: 'r1' as RuleId });
    put('stale', { normalizedDescription: 'CAFE', categoryId: GIFTS, categorySource: 'rule', ruleId: 'gone' as RuleId });

    const result = await useCase().accept({ suggestion: suggestion(), applyToExisting: true });

    expect(result.ok && result.value.recategorized).toBe(0);
    expect(w.state.transactions.get('claimed')?.ruleId).toBe('r1');
    expect(w.state.transactions.get('stale')?.ruleId).toBe('gone');
  });

  it.each(['', ' ', 'A'])('rejects the pattern %j with rule.invalidPattern', async (pattern) => {
    const result = await useCase().accept({ suggestion: suggestion({ pattern }), applyToExisting: true });

    expect(result).toEqual({ ok: false, error: { code: 'rule.invalidPattern', details: { field: 'pattern' } } });
    expect(w.state.rules.size).toBe(0);
  });

  it('rejects a missing category without creating the rule', async () => {
    const result = await useCase().accept({ suggestion: suggestion({ categoryId: 'ghost' as CategoryId }), applyToExisting: false });

    expect(result).toEqual({ ok: false, error: { code: 'category.notFound' } });
    expect(w.state.rules.size).toBe(0);
  });
});

describe('LearnRuleFromCorrectionUseCase.accept cuando falla la recategorización (silent-failures ALTA-4)', () => {
  it('avisa al índice porque la regla ya se guardó', async () => {
    put('t1', NETFLIX)
    vi.spyOn(w.transactions, 'updateMany').mockRejectedValue(new Error('aborted'))

    await expect(useCase().accept({ suggestion: suggestion(), applyToExisting: true })).rejects.toThrow('aborted')

    expect(w.state.rules.size).toBe(1)
    expect(onDataChanged).toHaveBeenCalled()
  })
})
