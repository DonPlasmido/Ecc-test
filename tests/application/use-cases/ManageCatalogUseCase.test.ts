import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveBudgetInput, SaveRuleInput } from '@/application/ports/inbound/ManageCatalog';
import { ManageCatalogUseCase } from '@/application/use-cases/ManageCatalogUseCase';
import type { AccountId } from '@/domain/account/Account';
import type { Budget, BudgetId } from '@/domain/budget/Budget';
import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { RuleId } from '@/domain/rule/Rule';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { TransactionId } from '@/domain/transaction/Transaction';
import { ACCOUNT, money, rule, tx } from '../../domain/builders';
import { createWorld, type World } from '../harness';

const FOOD = 'cat-groceries' as CategoryId;
const FUN = 'cat-leisure' as CategoryId;
const ym = (s: string): YearMonth => s as YearMonth;

let w: World;
let onDataChanged: ReturnType<typeof vi.fn<() => void>>;

function catalog(): ManageCatalogUseCase {
  return new ManageCatalogUseCase({
    accounts: w.accounts,
    categories: w.categories,
    rules: w.rules,
    budgets: w.budgets,
    transactions: w.transactions,
    clock: w.clock,
    ids: w.ids,
    onDataChanged,
  });
}

const ruleInput = (o: Partial<SaveRuleInput> = {}): SaveRuleInput => ({ pattern: 'mercadona', operator: 'contains', amountSign: 'any', accountId: null, categoryId: FOOD, enabled: true, ...o });
const budgetInput = (o: Partial<SaveBudgetInput> = {}): SaveBudgetInput => ({ categoryId: FOOD, monthlyLimit: money(10_000), startMonth: ym('2026-01'), endMonth: null, ...o });

beforeEach(() => {
  w = createWorld();
  onDataChanged = vi.fn<() => void>();
});

