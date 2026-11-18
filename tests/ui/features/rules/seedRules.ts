import type { AppContainer } from '@/composition/container.types';
import { createTestContainer } from '@/composition/createTestContainer';
import type { AccountId } from '@/domain/account/Account';
import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import type { Cents } from '@/domain/money/Money';
import type { Rule, RuleId } from '@/domain/rule/Rule';
import { normalizeText } from '@/domain/shared/normalizeText';
import type { DedupKey } from '@/domain/transaction/DedupKey';
import type { CategorySource, Transaction, TransactionId } from '@/domain/transaction/Transaction';
import { InMemoryCategoryRepository, InMemoryRuleRepository } from '../../../fakes/InMemoryCatalogRepositories';
import { createInMemoryState } from '../../../fakes/InMemoryState';
import { InMemoryTransactionRepository } from '../../../fakes/InMemoryTransactionRepository';

export const ACCOUNT = 'acc-main' as AccountId;
export const cat = (slug: string) => `cat-${slug}` as CategoryId;

type Row = readonly [description: string, cents: number, category?: CategoryId, source?: CategorySource];

/**
 * Libro mínimo con recuentos conocidos:
 * - «MERCADONA» coincide con 2 (no con «MERCADO CENTRAL»: palabra completa).
 * - «CENTRAL» coincide con 2, pero «CAFE CENTRAL» está categorizado a mano (Regalos) y nunca se toca.
 * - Aplicar las reglas cambia 3 movimientos (2 de Mercadona y «MERCADO CENTRAL»).
 */
const ROWS: readonly Row[] = [
  ['COMPRA MERCADONA VALENCIA', -4520],
  ['MERCADONA ALBORAYA', -2000],
  ['MERCADO CENTRAL', -1000],
  ['NETFLIX.COM 1234', -1299],
  ['NOMINA ACME SL', 200_000],
  ['CAFÉ CENTRAL', -350, cat('gifts'), 'manual'],
];

function transaction([description, cents, categoryId = UNCATEGORIZED, source = 'none']: Row, index: number): Transaction {
  return {
    id: `tx-${index}` as TransactionId,
    accountId: ACCOUNT,
    date: `2026-03-${String(index + 1).padStart(2, '0')}` as IsoDate,
    valueDate: null,
    amount: { cents: cents as Cents },
    balance: null,
    rawDescription: description,
    description,
    normalizedDescription: normalizeText(description),
    categoryId,
    categorySource: source,
    ruleId: null,
    note: '',
    dedupKey: `dk-${index}` as DedupKey,
    importBatchId: 'batch-1' as ImportBatchId,
    createdAt: '2026-03-15T00:00:00.000Z',
    updatedAt: '2026-03-15T00:00:00.000Z',
  };
}

export function rule(id: string, pattern: string, categoryId: CategoryId, priority: number): Rule {
  return {
    id: id as RuleId,
    pattern,
    operator: 'contains',
    amountSign: 'any',
    accountId: null,
    categoryId,
    priority,
    enabled: true,
    origin: 'manual',
    createdAt: `2026-01-0${priority}T00:00:00.000Z`,
  };
}

export const SEED_RULES: readonly Rule[] = [
  rule('rule-mercadona', 'MERCADONA', cat('groceries'), 1),
  rule('rule-central', 'CENTRAL', cat('leisure'), 2),
];

type SeedOptions = { readonly rules?: readonly Rule[] };

/** Contenedor con los casos de uso reales, sembrado con movimientos y reglas; espera a que el índice esté listo. */
export async function createRulesContainer({ rules = SEED_RULES }: SeedOptions = {}): Promise<AppContainer> {
  const state = createInMemoryState();
  ROWS.forEach((row, index) => state.transactions.set(`tx-${index}`, transaction(row, index)));
  rules.forEach((item) => state.rules.set(item.id, item));
  const container = await createTestContainer({
    transactions: new InMemoryTransactionRepository(state),
    categories: new InMemoryCategoryRepository(state),
    rules: new InMemoryRuleRepository(state),
  });
  await container.whenIndexIdle();
  return container;
}
