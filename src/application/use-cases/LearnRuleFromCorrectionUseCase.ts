import type {
  AcceptSuggestionInput,
  AcceptSuggestionOutput,
  CorrectCategoryInput,
  CorrectCategoryOutput,
  LearnRuleFromCorrection,
} from '@/application/ports/inbound/LearnRuleFromCorrection';
import type { CategoryRepository, RuleRepository } from '@/application/ports/outbound/CatalogRepositories';
import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { IdGeneratorPort } from '@/application/ports/outbound/IdGeneratorPort';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import type { TransactionIndex } from '@/application/read-model/TransactionIndex';
import { reapplyRules } from '@/application/use-cases/applyRules';
import type { Rule, RuleId } from '@/domain/rule/Rule';
import { suggestRule, type RuleSuggestion } from '@/domain/rule/ruleSuggestion';
import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { matchesRulePattern } from '@/domain/rule/wordMatch';
import { normalizeText } from '@/domain/shared/normalizeText';
import { err, ok, type Result } from '@/domain/shared/Result';
import { recategorize, type Transaction, type TransactionId } from '@/domain/transaction/Transaction';

/** Longitud mínima del patrón de una regla (AC-020: 1 carácter se rechaza). */
const MIN_PATTERN_LENGTH = 2;

export interface LearnRuleDeps {
  readonly transactions: TransactionRepository;
  /** Índice en memoria: histórico y candidatos sin escanear el repositorio completo. */
  readonly index: TransactionIndex;
  readonly rules: RuleRepository;
  readonly categories: CategoryRepository;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly onDataChanged?: () => void;
}

/** Aprende reglas de las correcciones manuales: corrige, propone y, solo si se acepta, crea. */
export class LearnRuleFromCorrectionUseCase implements LearnRuleFromCorrection {
  constructor(private readonly deps: LearnRuleDeps) {}

  async correct(input: CorrectCategoryInput): Promise<Result<CorrectCategoryOutput, DomainError>> {
    const { transactions, rules, clock, onDataChanged } = this.deps;
    const [found] = await transactions.getByIds([input.transactionId]);
    if (found === undefined) return err(domainError('transaction.notFound'));
    if (!(await this.categoryExists(input.categoryId))) return err(domainError('category.notFound'));

    const corrected = recategorize(found, input.categoryId, 'manual', null, clock.now());
    await transactions.updateMany([corrected]);
    this.deps.index.applyUpserts([corrected]);
    onDataChanged?.();

    const history = this.deps.index.historyRows().filter((row) => row.id !== corrected.id);
    const suggestion = suggestRule(corrected, input.categoryId, history);
    if (suggestion === null) return ok({ suggestion: null, affectedCount: 0 });
    const candidate = this.buildRule(suggestion, 'preview' as RuleId, await this.nextPriority());
    const candidateIds = this.candidateIds(candidate).filter((id) => id !== corrected.id);
    const affected = this.recategorizedBy(await transactions.getByIds(candidateIds), [...(await rules.list()), candidate], candidate.id);
    return ok({ suggestion, affectedCount: affected.length });
  }

  async accept(input: AcceptSuggestionInput): Promise<Result<AcceptSuggestionOutput, DomainError>> {
    const { transactions, rules, ids, onDataChanged } = this.deps;
    const { suggestion } = input;
    if (normalizeText(suggestion.pattern).length < MIN_PATTERN_LENGTH) {
      return err(domainError('rule.invalidPattern', { field: 'pattern' }));
    }
    if (!(await this.categoryExists(suggestion.categoryId))) return err(domainError('category.notFound'));

    const rule = this.buildRule(suggestion, ids.next() as RuleId, await this.nextPriority());
    await rules.save(rule);
    if (!input.applyToExisting) return ok({ ruleId: rule.id, recategorized: 0 });

    try {
      const candidates = await transactions.getByIds(this.candidateIds(rule));
      const affected = this.recategorizedBy(candidates, await rules.list(), rule.id);
      if (affected.length > 0) {
        await transactions.updateMany(affected);
        this.deps.index.applyUpserts(affected);
      }
      return ok({ ruleId: rule.id, recategorized: affected.length });
    } finally {
      // La regla ya está guardada: el índice se reconcilia aunque la recategorización falle.
      onDataChanged?.();
    }
  }

  /** Movimientos que cambiarían a la regla indicada (nunca los manuales ni los reasignados por otras reglas). */
  private recategorizedBy(all: readonly Transaction[], rules: readonly Rule[], ruleId: RuleId): readonly Transaction[] {
    const now = this.deps.clock.now();
    return all.flatMap((tx) => {
      const next = reapplyRules(tx, rules, now);
      return next !== null && next.ruleId === ruleId ? [next] : [];
    });
  }

  /** Ids del índice que la regla podría tocar (patrón y signo); `recategorizedBy` afina el resto. */
  private candidateIds(rule: Rule): readonly TransactionId[] {
    return this.deps.index.idsMatching(
      (description, cents) =>
        (rule.amountSign === 'any' || (rule.amountSign === 'expense' ? cents < 0 : cents > 0)) &&
        matchesRulePattern(description, rule.pattern, rule.operator),
    );
  }

  private buildRule(suggestion: RuleSuggestion, id: RuleId, priority: number): Rule {
    return {
      id,
      pattern: normalizeText(suggestion.pattern),
      operator: suggestion.operator,
      amountSign: suggestion.amountSign,
      accountId: null,
      categoryId: suggestion.categoryId,
      priority,
      enabled: true,
      origin: 'learned',
      createdAt: this.deps.clock.now(),
    };
  }

  private async nextPriority(): Promise<number> {
    const rules = await this.deps.rules.list();
    return rules.reduce((max, r) => Math.max(max, r.priority), 0) + 1;
  }

  private async categoryExists(id: Rule['categoryId']): Promise<boolean> {
    return (await this.deps.categories.list()).some((c) => c.id === id);
  }
}