describe('accounts', () => {
  it('creates an account with generated id, EUR and the clock time', async () => {
    const result = await catalog().saveAccount({ name: '  Ahorro ', ibanLast4: '9876' });

    expect(result).toEqual({ ok: true, value: { id: 'id-1', name: 'Ahorro', ibanLast4: '9876', currency: 'EUR', createdAt: w.clock.now() } });
    expect(await catalog().listAccounts()).toHaveLength(2);
    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  it('edits keeping createdAt and currency', async () => {
    const result = await catalog().saveAccount({ id: ACCOUNT, name: 'Nómina', ibanLast4: null });

    expect(result).toMatchObject({ ok: true, value: { id: ACCOUNT, name: 'Nómina', ibanLast4: null, createdAt: '2026-01-01T00:00:00.000Z' } });
  });

  it.each([['', null], ['   ', null], ['Ok', '12'], ['Ok', '12345'], ['Ok', 'abcd']])('rejects name %j / iban %j', async (name, iban) => {
    const result = await catalog().saveAccount({ name, ibanLast4: iban });

    expect(result.ok === false && result.error.code).toBe('account.invalidName');
    expect(w.state.accounts.size).toBe(1);
  });

  it('fails to edit an unknown account', async () => {
    const result = await catalog().saveAccount({ id: 'ghost' as AccountId, name: 'X', ibanLast4: null });

    expect(result).toEqual({ ok: false, error: { code: 'account.notFound' } });
  });

  it('refuses to delete an account with movements and deletes an empty one', async () => {
    w.state.transactions.set('t', tx());
    const blocked = await catalog().deleteAccount(ACCOUNT);
    w.state.transactions.clear();
    const missing = await catalog().deleteAccount('ghost' as AccountId);
    const deleted = await catalog().deleteAccount(ACCOUNT);

    expect(blocked).toEqual({ ok: false, error: { code: 'account.inUse' } });
    expect(missing).toEqual({ ok: false, error: { code: 'account.notFound' } });
    expect(deleted).toEqual({ ok: true, value: undefined });
    expect(w.state.accounts.size).toBe(0);
  });
});

describe('categories', () => {
  it('creates a category without nameKey', async () => {
    const result = await catalog().saveCategory({ name: ' Mascotas ', kind: 'expense', color: 'chart-1', archived: false });

    expect(result).toEqual({ ok: true, value: { id: 'id-1', name: 'Mascotas', nameKey: null, kind: 'expense', color: 'chart-1', archived: false } });
  });

  it('keeps nameKey when the name is unchanged (archiving) and drops it when renamed', async () => {
    const original = w.state.categories.get(FOOD);
    if (!original) throw new Error('seed');

    const archived = await catalog().saveCategory({ id: FOOD, name: original.name, kind: original.kind, color: original.color, archived: true });
    const renamed = await catalog().saveCategory({ id: FOOD, name: 'Comida', kind: original.kind, color: original.color, archived: true });

    expect(archived).toMatchObject({ ok: true, value: { nameKey: original.nameKey, archived: true } });
    expect(renamed).toMatchObject({ ok: true, value: { nameKey: null, name: 'Comida' } });
  });

  it('rejects empty names and unknown ids', async () => {
    const empty = await catalog().saveCategory({ name: ' ', kind: 'expense', color: 'x', archived: false });
    const unknown = await catalog().saveCategory({ id: 'ghost' as CategoryId, name: 'X', kind: 'expense', color: 'x', archived: false });

    expect(empty.ok === false && empty.error.code).toBe('category.invalidName');
    expect(unknown.ok === false && unknown.error.code).toBe('category.notFound');
  });

  it.each(['movement', 'rule', 'budget'])('refuses to delete a category used by a %s', async (user) => {
    if (user === 'movement') w.state.transactions.set('t', tx({ categoryId: FUN }));
    if (user === 'rule') await w.rules.save(rule({ categoryId: FUN }));
    if (user === 'budget') await w.budgets.save({ id: 'b' as BudgetId, categoryId: FUN, monthlyLimit: money(1), startMonth: ym('2026-01'), endMonth: null });

    const result = await catalog().deleteCategory(FUN);

    expect(result).toEqual({ ok: false, error: { code: 'category.inUse' } });
    expect(w.state.categories.has(FUN)).toBe(true);
  });

  it('never deletes the uncategorized sentinel, deletes unused ones and reports unknown ids', async () => {
    const sentinel = await catalog().deleteCategory(UNCATEGORIZED);
    const deleted = await catalog().deleteCategory(FUN);
    const missing = await catalog().deleteCategory('ghost' as CategoryId);

    expect(sentinel).toEqual({ ok: false, error: { code: 'category.inUse' } });
    expect(deleted.ok).toBe(true);
    expect(missing).toEqual({ ok: false, error: { code: 'category.notFound' } });
  });
});

describe('rules', () => {
  it('creates a manual rule with normalized pattern at the end of the priorities', async () => {
    await w.rules.save(rule({ id: 'r0' as RuleId, priority: 7 }));

    const result = await catalog().saveRule(ruleInput({ pattern: ' café  central ' }));

    expect(result).toMatchObject({ ok: true, value: { id: 'id-1', pattern: 'CAFE CENTRAL', priority: 8, origin: 'manual', createdAt: w.clock.now() } });
  });

  it('edits keeping priority, origin and createdAt', async () => {
    await w.rules.save(rule({ id: 'r1' as RuleId, priority: 3, origin: 'learned', createdAt: '2025-05-05T00:00:00.000Z' }));

    const result = await catalog().saveRule(ruleInput({ id: 'r1' as RuleId, enabled: false, categoryId: FUN }));

    expect(result).toMatchObject({ ok: true, value: { id: 'r1', priority: 3, origin: 'learned', createdAt: '2025-05-05T00:00:00.000Z', enabled: false, categoryId: FUN } });
  });

  it.each(['', ' ', 'A'])('rejects pattern %j', async (pattern) => {
    const result = await catalog().saveRule(ruleInput({ pattern }));

    expect(result.ok === false && result.error.code).toBe('rule.invalidPattern');
  });

  it('rejects unknown category, unknown account and unknown rule id', async () => {
    const category = await catalog().saveRule(ruleInput({ categoryId: 'ghost' as CategoryId }));
    const account = await catalog().saveRule(ruleInput({ accountId: 'ghost' as AccountId }));
    const unknown = await catalog().saveRule(ruleInput({ id: 'ghost' as RuleId }));
    const scoped = await catalog().saveRule(ruleInput({ accountId: ACCOUNT }));

    expect(category.ok === false && category.error.code).toBe('category.notFound');
    expect(account.ok === false && account.error.code).toBe('account.notFound');
    expect(unknown.ok === false && unknown.error.code).toBe('rule.notFound');
    expect(scoped.ok).toBe(true);
  });

  it('lists rules by priority and deletes them', async () => {
    await w.rules.save(rule({ id: 'b' as RuleId, priority: 2 }));
    await w.rules.save(rule({ id: 'a' as RuleId, priority: 1 }));

    const listed = await catalog().listRules();
    const deleted = await catalog().deleteRule('a' as RuleId);
    const missing = await catalog().deleteRule('ghost' as RuleId);

    expect(listed.map((r) => r.id)).toEqual(['a', 'b']);
    expect(deleted.ok).toBe(true);
    expect(missing).toEqual({ ok: false, error: { code: 'rule.notFound' } });
  });

  it('reorders priorities following the given order', async () => {
    await w.rules.save(rule({ id: 'a' as RuleId, priority: 1 }));
    await w.rules.save(rule({ id: 'b' as RuleId, priority: 2 }));
    await w.rules.save(rule({ id: 'c' as RuleId, priority: 3 }));

    const result = await catalog().reorderRules(['c' as RuleId, 'a' as RuleId, 'b' as RuleId]);

    expect(result.ok && result.value.map((r) => [r.id, r.priority])).toEqual([['c', 1], ['a', 2], ['b', 3]]);
    expect((await w.rules.list()).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it.each([['incomplete', ['a']], ['duplicated', ['a', 'a']], ['unknown', ['a', 'ghost']], ['too many', ['a', 'b', 'c']]])('rejects a %s order without writing', async (_name, order) => {
    await w.rules.save(rule({ id: 'a' as RuleId, priority: 1 }));
    await w.rules.save(rule({ id: 'b' as RuleId, priority: 2 }));

    const result = await catalog().reorderRules(order as RuleId[]);

    expect(result).toEqual({ ok: false, error: { code: 'rule.notFound' } });
    expect((await w.rules.list()).map((r) => r.priority)).toEqual([1, 2]);
  });
});

describe('budgets', () => {
  it('creates a budget with generated id', async () => {
    const result = await catalog().saveBudget(budgetInput());

    expect(result).toEqual({ ok: true, value: { id: 'id-1', categoryId: FOOD, monthlyLimit: money(10_000), startMonth: '2026-01', endMonth: null } });
    expect(await catalog().listBudgets()).toHaveLength(1);
  });

  it.each([0, -5])('rejects a limit of %d cents', async (cents) => {
    const result = await catalog().saveBudget(budgetInput({ monthlyLimit: money(cents) }));

    expect(result.ok === false && result.error.code).toBe('budget.invalidLimit');
  });

  it('rejects an end month before the start month but accepts equal months', async () => {
    const bad = await catalog().saveBudget(budgetInput({ endMonth: ym('2025-12') }));
    const same = await catalog().saveBudget(budgetInput({ endMonth: ym('2026-01') }));

    expect(bad.ok === false && bad.error.code).toBe('budget.invalidRange');
    expect(same.ok).toBe(true);
  });

  it('rejects an unknown category and an unknown budget id', async () => {
    const category = await catalog().saveBudget(budgetInput({ categoryId: 'ghost' as CategoryId }));
    const unknown = await catalog().saveBudget(budgetInput({ id: 'ghost' as BudgetId }));

    expect(category.ok === false && category.error.code).toBe('category.notFound');
    expect(unknown.ok === false && unknown.error.code).toBe('budget.notFound');
  });

  it('allows only one active budget per category (overlapping ranges)', async () => {
    const existing: Budget = { id: 'old' as BudgetId, categoryId: FOOD, monthlyLimit: money(1), startMonth: ym('2026-01'), endMonth: ym('2026-06') };
    await w.budgets.save(existing);

    const overlapping = await catalog().saveBudget(budgetInput({ startMonth: ym('2026-06'), endMonth: null }));
    const open = await catalog().saveBudget(budgetInput({ startMonth: ym('2025-01'), endMonth: null }));
    const after = await catalog().saveBudget(budgetInput({ startMonth: ym('2026-07'), endMonth: null }));
    const otherCategory = await catalog().saveBudget(budgetInput({ categoryId: FUN }));

    expect(overlapping.ok === false && overlapping.error.code).toBe('budget.duplicateCategory');
    expect(open.ok === false && open.error.code).toBe('budget.duplicateCategory');
    expect(after.ok).toBe(true);
    expect(otherCategory.ok).toBe(true);
  });

  it('edits a budget without clashing with itself, and deletes', async () => {
    const created = await catalog().saveBudget(budgetInput());
    if (!created.ok) throw new Error('create');

    const edited = await catalog().saveBudget(budgetInput({ id: created.value.id, monthlyLimit: money(20_000) }));
    const deleted = await catalog().deleteBudget(created.value.id);
    const missing = await catalog().deleteBudget(created.value.id);

    expect(edited).toMatchObject({ ok: true, value: { monthlyLimit: money(20_000) } });
    expect(deleted.ok).toBe(true);
    expect(missing).toEqual({ ok: false, error: { code: 'budget.notFound' } });
  });
});

describe('atomic uniqueness under concurrent submits', () => {
  it('saves only one budget when the same budget is submitted twice in the same tick', async () => {
    const c = catalog();
    const [a, b] = await Promise.all([c.saveBudget(budgetInput()), c.saveBudget(budgetInput())]);

    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(await w.budgets.list()).toHaveLength(1);
  });

  it('saves only one category when the same name is submitted twice in the same tick', async () => {
    const c = catalog();
    const input = { name: 'Mascotas', kind: 'expense' as const, color: 'chart-1', archived: false };
    const [a, b] = await Promise.all([c.saveCategory(input), c.saveCategory({ ...input, name: ' mascotas ' })]);

    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const failed = a.ok ? b : a;
    expect(!failed.ok && failed.error.code).toBe('category.duplicateName');
  });

  it('allows re-saving a category with its own name', async () => {
    const c = catalog();
    const created = await c.saveCategory({ name: 'Mascotas', kind: 'expense', color: 'chart-1', archived: false });
    if (!created.ok) throw new Error('create');
    const again = await c.saveCategory({ id: created.value.id, name: 'Mascotas', kind: 'expense', color: 'chart-2', archived: false });
    expect(again.ok).toBe(true);
  });
});

describe('archiving a category', () => {
  it('disables the rules that point to it and leaves the others enabled', async () => {
    const c = catalog();
    await c.saveRule(ruleInput({ pattern: 'mercadona', categoryId: FOOD }));
    await c.saveRule(ruleInput({ pattern: 'cine', categoryId: FUN }));
    const food = (await w.categories.list()).find((x) => x.id === FOOD)!;

    const result = await c.saveCategory({ ...food, archived: true });

    expect(result.ok).toBe(true);
    const rules = await w.rules.list();
    expect(rules.find((r) => r.categoryId === FOOD)?.enabled).toBe(false);
    expect(rules.find((r) => r.categoryId === FUN)?.enabled).toBe(true);
  });
});

describe('without onDataChanged', () => {
  it('still works', async () => {
    const useCase = new ManageCatalogUseCase({ accounts: w.accounts, categories: w.categories, rules: w.rules, budgets: w.budgets, transactions: w.transactions, clock: w.clock, ids: w.ids });
    w.state.transactions.set('t' as TransactionId, tx({ dedupKey: 'k#0' as DedupKey }));

    expect((await useCase.saveAccount({ name: 'X', ibanLast4: null })).ok).toBe(true);
    expect((await useCase.listCategories()).length).toBeGreaterThan(0);
  });
});
