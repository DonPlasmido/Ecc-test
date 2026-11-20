import { BACKUP_FORMAT_VERSION, type BackupSnapshot } from '@/application/backup/BackupSnapshot';
import { UNCATEGORIZED } from '@/domain/category/Category';
import { IsoDate } from '@/domain/date/IsoDate';
import { parseYearMonth } from '@/domain/date/YearMonth';
import { domainError, type DomainError } from '@/domain/shared/DomainError';
import { err, ok, type Result } from '@/domain/shared/Result';

type Obj = Readonly<Record<string, unknown>>;

/** Fallo de validación con el campo ofensivo (nunca el valor: puede ser un dato privado). */
class Invalid extends Error {
  constructor(readonly field: string) {
    super(field);
  }
}

const CATEGORY_KINDS = ['expense', 'income', 'transfer'];
const CATEGORY_SOURCES = ['none', 'rule', 'manual'];
const RULE_OPERATORS = ['contains', 'startsWith', 'equals'];
const AMOUNT_SIGNS = ['any', 'expense', 'income'];
const RULE_ORIGINS = ['manual', 'learned'];
const LOCALES = ['es', 'en'];
const THEMES = ['system', 'light', 'dark'];
const AMOUNT_CONVENTIONS = ['signed', 'debitCredit'];
const COLUMN_ROLES = ['date', 'valueDate', 'description', 'amount', 'debit', 'credit', 'balance', 'ignore'];

function fail(field: string): never {
  throw new Invalid(field);
}

function obj(value: unknown, field: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(field);
  return value as Obj;
}

function str(o: Obj, key: string, path: string): string {
  const value = o[key];
  if (typeof value !== 'string') fail(`${path}.${key}`);
  return value;
}

function nullableStr(o: Obj, key: string, path: string): void {
  if (o[key] !== null) str(o, key, path);
}

