import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AccountId } from '@/domain/account/Account';
import type { BudgetId } from '@/domain/budget/Budget';
import type { CategoryId } from '@/domain/category/Category';
import type { Cents } from '@/domain/money/Money';
import type { RuleId } from '@/domain/rule/Rule';
import { makeAccount, makeBudget, makeCategory, makeProfile, makeRule } from '../fixtures';
import type { World, WorldFactory } from './worlds';

export function catalogRepositoriesContract(label: string, create: WorldFactory): void {
  describe(`catalog repositories contract (${label})`, () => {
    let world: World;
    beforeEach(async () => {
      world = await create();
    });
    afterEach(() => world.dispose());

    describe('AccountRepository', () => {
      it('is empty at the start', async () => {
        expect(await world.accounts.list()).toEqual([]);
      });

      it('saves, lists ordered by id and replaces by id', async () => {
        await world.accounts.save(makeAccount('b'));
        await world.accounts.save(makeAccount('a'));
        await world.accounts.save(makeAccount('b', { name: 'Renombrada', ibanLast4: null }));
        expect(await world.accounts.list()).toEqual([makeAccount('a'), makeAccount('b', { name: 'Renombrada', ibanLast4: null })]);
      });

      it('deletes by id and ignores unknown ids', async () => {
        await world.accounts.save(makeAccount('a'));
        await world.accounts.delete('ghost' as AccountId);
        await world.accounts.delete('a' as AccountId);
        expect(await world.accounts.list()).toEqual([]);
      });

      it('returns copies, not shared references', async () => {
        await world.accounts.save(makeAccount('a'));
        const [first] = await world.accounts.list();
        (first as { name: string }).name = 'mutated';
        expect((await world.accounts.list())[0]?.name).toBe('Cuenta a');
      });
    });

    describe('CategoryRepository', () => {
      it('saves, replaces, lists and deletes', async () => {
        await world.categories.save(makeCategory('c2'));
        await world.categories.save(makeCategory('c1', { nameKey: 'cat.food' }));
        await world.categories.save(makeCategory('c2', { archived: true }));
        expect(await world.categories.list()).toEqual([makeCategory('c1', { nameKey: 'cat.food' }), makeCategory('c2', { archived: true })]);
        await world.categories.delete('c1' as CategoryId);
        expect((await world.categories.list()).map((c) => c.id)).toEqual(['c2']);
      });
    });

    describe('RuleRepository', () => {
      it('lists by priority, then id', async () => {
        await world.rules.save(makeRule('r-b', 2));
        await world.rules.save(makeRule('r-z', 1));
        await world.rules.save(makeRule('r-a', 2));
        expect((await world.rules.list()).map((r) => r.id)).toEqual(['r-z', 'r-a', 'r-b']);
      });

      it('saveMany stores all rules and reorders by replacing', async () => {
        await world.rules.saveMany([makeRule('r1', 1), makeRule('r2', 2)]);
        await world.rules.saveMany([makeRule('r1', 5), makeRule('r2', 3), makeRule('r3', 4, { accountId: 'acc-1' as AccountId })]);
        const list = await world.rules.list();
        expect(list.map((r) => [r.id, r.priority])).toEqual([['r2', 3], ['r3', 4], ['r1', 5]]);
        expect(list[1]?.accountId).toBe('acc-1');
      });

      it('saveMany with no rules is a no-op', async () => {
        await world.rules.saveMany([]);
        expect(await world.rules.list()).toEqual([]);
      });

      it('deletes by id', async () => {
        await world.rules.save(makeRule('r1'));
        await world.rules.delete('r1' as RuleId);
        await world.rules.delete('r1' as RuleId);
        expect(await world.rules.list()).toEqual([]);
      });
    });

    describe('BudgetRepository', () => {
      it('round-trips the monthly limit in cents', async () => {
        const budget = makeBudget('b1', 'c1', { monthlyLimit: { cents: 123_456 as Cents }, endMonth: '2024-12' as never });
        await world.budgets.save(budget);
        expect(await world.budgets.list()).toEqual([budget]);
      });

      it('replaces by id and deletes', async () => {
        await world.budgets.save(makeBudget('b1'));
        await world.budgets.save(makeBudget('b1', 'c9'));
        expect((await world.budgets.list()).map((b) => b.categoryId)).toEqual(['c9']);
        await world.budgets.delete('b1' as BudgetId);
        expect(await world.budgets.list()).toEqual([]);
      });
    });

    describe('ImportProfileRepository', () => {
      it('finds nothing for an unknown signature', async () => {
        expect(await world.importProfiles.find('nope')).toBeNull();
      });

      it('saves and finds by header signature, replacing on repeat', async () => {
        await world.importProfiles.save(makeProfile('sig'));
        expect(await world.importProfiles.find('sig')).toEqual(makeProfile('sig'));
        await world.importProfiles.save(makeProfile('sig', { accountId: null }));
        expect((await world.importProfiles.find('sig'))?.accountId).toBeNull();
      });

      it('keeps profiles separate per signature, even with special characters', async () => {
        await world.importProfiles.save(makeProfile('fecha;concepto;importe'));
        await world.importProfiles.save(makeProfile('año|💶'));
        expect(await world.importProfiles.find('año|💶')).not.toBeNull();
        expect(await world.importProfiles.find('fecha')).toBeNull();
      });
    });
  });
}
