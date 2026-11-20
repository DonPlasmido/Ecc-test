import type {
  PageTransactionsInput,
  QueryTransactions,
  SearchTransactionsInput,
  SearchTransactionsOutput,
  UpdateTransactionInput,
} from '@/application/ports/inbound/QueryTransactions';
import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { IdGeneratorPort } from '@/application/ports/outbound/IdGeneratorPort';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import type { TransactionIndex } from '@/application/read-model/TransactionIndex';
import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { err, ok, type Result } from '@/domain/shared/Result';
import { withDescription, withNote, type Transaction } from '@/domain/transaction/Transaction';

export interface QueryTransactionsDeps {
  readonly index: TransactionIndex;
  readonly transactions: TransactionRepository;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
}

/** Búsquedas recientes que se conservan para paginar (la UI solo pagina la última). */
const MAX_RETAINED_RESULTS = 8;

interface RetainedResult {
  readonly input: SearchTransactionsInput;
  readonly positions: Uint32Array;
  readonly version: number;
}

/** Consulta paginada en dos fases (índice en memoria + filas de IndexedDB) y edición de movimientos. */
export class QueryTransactionsUseCase implements QueryTransactions {
  private readonly results = new Map<string, RetainedResult>();

  constructor(private readonly deps: QueryTransactionsDeps) {}

  search(input: SearchTransactionsInput): Promise<SearchTransactionsOutput> {
    const { index, ids } = this.deps;
    const positions = index.filter(input.filter, input.sort);
    const resultId = ids.next();
    this.results.set(resultId, { input, positions, version: index.version });
    this.evictOldest();
    return Promise.resolve({ resultId, total: positions.length, sum: index.sumAt(positions) });
  }

  async page(input: PageTransactionsInput): Promise<readonly Transaction[]> {
    const retained = this.freshResult(input.resultId);
    if (retained === undefined) return [];
    const { index, transactions } = this.deps;
    const offset = Math.max(0, input.offset);
    const limit = Math.max(0, input.limit);
    if (limit === 0) return [];
    return transactions.getByIds(index.idsAt(retained.positions, offset, limit));
  }

  async update(input: UpdateTransactionInput): Promise<Result<Transaction, DomainError>> {
    const { transactions, index, clock } = this.deps;
    const [current] = await transactions.getByIds([input.id]);
    if (current === undefined) return err(domainError('transaction.notFound'));
    const { description, note } = input.patch;
    if (description !== undefined && description.trim() === '') return err(domainError('import.emptyDescription'));
    if (description === undefined && note === undefined) return ok(current);
    const now = clock.now();
    const withText = description === undefined ? current : withDescription(current, description, now);
    const updated = note === undefined ? withText : withNote(withText, note, now);
    await transactions.updateMany([updated]);
    index.applyUpserts([updated]);
    return ok(updated);
  }

  /** Devuelve el resultado retenido; si el índice cambió desde la búsqueda lo recalcula. */
  private freshResult(resultId: string): RetainedResult | undefined {
    const retained = this.results.get(resultId);
    if (retained === undefined) return undefined;
    const { index } = this.deps;
    if (retained.version === index.version) return retained;
    const refreshed: RetainedResult = {
      input: retained.input,
      positions: index.filter(retained.input.filter, retained.input.sort),
      version: index.version,
    };
    this.results.set(resultId, refreshed);
    return refreshed;
  }

  private evictOldest(): void {
    while (this.results.size > MAX_RETAINED_RESULTS) {
      const oldest = this.results.keys().next();
      if (oldest.done === true) return;
      this.results.delete(oldest.value);
    }
  }
}