function num(o: Obj, key: string, path: string): number {
  const value = o[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${path}.${key}`);
  return value;
}

function oneOf(o: Obj, key: string, path: string, allowed: readonly string[]): void {
  if (!allowed.includes(str(o, key, path))) fail(`${path}.${key}`);
}

function bool(o: Obj, key: string, path: string): void {
  if (typeof o[key] !== 'boolean') fail(`${path}.${key}`);
}

function money(value: unknown, path: string): void {
  const cents = obj(value, path)['cents'];
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents)) fail(`${path}.cents`);
}

function nullableMoney(o: Obj, key: string, path: string): void {
  if (o[key] !== null) money(o[key], `${path}.${key}`);
}

function date(o: Obj, key: string, path: string): void {
  if (!IsoDate.parse(str(o, key, path)).ok) fail(`${path}.${key}`);
}

function nullableDate(o: Obj, key: string, path: string): void {
  if (o[key] !== null) date(o, key, path);
}

function month(o: Obj, key: string, path: string): void {
  if (!parseYearMonth(str(o, key, path)).ok) fail(`${path}.${key}`);
}

function list(raw: Obj, key: string): readonly Obj[] {
  const value = raw[key];
  if (!Array.isArray(value)) fail(key);
  return (value as readonly unknown[]).map((item, i) => obj(item, `${key}[${i}]`));
}

function uniqueBy(items: readonly Obj[], key: string, path: string): ReadonlySet<string> {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    const value = str(item, key, `${path}[${i}]`);
    if (seen.has(value)) fail(`${path}[${i}].${key}`);
    seen.add(value);
  });
  return seen;
}

function checkMapping(value: unknown, path: string): void {
  const mapping = obj(value, path);
  if (!Number.isInteger(num(mapping, 'headerRowIndex', path))) fail(`${path}.headerRowIndex`);
  oneOf(mapping, 'amountConvention', path, AMOUNT_CONVENTIONS);
  const columns = mapping['columns'];
  if (!Array.isArray(columns) || columns.some((c) => typeof c !== 'string' || !COLUMN_ROLES.includes(c))) {
    fail(`${path}.columns`);
  }
}

function checkAccounts(items: readonly Obj[]): ReadonlySet<string> {
  const ids = uniqueBy(items, 'id', 'accounts');
  items.forEach((a, i) => {
    const path = `accounts[${i}]`;
    str(a, 'name', path);
    nullableStr(a, 'ibanLast4', path);
    str(a, 'createdAt', path);
    if (a['currency'] !== 'EUR') fail(`${path}.currency`);
  });
  return ids;
}

function checkCategories(items: readonly Obj[]): ReadonlySet<string> {
  const ids = uniqueBy(items, 'id', 'categories');
  items.forEach((c, i) => {
    const path = `categories[${i}]`;
    str(c, 'name', path);
    nullableStr(c, 'nameKey', path);
    oneOf(c, 'kind', path, CATEGORY_KINDS);
    str(c, 'color', path);
    bool(c, 'archived', path);
  });
  return ids;
}

function checkRules(items: readonly Obj[]): void {
  uniqueBy(items, 'id', 'rules');
  items.forEach((r, i) => {
    const path = `rules[${i}]`;
    str(r, 'pattern', path);
    oneOf(r, 'operator', path, RULE_OPERATORS);
    oneOf(r, 'amountSign', path, AMOUNT_SIGNS);
    nullableStr(r, 'accountId', path);
    str(r, 'categoryId', path);
    num(r, 'priority', path);
    bool(r, 'enabled', path);
    oneOf(r, 'origin', path, RULE_ORIGINS);
    str(r, 'createdAt', path);
  });
}

function checkBudgets(items: readonly Obj[]): void {
  uniqueBy(items, 'id', 'budgets');
  items.forEach((b, i) => {
    const path = `budgets[${i}]`;
    str(b, 'categoryId', path);
    money(b['monthlyLimit'], `${path}.monthlyLimit`);
    month(b, 'startMonth', path);
    if (b['endMonth'] !== null) month(b, 'endMonth', path);
  });
}

function checkBatches(items: readonly Obj[]): void {
  uniqueBy(items, 'id', 'importBatches');
  items.forEach((b, i) => {
    const path = `importBatches[${i}]`;
    str(b, 'accountId', path);
    str(b, 'fileName', path);
    str(b, 'importedAt', path);
    for (const key of ['rowCount', 'inserted', 'duplicates']) num(b, key, path);
    checkMapping(b['mapping'], `${path}.mapping`);
  });
}

function checkProfiles(items: readonly Obj[]): void {
  uniqueBy(items, 'headerSignature', 'importProfiles');
  items.forEach((p, i) => {
    nullableStr(p, 'accountId', `importProfiles[${i}]`);
    checkMapping(p['mapping'], `importProfiles[${i}].mapping`);
  });
}

function checkTransactions(items: readonly Obj[], accountIds: ReadonlySet<string>, categoryIds: ReadonlySet<string>): void {
  uniqueBy(items, 'id', 'transactions');
  uniqueBy(items, 'dedupKey', 'transactions');
  items.forEach((t, i) => {
    const path = `transactions[${i}]`;
    if (!accountIds.has(str(t, 'accountId', path))) fail(`${path}.accountId`);
    const categoryId = str(t, 'categoryId', path);
    if (categoryId !== UNCATEGORIZED && !categoryIds.has(categoryId)) fail(`${path}.categoryId`);
    date(t, 'date', path);
    nullableDate(t, 'valueDate', path);
    money(t['amount'], `${path}.amount`);
    nullableMoney(t, 'balance', path);
    for (const key of ['rawDescription', 'description', 'normalizedDescription', 'note', 'importBatchId', 'createdAt', 'updatedAt']) {
      str(t, key, path);
    }
    oneOf(t, 'categorySource', path, CATEGORY_SOURCES);
    nullableStr(t, 'ruleId', path);
  });
}

function checkSettings(value: unknown): void {
  if (value === null) return;
  const settings = obj(value, 'settings');
  oneOf(settings, 'locale', 'settings', LOCALES);
  oneOf(settings, 'theme', 'settings', THEMES);
  if (settings['lastBackupAt'] !== undefined) str(settings, 'lastBackupAt', 'settings');
}

function validate(rawInput: unknown): BackupSnapshot {
  const raw = obj(rawInput, 'snapshot');
  const accountIds = checkAccounts(list(raw, 'accounts'));
  const categoryIds = checkCategories(list(raw, 'categories'));
  checkRules(list(raw, 'rules'));
  checkBudgets(list(raw, 'budgets'));
  checkBatches(list(raw, 'importBatches'));
  checkProfiles(list(raw, 'importProfiles'));
  checkTransactions(list(raw, 'transactions'), accountIds, categoryIds);
  checkSettings(raw['settings']);
  num(raw, 'schemaVersion', 'snapshot');
  str(raw, 'exportedAt', 'snapshot');
  return raw as unknown as BackupSnapshot;
}

function versionOf(raw: unknown): number {
  const version = typeof raw === 'object' && raw !== null ? (raw as Obj)['formatVersion'] : undefined;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) fail('formatVersion');
  return version;
}

/**
 * Valida (y, llegado el caso, migra) un snapshot descifrado antes de `replaceAll`.
 * Hoy solo existe la versión 1; las versiones futuras se rechazan como `backup.unsupportedVersion`.
 */
export function migrateSnapshot(raw: unknown): Result<BackupSnapshot, DomainError> {
  try {
    if (versionOf(raw) > BACKUP_FORMAT_VERSION) return err(domainError('backup.unsupportedVersion'));
    return ok(validate(raw));
  } catch (error) {
    if (error instanceof Invalid) return err(domainError('backup.invalidSnapshot', { field: error.field }));
    throw error;
  }
}
