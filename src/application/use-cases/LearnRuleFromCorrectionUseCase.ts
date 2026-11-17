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
import { readAll, reapplyRules } from '@/application/use-cases/applyRules';
import type { Rule, RuleId } from '@/domain/rule/Rule';
import { suggestRule, type RuleSuggestion } from '@/domain/rule/ruleSuggestion';
import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { normalizeText } from '@/domain/shared/normalizeText';
import { err, ok, type Result } from '@/domain/shared/Result';
import { recategorize, type Transaction } from '@/domain/transaction/Transaction';

/** Longitud mínima del patrón de una regla (AC-020: 1 carácter se rechaza). */
const MIN_PATTERN_LENGTH = 2;

export interface LearnRuleDeps {
  readonly transactions: TransactionRepository;
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
    onDataChanged?.();

    const others = (await readAll(transactions)).filter((t) => t.id !== corrected.id);
    const suggestion = suggestRule(corrected, input.categoryId, others);
    if (suggestion === null) return ok({ suggestion: null, affectedCount: 0 });
    const candidate = this.buildRule(suggestion, 'preview' as RuleId, await this.nextPriority());
    const affected = this.recategorizedBy(others, [...(await rules.list()), candidate], candidate.id);
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

    const affected = this.recategorizedBy(await readAll(transactions), await rules.list(), rule.id);
    if (affected.length > 0) await transactions.updateMany(affected);
    onDataChanged?.();
    return ok({ ruleId: rule.id, recategorized: affected.length });
  }

  /** Movimientos que cambiarían a la regla indicada (nunca los manuales ni los reasignados por otras reglas). */
  private recategorizedBy(all: readonly Transaction[], rules: readonly Rule[], ruleId: RuleId): readonly Transaction[] {
    const now = this.deps.clock.now();
    return all.flatMap((tx) => {
      const next = reapplyRules(tx, rules, now);
      return next !== null && next.ruleId === ruleId ? [next] : [];
    });
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
