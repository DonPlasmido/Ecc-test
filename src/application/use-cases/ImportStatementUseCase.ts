import {
  IMPORT_PREVIEW_ROWS,
  type CommitImportInput,
  type ImportPreview,
  type ImportResult,
  type ImportStatement,
} from '@/application/ports/inbound/ImportStatement';
import type { AccountRepository, RuleRepository } from '@/application/ports/outbound/CatalogRepositories';
import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { IdGeneratorPort } from '@/application/ports/outbound/IdGeneratorPort';
import type { ImportProfileRepository } from '@/application/ports/outbound/ImportProfileRepository';
import type { StatementParserPort } from '@/application/ports/outbound/StatementParserPort';
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository';
import { quotaErrorOrRethrow } from '@/application/use-cases/storageErrors';
import { UNCATEGORIZED } from '@/domain/category/Category';
import { hasAmbiguousDates } from '@/domain/date/parseSpanishDate';
import type { ColumnMapping } from '@/domain/import/ColumnMapping';
import { detectColumnMapping, headerSignature, validateMapping } from '@/domain/import/detectColumnMapping';
import type { ImportBatch, ImportBatchId } from '@/domain/import/ImportBatch';
import { normalizeRows } from '@/domain/import/normalizeRows';
import type { RawCell, RawTable } from '@/domain/import/RawTable';
import type { StatementFile } from '@/domain/import/StatementFile';
import { categorize, sortRules } from '@/domain/rule/ruleMatcher';
import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { err, ok, type Result } from '@/domain/shared/Result';
import { assignDedupKeys, type KeyedTransactionDraft } from '@/domain/transaction/DedupKey';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';
import type { Rule } from '@/domain/rule/Rule';

export interface ImportStatementDeps {
  readonly parser: StatementParserPort;
  readonly transactions: TransactionRepository;
  readonly profiles: ImportProfileRepository;
  readonly rules: RuleRepository;
  readonly accounts: AccountRepository;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly onDataChanged?: () => void;
}

interface RetainedPreview {
  readonly table: RawTable;
  readonly fileName: string;
}

function cellText(cell: RawCell | undefined): string {
  if (cell === undefined || cell.kind === 'empty') return '';
  return String(cell.value);
}

function headersOf(table: RawTable, headerRowIndex: number): readonly string[] | null {
  const row = table.rows[headerRowIndex];
  return headerRowIndex >= 0 && row !== undefined ? row.map(cellText) : null;
}

function dateTexts(table: RawTable, mapping: ColumnMapping): readonly string[] {
  const column = mapping.columns.indexOf('date');
  if (column < 0) return [];
  return table.rows.slice(mapping.headerRowIndex + 1).flatMap((row) => {
    const cell = row[column];
    return cell?.kind === 'text' ? [cell.value] : [];
  });
}

/** Importa extractos en dos pasos; la tabla parseada se retiene en memoria entre `preview` y `commit`. */
export class ImportStatementUseCase implements ImportStatement {
  private readonly previews = new Map<string, RetainedPreview>();

  constructor(private readonly deps: ImportStatementDeps) {}

  async preview(file: StatementFile): Promise<Result<ImportPreview, DomainError>> {
    const { parser, profiles, ids } = this.deps;
    if (!parser.supports(file)) return err(domainError('import.unsupportedFormat'));
    const parsed = await parser.parse(file);
    if (!parsed.ok) return parsed;
    const table = parsed.value;
    if (table.rows.length === 0) return err(domainError('import.emptyFile'));

    const detection = detectColumnMapping(table);
    const headers = headersOf(table, detection.mapping.headerRowIndex);
    const profile = headers === null ? null : await profiles.find(headerSignature(headers));
    const mapping = profile?.mapping ?? detection.mapping;
    const previewId = ids.next();
    this.previews.set(previewId, { table, fileName: file.name });
    return ok({
      previewId,
      table: { ...table, rows: table.rows.slice(0, IMPORT_PREVIEW_ROWS) },
      suggestedMapping: mapping,
      confidence: profile === null ? detection.confidence : 1,
      rememberedMapping: profile !== null,
      ambiguousDates: hasAmbiguousDates(dateTexts(table, mapping)),
    });
  }

  async commit(input: CommitImportInput): Promise<Result<ImportResult, DomainError>> {
    const retained = this.previews.get(input.previewId);
    if (retained === undefined) return err(domainError('import.previewNotFound'));
    const accounts = await this.deps.accounts.list();
    if (!accounts.some((a) => a.id === input.accountId)) return err(domainError('import.accountNotFound'));
    const valid = validateMapping(input.mapping);
    if (!valid.ok) return valid;

    const { drafts, rowErrors } = normalizeRows(retained.table, input.mapping, input.accountId);
    const keyed = assignDedupKeys(drafts);
    const existing = await this.deps.transactions.existingDedupKeys(keyed.map((d) => d.dedupKey));
    const fresh = keyed.filter((d) => !existing.has(d.dedupKey));
    const rules = sortRules(await this.deps.rules.list());
    const batchId = this.deps.ids.next() as ImportBatchId;
    const transactions = fresh.map((d) => this.toTransaction(d, batchId, rules));

    if (transactions.length > 0) {
      const batch: ImportBatch = {
        id: batchId,
        accountId: input.accountId,
        fileName: retained.fileName,
        importedAt: this.deps.clock.now(),
        rowCount: drafts.length,
        inserted: transactions.length,
        duplicates: keyed.length - fresh.length,
        mapping: input.mapping,
      };
      try {
        await this.deps.transactions.insertImport(batch, transactions);
      } catch (error) {
        return quotaErrorOrRethrow(error);
      }
      // Los movimientos ya están guardados: el índice debe enterarse pase lo que pase después.
      this.deps.onDataChanged?.();
    }
    this.previews.delete(input.previewId);
    try {
      await this.rememberMapping(retained.table, input);
    } catch (error: unknown) {
      // Recordar el mapeo es una comodidad: si falla, la importación sigue siendo válida.
      console.warn('No se pudo recordar el mapeo de columnas', error);
    }
    return ok({
      batchId,
      inserted: transactions.length,
      duplicates: keyed.length - fresh.length,
      autoCategorized: transactions.filter((t) => t.categorySource === 'rule').length,
      rowErrors,
    });
  }

  private toTransaction(d: KeyedTransactionDraft, batchId: ImportBatchId, rules: readonly Rule[]): Transaction {
    const now = this.deps.clock.now();
    return categorize(
      {
        id: this.deps.ids.next() as TransactionId,
        accountId: d.accountId,
        date: d.date,
        valueDate: d.valueDate,
        amount: d.amount,
        balance: d.balance,
        rawDescription: d.rawDescription,
        description: d.rawDescription,
        normalizedDescription: d.normalizedDescription,
        categoryId: UNCATEGORIZED,
        categorySource: 'none',
        ruleId: null,
        note: '',
        dedupKey: d.dedupKey,
        importBatchId: batchId,
        createdAt: now,
        updatedAt: now,
      },
      rules,
    );
  }

  private async rememberMapping(table: RawTable, input: CommitImportInput): Promise<void> {
    const headers = headersOf(table, input.mapping.headerRowIndex);
    if (headers === null) return;
    await this.deps.profiles.save({
      headerSignature: headerSignature(headers),
      mapping: input.mapping,
      accountId: input.accountId,
    });
  }
}
