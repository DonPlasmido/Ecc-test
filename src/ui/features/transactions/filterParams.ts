import type { TransactionFilter, TransactionSortKey } from '@/application/ports/inbound/QueryTransactions';
import type { AccountId } from '@/domain/account/Account';
import type { CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { AmountSign } from '@/domain/rule/Rule';

/** Estado de filtros tal y como vive en la query del hash (texto plano, sin validar). */
export interface FilterParams {
  readonly q: string;
  readonly from: string;
  readonly to: string;
  readonly categoryIds: readonly string[];
  readonly accountIds: readonly string[];
  readonly sign: AmountSign;
  /** Importe mínimo en euros tal como lo escribió el usuario («12,50»). */
  readonly min: string;
  readonly max: string;
  readonly sort: TransactionSortKey;
}

export const SORT_KEYS: readonly TransactionSortKey[] = ['dateDesc', 'dateAsc', 'amountDesc', 'amountAsc'];
export const SIGNS: readonly AmountSign[] = ['any', 'expense', 'income'];
const DEFAULT_SORT: TransactionSortKey = 'dateDesc';

/** Claves de la query del hash. Cortas: la URL se comparte y se guarda en el historial. */
const KEY = { q: 'q', from: 'desde', to: 'hasta', cat: 'cat', acc: 'cuenta', sign: 'tipo', min: 'min', max: 'max', sort: 'orden' } as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EUROS = /^\d{1,12}(?:[.,]\d{1,2})?$/;
const CENTS_PER_EURO = 100;

export const EMPTY_FILTERS: FilterParams = {
  q: '',
  from: '',
  to: '',
  categoryIds: [],
  accountIds: [],
  sign: 'any',
  min: '',
  max: '',
  sort: DEFAULT_SORT,
};

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

function list(value: string | null): readonly string[] {
  return value ? value.split(',').filter((item) => item !== '') : [];
}

/** Lee los filtros de la URL; los valores desconocidos se ignoran (nunca lanza). */
export function parseFilterParams(search: URLSearchParams): FilterParams {
  return {
    q: search.get(KEY.q) ?? '',
    from: search.get(KEY.from) ?? '',
    to: search.get(KEY.to) ?? '',
    categoryIds: list(search.get(KEY.cat)),
    accountIds: list(search.get(KEY.acc)),
    sign: oneOf(search.get(KEY.sign), SIGNS, 'any'),
    min: search.get(KEY.min) ?? '',
    max: search.get(KEY.max) ?? '',
    sort: oneOf(search.get(KEY.sort), SORT_KEYS, DEFAULT_SORT),
  };
}

/** Serializa solo lo que difiere del valor por defecto (URL corta y estable). */
export function toSearchParams(params: FilterParams): URLSearchParams {
  const entries: [string, string][] = [
    [KEY.q, params.q.trim()],
    [KEY.from, params.from],
    [KEY.to, params.to],
    [KEY.cat, params.categoryIds.join(',')],
    [KEY.acc, params.accountIds.join(',')],
    [KEY.sign, params.sign === 'any' ? '' : params.sign],
    [KEY.min, params.min.trim()],
    [KEY.max, params.max.trim()],
    [KEY.sort, params.sort === DEFAULT_SORT ? '' : params.sort],
  ];
  return new URLSearchParams(entries.filter(([, value]) => value !== ''));
}

/** «12,5» / «12.50» → 1250 céntimos; `null` si está vacío; `undefined` si no es un importe válido. */
export function parseEuros(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!EUROS.test(trimmed)) return undefined;
  return Math.round(Number(trimmed.replace(',', '.')) * CENTS_PER_EURO);
}

export function isValidIsoDate(text: string): boolean {
  if (!ISO_DATE.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

/** Convierte los parámetros en el filtro del caso de uso, descartando lo inválido. */
export function toTransactionFilter(params: FilterParams): TransactionFilter {
  const min = parseEuros(params.min);
  const max = parseEuros(params.max);
  const text = params.q.trim();
  return {
    ...(text === '' ? {} : { text }),
    ...(params.categoryIds.length > 0 ? { categoryIds: params.categoryIds as readonly CategoryId[] } : {}),
    ...(params.accountIds.length > 0 ? { accountIds: params.accountIds as readonly AccountId[] } : {}),
    ...(isValidIsoDate(params.from) ? { from: params.from as IsoDate } : {}),
    ...(isValidIsoDate(params.to) ? { to: params.to as IsoDate } : {}),
    ...(params.sign === 'any' ? {} : { sign: params.sign }),
    ...(typeof min === 'number' ? { minCents: min } : {}),
    ...(typeof max === 'number' ? { maxCents: max } : {}),
  };
}

/** Número de filtros activos (sin contar el orden), para el botón «Filtros (n)». */
export function countActiveFilters(params: FilterParams): number {
  return [
    params.q.trim() !== '',
    params.from !== '',
    params.to !== '',
    params.categoryIds.length > 0,
    params.accountIds.length > 0,
    params.sign !== 'any',
    params.min.trim() !== '',
    params.max.trim() !== '',
  ].filter(Boolean).length;
}

/** Clave estable del filtro + orden (reinicia el scroll de la lista al cambiar). */
export function filterKey(params: FilterParams): string {
  return toSearchParams(params).toString();
}
