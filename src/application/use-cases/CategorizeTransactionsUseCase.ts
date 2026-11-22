import type { DataChangedNotifier } from '@/application/ports/outbound/DataChange';
import type {
  CategorizeInput,
  CategorizeOutput,
  CategorizeScope,
  CategorizeTransactions,
} from '@/application/ports/inbound/CategorizeTransactions';
import type { RuleRepository } from '@/application/ports/outbound/CatalogRepositories';
import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import { readAll, reapplyRules } from '@/application/use-cases/applyRules';
import { UNCATEGORIZED } from '@/domain/category/Category';
import type { Transaction } from '@/domain/transaction/Transaction';

/** Máximo de ids de ejemplo devueltos. */
const SAMPLE_SIZE = 10;

export interface CategorizeTransactionsDeps {
  readonly transactions: TransactionRepository;
  readonly rules: RuleRepository;
  readonly clock: ClockPort;
  readonly onDataChanged?: DataChangedNotifier;
}

/** Aplica las reglas a movimientos `'none'` y `'rule'`; los `'manual'` nunca se tocan. */
export class CategorizeTransactionsUseCase implements CategorizeTransactions {
  constructor(private readonly deps: CategorizeTransactionsDeps) {}

  async execute(input: CategorizeInput): Promise<CategorizeOutput> {
    const { transactions, rules, clock, onDataChanged } = this.deps;
    const candidates = await this.candidates(input.scope);
    const ruleList = await rules.list();
    const now = clock.now();
    const updated = candidates.flatMap((tx) => {
      const next = reapplyRules(tx, ruleList, now);
      return next === null ? [] : [next];
    });
    if (updated.length > 0 && input.dryRun !== true) {
      await transactions.updateMany(updated);
      onDataChanged?.({ upserted: updated });
    }
    return { changed: updated.length, sampleIds: updated.slice(0, SAMPLE_SIZE).map((t) => t.id) };
  }

  private async candidates(scope: CategorizeScope): Promise<readonly Transaction[]> {
    const { transactions } = this.deps;
    const pool = typeof scope === 'object' ? await transactions.getByIds(scope.ids) : await readAll(transactions);
    const editable = pool.filter((t) => t.categorySource !== 'manual');
    return scope === 'uncategorized' ? editable.filter((t) => t.categoryId === UNCATEGORIZED) : editable;
  }
}
