import type { CategoryRepository, RuleRepository } from '@/application/ports/outbound/CatalogRepositories';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import type { Rule } from '@/domain/rule/Rule';
import { categorize, sortRules } from '@/domain/rule/ruleMatcher';
import { recategorize, type Transaction } from '@/domain/transaction/Transaction';

/** Aplica las reglas a un movimiento; devuelve el movimiento actualizado solo si algo cambió. */
export function reapplyRules(tx: Transaction, rules: readonly Rule[], now: string): Transaction | null {
  const next = categorize(tx, sortRules(rules));
  const changed = next.categoryId !== tx.categoryId || next.categorySource !== tx.categorySource || next.ruleId !== tx.ruleId;
  return changed ? recategorize(tx, next.categoryId, next.categorySource, next.ruleId, now) : null;
}

/** Lee todos los movimientos del repositorio. */
export async function readAll(transactions: TransactionRepository): Promise<readonly Transaction[]> {
  const all: Transaction[] = [];
  await transactions.scan((batch) => {
    all.push(...batch);
  });
  return all;
}

/** Reglas utilizables: las que apuntan a una categoría archivada se ignoran. */
export async function listActiveRules(rules: RuleRepository, categories: CategoryRepository): Promise<readonly Rule[]> {
  const [all, cats] = await Promise.all([rules.list(), categories.list()]);
  const archived = new Set(cats.filter((c) => c.archived).map((c) => c.id));
  return all.filter((r) => !archived.has(r.categoryId));
}
