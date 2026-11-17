import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategorizeTransactionsUseCase } from '@/application/use-cases/CategorizeTransactionsUseCase';
import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category';
import type { RuleId } from '@/domain/rule/Rule';
import type { TransactionId } from '@/domain/transaction/Transaction';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import { rule, tx } from '../../domain/builders';
import { createWorld, type World } from '../harness';

const GROCERIES = 'cat-groceries' as CategoryId;
const GIFTS = 'cat-gifts' as CategoryId;

let w: World;
let onDataChanged: ReturnType<typeof vi.fn<() => void>>;

function useCase(): CategorizeTransactionsUseCase {
  return new CategorizeTransactionsUseCase({ transactions: w.transactions, rules: w.rules, clock: w.clock, onDataChanged });
}

function put(id: string, overrides: Parameters<typeof tx>[0] = {}): void {
  const t = tx({ id: id as TransactionId, dedupKey: `${id}#0` as DedupKey, ...overrides });
  w.state.transactions.set(id, t);
}

const merca = { rawDescription: 'COMPRA MERCADONA', normalizedDescription: 'COMPRA MERCADONA' };

beforeEach(async () => {
  w = createWorld();
  onDataChanged = vi.fn<() => void>();
  await w.rules.save(rule({ id: 'r1' as RuleId, pattern: 'MERCADONA', categoryId: GROCERIES }));
});

describe('CategorizeTransactionsUseCase', () => {
  it('categorizes uncategorized movements and leaves the rest alone', async () => {
    put('a', merca);
    put('b', { normalizedDescription: 'CAFE CENTRAL' });
    put('c', { ...merca, categoryId: GIFTS, categorySource: 'manual' });

    const result = await useCase().execute({ scope: 'uncategorized' });

    expect(result).toEqual({ changed: 1, sampleIds: ['a'] });
    expect(w.state.transactions.get('a')).toMatchObject({ categoryId: GROCERIES, categorySource: 'rule', ruleId: 'r1', updatedAt: w.clock.now() });
    expect(w.state.transactions.get('b')?.categorySource).toBe('none');
    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  it('never overwrites a manual category, even with scope all', async () => {
    put('c', { ...merca, categoryId: GIFTS, categorySource: 'manual' });

    const result = await useCase().execute({ scope: 'all' });

    expect(result.changed).toBe(0);
    expect(w.state.transactions.get('c')).toMatchObject({ categoryId: GIFTS, categorySource: 'manual' });
  });

  it('with scope all reapplies changed rules and resets movements whose rule no longer matches', async () => {
    put('a', { ...merca, categoryId: GIFTS, categorySource: 'rule', ruleId: 'r1' as RuleId });
    put('stale', { normalizedDescription: 'CAFE', categoryId: GROCERIES, categorySource: 'rule', ruleId: 'gone' as RuleId });

    const result = await useCase().execute({ scope: 'all' });

    expect(result.changed).toBe(2);
    expect(w.state.transactions.get('a')?.categoryId).toBe(GROCERIES);
    expect(w.state.transactions.get('stale')).toMatchObject({ categoryId: UNCATEGORIZED, categorySource: 'none', ruleId: null });
  });

  it('does not count movements that already have the right category', async () => {
    put('a', { ...merca, categoryId: GROCERIES, categorySource: 'rule', ruleId: 'r1' as RuleId });

    const result = await useCase().execute({ scope: 'all' });

    expect(result).toEqual({ changed: 0, sampleIds: [] });
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  it('limits scope to the given ids and skips unknown ones', async () => {
    put('a', merca);
    put('b', merca);

    const result = await useCase().execute({ scope: { ids: ['a' as TransactionId, 'ghost' as TransactionId] } });

    expect(result).toEqual({ changed: 1, sampleIds: ['a'] });
    expect(w.state.transactions.get('b')?.categorySource).toBe('none');
  });

  it('counts without writing on dry runs', async () => {
    put('a', merca);
    const before = structuredClone(w.state);

    const result = await useCase().execute({ scope: 'all', dryRun: true });

    expect(result.changed).toBe(1);
    expect(w.state).toEqual(before);
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  it('returns at most 10 sample ids', async () => {
    for (let i = 0; i < 15; i += 1) put(`t${String(i).padStart(2, '0')}`, merca);

    const result = await useCase().execute({ scope: 'uncategorized' });

    expect(result.changed).toBe(15);
    expect(result.sampleIds).toHaveLength(10);
  });

  it('ignores disabled rules and works without onDataChanged', async () => {
    await w.rules.save(rule({ id: 'r1' as RuleId, pattern: 'MERCADONA', categoryId: GROCERIES, enabled: false }));
    put('a', merca);

    const result = await new CategorizeTransactionsUseCase({ transactions: w.transactions, rules: w.rules, clock: w.clock }).execute({ scope: 'all' });

    expect(result.changed).toBe(0);
  });
});
