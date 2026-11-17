import type {
  TransactionFilter,
  TransactionSortKey,
} from '@/application/ports/inbound/QueryTransactions';
import { firstDayOfMonthNumber, monthFromNumber, monthNumber } from '@/application/read-model/monthMath';
import type { AccountId } from '@/domain/account/Account';
import type { CategoryId } from '@/domain/category/Category';
import { IsoDate } from '@/domain/date/IsoDate';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Cents, Money } from '@/domain/money/Money';
import { normalizeText } from '@/domain/shared/normalizeText';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';

/** Ingresos y gastos agregados de una celda mes × categoría (`expense` en valor absoluto, ≥ 0). */
export interface IncomeExpenseTotals {
  readonly income: Money;
  readonly expense: Money;
}

/** Totales por mes y categoría. */
export type MonthCategoryTotals = ReadonlyMap<YearMonth, ReadonlyMap<CategoryId, IncomeExpenseTotals>>;

/** Predicado de bajo nivel sobre columnas del índice (sin crear objetos). */
export type IndexRowPredicate = (
  normalizedDescription: string,
  cents: number,
  accountIdx: number,
) => boolean;

/** Saldo de una cuenta calculado por el índice. */
export interface IndexAccountBalance {
  readonly accountId: AccountId;
  readonly balance: Money;
  /** Fecha del movimiento más reciente de la cuenta. */
  readonly asOf: IsoDate;
  /** `false` solo si el movimiento más reciente trae el saldo del extracto. */
  readonly estimated: boolean;
}

/**
 * Índice columnar en memoria (ADR-0009). Sin E/S; mutable por dentro de forma encapsulada,
 * hacia fuera solo resultados inmutables y `version`.
 */
export interface TransactionIndex {
  /** Durante el arranque, por lotes. */
  hydrate(batch: readonly Transaction[]): void;
  applyUpserts(txs: readonly Transaction[]): void;
  applyDeletes(ids: readonly TransactionId[]): void;
  /**
   * Posiciones ordenadas de las filas que cumplen el filtro (AND de todos los campos). Listas vacías de
   * categorías o cuentas no filtran; `minCents`/`maxCents` comparan el importe en valor absoluto.
   */
  filter(f: TransactionFilter, sort: TransactionSortKey): Uint32Array;
  idsAt(positions: Uint32Array, offset: number, limit: number): readonly TransactionId[];
  sumAt(positions: Uint32Array): Money;
  totalsByMonthAndCategory(
    from: YearMonth,
    to: YearMonth,
    accountIds?: readonly AccountId[],
  ): MonthCategoryTotals;
  /** Saldo por cuenta (último saldo conocido más importes posteriores). */
  latestBalances(accountIds?: readonly AccountId[]): readonly IndexAccountBalance[];
  countMatching(predicate: IndexRowPredicate): number;
  /** Avisa tras cada cambio; devuelve la función para cancelar. */
  onChange(listener: () => void): () => void;
  readonly size: number;
  /** Se incrementa en cada cambio. */
  readonly version: number;
}

const INITIAL_CAPACITY = 1024;
const BULK_UPSERT_THRESHOLD = 256;
const MAX_SYMBOLS = 0xffff;
const SLOT_RANGE = 4_294_967_296;
const DAY_OFFSET = 1 << 20;
const NO_BALANCE = Number.NaN;

class SymbolTable {
  private readonly indexByName = new Map<string, number>();
  readonly names: string[] = [];

  intern(name: string): number {
    const known = this.indexByName.get(name);
    if (known !== undefined) return known;
    if (this.names.length >= MAX_SYMBOLS) throw new RangeError('Too many distinct accounts or categories');
    this.indexByName.set(name, this.names.length);
    this.names.push(name);
    return this.names.length - 1;
  }

  /** Máscara de pertenencia, o `null` si no hay filtro. Máscara vacía = nada coincide. */
  mask(wanted: readonly string[] | undefined): Uint8Array | null {
    if (wanted === undefined || wanted.length === 0) return null;
    const mask = new Uint8Array(this.names.length);
    for (const name of wanted) {
      const idx = this.indexByName.get(name);
      if (idx !== undefined) mask[idx] = 1;
    }
    return mask;
  }

  get size(): number {
    return this.names.length;
  }
}

function hasAny(mask: Uint8Array): boolean {
  return mask.includes(1);
}

class ColumnarTransactionIndex implements TransactionIndex {
  private capacity = INITIAL_CAPACITY;
  private epochDay = new Int32Array(INITIAL_CAPACITY);
  private monthKey = new Int32Array(INITIAL_CAPACITY);
  private cents = new Float64Array(INITIAL_CAPACITY);
  private balance = new Float64Array(INITIAL_CAPACITY);
  private categoryIdx = new Uint16Array(INITIAL_CAPACITY);
  private accountIdx = new Uint16Array(INITIAL_CAPACITY);
  private alive = new Uint8Array(INITIAL_CAPACITY);
  private order = new Uint32Array(INITIAL_CAPACITY);
  private orderLength = 0;
  private orderDirty = false;
  private readonly ids: string[] = [];
  private readonly normalized: string[] = [];
  private readonly searchText: string[] = [];
  private readonly slotById = new Map<string, number>();
  private readonly freeSlots: number[] = [];
  private usedSlots = 0;
  private readonly categories = new SymbolTable();
  private readonly accounts = new SymbolTable();
  private readonly listeners = new Set<() => void>();
  private changeCount = 0;

  get size(): number {
    return this.slotById.size;
  }

  get version(): number {
    return this.changeCount;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  hydrate(batch: readonly Transaction[]): void {
    this.upsertAll(batch, true);
  }

  applyUpserts(txs: readonly Transaction[]): void {
    this.upsertAll(txs, txs.length > BULK_UPSERT_THRESHOLD);
  }

  applyDeletes(ids: readonly TransactionId[]): void {
    let removed = 0;
    for (const id of ids) {
      const slot = this.slotById.get(id);
      if (slot === undefined) continue;
      if (!this.orderDirty) this.orderRemove(slot);
      this.alive[slot] = 0;
      this.ids[slot] = '';
      this.normalized[slot] = '';
      this.searchText[slot] = '';
      this.slotById.delete(id);
      this.freeSlots.push(slot);
      removed += 1;
    }
    if (removed > 0) this.bump();
  }

  filter(f: TransactionFilter, sort: TransactionSortKey): Uint32Array {
    this.ensureOrder();
    const categoryMask = this.categories.mask(f.categoryIds);
    const accountMask = this.accounts.mask(f.accountIds);
    if ((categoryMask && !hasAny(categoryMask)) || (accountMask && !hasAny(accountMask))) {
      return new Uint32Array(0);
    }
    const lo = f.from === undefined ? 0 : this.lowerBoundDay(IsoDate.toEpochDay(f.from));
    const hi = f.to === undefined ? this.orderLength : this.lowerBoundDay(IsoDate.toEpochDay(f.to) + 1);
    if (lo >= hi) return new Uint32Array(0);
    const text = f.text === undefined ? '' : normalizeText(f.text);
    const rows = this.scanRange(lo, hi, f, text, categoryMask, accountMask, sort !== 'dateAsc');
    if (sort === 'amountDesc' || sort === 'amountAsc') this.sortByAmount(rows, sort === 'amountDesc');
    return rows;
  }

  idsAt(positions: Uint32Array, offset: number, limit: number): readonly TransactionId[] {
    const start = Math.max(0, offset);
    const end = Math.min(positions.length, start + Math.max(0, limit));
    const result: TransactionId[] = [];
    for (let i = start; i < end; i += 1) result.push(this.ids[positions[i] as number] as TransactionId);
    return result;
  }

  sumAt(positions: Uint32Array): Money {
    let total = 0;
    for (let i = 0; i < positions.length; i += 1) total += this.cents[positions[i] as number] as number;
    return { cents: (total === 0 ? 0 : total) as Cents };
  }

  totalsByMonthAndCategory(
    from: YearMonth,
    to: YearMonth,
    accountIds?: readonly AccountId[],
  ): MonthCategoryTotals {
    this.ensureOrder();
    const firstMonth = monthNumber(from);
    const lastMonth = monthNumber(to);
    const accountMask = this.accounts.mask(accountIds);
    const result = new Map<YearMonth, Map<CategoryId, IncomeExpenseTotals>>();
    if (firstMonth > lastMonth || (accountMask && !hasAny(accountMask))) return result;
    const lo = this.lowerBoundDay(IsoDate.toEpochDay(firstDayOfMonthNumber(firstMonth) as IsoDate));
    const hi = this.lowerBoundDay(IsoDate.toEpochDay(firstDayOfMonthNumber(lastMonth + 1) as IsoDate));
    const cells = this.accumulateCells(lo, hi, firstMonth, lastMonth - firstMonth + 1, accountMask);
    for (const [cell, amounts] of [...cells.entries()].sort((a, b) => a[0] - b[0])) {
      const categoryCount = this.categories.size;
      const month = monthFromNumber(firstMonth + Math.floor(cell / categoryCount));
      const categoryId = this.categories.names[cell % categoryCount] as CategoryId;
      let byCategory = result.get(month);
      if (!byCategory) {
        byCategory = new Map();
        result.set(month, byCategory);
      }
      byCategory.set(categoryId, { income: { cents: amounts[0] as Cents }, expense: { cents: amounts[1] as Cents } });
    }
    return result;
  }

  latestBalances(accountIds?: readonly AccountId[]): readonly IndexAccountBalance[] {
    this.ensureOrder();
    const mask = this.accounts.mask(accountIds);
    if (mask && !hasAny(mask)) return [];
    const count = this.accounts.size;
    const state = {
      seen: new Uint8Array(count),
      resolved: new Uint8Array(count),
      later: new Float64Array(count),
      laterRows: new Uint32Array(count),
      balance: new Float64Array(count),
      asOf: new Int32Array(count),
    };
    const wanted = mask ? mask.reduce((n, v) => n + v, 0) : count;
    let resolved = 0;
    for (let pos = this.orderLength - 1; pos >= 0 && resolved < wanted; pos -= 1) {
      const slot = this.order[pos] as number;
      const account = this.accountIdx[slot] as number;
      if (mask && mask[account] === 0) continue;
      if (state.resolved[account] === 1) continue;
      if (state.seen[account] === 0) {
        state.seen[account] = 1;
        state.asOf[account] = this.epochDay[slot] as number;
      }
      const known = this.balance[slot] as number;
      if (Number.isNaN(known)) {
        state.later[account] = (state.later[account] as number) + (this.cents[slot] as number);
        state.laterRows[account] = (state.laterRows[account] as number) + 1;
        continue;
      }
      state.balance[account] = known;
      state.resolved[account] = 1;
      resolved += 1;
    }
    return this.collectBalances(state, mask);
  }

  countMatching(predicate: IndexRowPredicate): number {
    let count = 0;
    for (let slot = 0; slot < this.usedSlots; slot += 1) {
      if (this.alive[slot] === 1 && predicate(this.normalized[slot] as string, this.cents[slot] as number, this.accountIdx[slot] as number)) {
        count += 1;
      }
    }
    return count;
  }

  private collectBalances(
    state: {
      seen: Uint8Array;
      resolved: Uint8Array;
      later: Float64Array;
      laterRows: Uint32Array;
      balance: Float64Array;
      asOf: Int32Array;
    },
    mask: Uint8Array | null,
  ): IndexAccountBalance[] {
    const result: IndexAccountBalance[] = [];
    for (let account = 0; account < state.seen.length; account += 1) {
      if (state.seen[account] === 0 || (mask && mask[account] === 0)) continue;
      const resolvedBalance = state.resolved[account] === 1;
      const total = (resolvedBalance ? (state.balance[account] as number) : 0) + (state.later[account] as number);
      result.push({
        accountId: this.accounts.names[account] as AccountId,
        balance: { cents: (total === 0 ? 0 : total) as Cents },
        asOf: IsoDate.fromEpochDay(state.asOf[account] as number),
        estimated: !resolvedBalance || (state.laterRows[account] as number) > 0,
      });
    }
    return result;
  }

  /** Acumula [ingresos, gastos] por celda `mes × categoría`; solo celdas con movimientos. */
  private accumulateCells(
    lo: number,
    hi: number,
    firstMonth: number,
    monthCount: number,
    accountMask: Uint8Array | null,
  ): Map<number, [number, number]> {
    const categoryCount = this.categories.size;
    const income = new Float64Array(monthCount * categoryCount);
    const expense = new Float64Array(monthCount * categoryCount);
    const touched = new Uint8Array(monthCount * categoryCount);
    for (let pos = lo; pos < hi; pos += 1) {
      const slot = this.order[pos] as number;
      if (accountMask && accountMask[this.accountIdx[slot] as number] === 0) continue;
      const cell = ((this.monthKey[slot] as number) - firstMonth) * categoryCount + (this.categoryIdx[slot] as number);
      const value = this.cents[slot] as number;
      touched[cell] = 1;
      if (value < 0) expense[cell] = (expense[cell] as number) - value;
      else income[cell] = (income[cell] as number) + value;
    }
    const cells = new Map<number, [number, number]>();
    for (let cell = 0; cell < touched.length; cell += 1) {
      if (touched[cell] === 1) cells.set(cell, [income[cell] as number, expense[cell] as number]);
    }
    return cells;
  }

  private scanRange(
    lo: number,
    hi: number,
    f: TransactionFilter,
    text: string,
    categoryMask: Uint8Array | null,
    accountMask: Uint8Array | null,
    descending: boolean,
  ): Uint32Array {
    const out = new Uint32Array(hi - lo);
    const signMode = f.sign === 'expense' ? -1 : f.sign === 'income' ? 1 : 0;
    const min = f.minCents ?? 0;
    const max = f.maxCents ?? Number.POSITIVE_INFINITY;
    const { cents, order, categoryIdx, accountIdx, searchText } = this;
    let count = 0;
    for (let step = 0; step < hi - lo; step += 1) {
      const slot = order[descending ? hi - 1 - step : lo + step] as number;
      const value = cents[slot] as number;
      if (signMode === -1 ? value >= 0 : signMode === 1 && value <= 0) continue;
      const magnitude = value < 0 ? -value : value;
      if (magnitude < min || magnitude > max) continue;
      if (categoryMask && categoryMask[categoryIdx[slot] as number] === 0) continue;
      if (accountMask && accountMask[accountIdx[slot] as number] === 0) continue;
      if (text !== '' && !(searchText[slot] as string).includes(text)) continue;
      out[count] = slot;
      count += 1;
    }
    return out.slice(0, count);
  }

  private sortByAmount(rows: Uint32Array, descending: boolean): void {
    const { cents } = this;
    rows.sort((a, b) => (descending ? (cents[b] as number) - (cents[a] as number) : (cents[a] as number) - (cents[b] as number)));
  }

  private upsertAll(txs: readonly Transaction[], deferOrder: boolean): void {
    if (txs.length === 0) return;
    if (deferOrder) this.orderDirty = true;
    for (const tx of txs) this.put(tx);
    this.bump();
  }

  private put(tx: Transaction): void {
    const existing = this.slotById.get(tx.id);
    const newDay = IsoDate.toEpochDay(tx.date);
    if (existing !== undefined) {
      const dayChanged = (this.epochDay[existing] as number) !== newDay;
      if (dayChanged && !this.orderDirty) this.orderRemove(existing);
      this.writeRow(existing, tx, newDay);
      if (dayChanged && !this.orderDirty) this.orderInsert(existing);
      return;
    }
    const slot = this.freeSlots.pop() ?? this.allocateSlot();
    this.writeRow(slot, tx, newDay);
    this.slotById.set(tx.id, slot);
    if (!this.orderDirty) this.orderInsert(slot);
  }

  private allocateSlot(): number {
    if (this.usedSlots === this.capacity) this.grow();
    this.usedSlots += 1;
    return this.usedSlots - 1;
  }

  private writeRow(slot: number, tx: Transaction, day: number): void {
    this.epochDay[slot] = day;
    this.monthKey[slot] = Number(tx.date.slice(0, 4)) * 12 + Number(tx.date.slice(5, 7)) - 1;
    this.cents[slot] = tx.amount.cents;
    this.balance[slot] = tx.balance === null ? NO_BALANCE : tx.balance.cents;
    this.categoryIdx[slot] = this.categories.intern(tx.categoryId);
    this.accountIdx[slot] = this.accounts.intern(tx.accountId);
    this.alive[slot] = 1;
    this.ids[slot] = tx.id;
    this.normalized[slot] = tx.normalizedDescription;
    // Sin edición del usuario la descripción es la original: ya está normalizada, no se repite el trabajo.
    const edited = tx.description === tx.rawDescription ? tx.normalizedDescription : normalizeText(tx.description);
    this.searchText[slot] =
      edited === tx.normalizedDescription ? edited : `${tx.normalizedDescription}\n${edited}`;
  }

  private grow(): void {
    const next = this.capacity * 2;
    this.epochDay = growTyped(this.epochDay, next, Int32Array);
    this.monthKey = growTyped(this.monthKey, next, Int32Array);
    this.cents = growTyped(this.cents, next, Float64Array);
    this.balance = growTyped(this.balance, next, Float64Array);
    this.categoryIdx = growTyped(this.categoryIdx, next, Uint16Array);
    this.accountIdx = growTyped(this.accountIdx, next, Uint16Array);
    this.alive = growTyped(this.alive, next, Uint8Array);
    this.order = growTyped(this.order, next, Uint32Array);
    this.capacity = next;
  }

  private bump(): void {
    this.changeCount += 1;
    for (const listener of [...this.listeners]) listener();
  }

  private ensureOrder(): void {
    if (!this.orderDirty) return;
    const keys = new Float64Array(this.slotById.size);
    let n = 0;
    for (let slot = 0; slot < this.usedSlots; slot += 1) {
      if (this.alive[slot] === 1) {
        keys[n] = ((this.epochDay[slot] as number) + DAY_OFFSET) * SLOT_RANGE + slot;
        n += 1;
      }
    }
    keys.sort();
    for (let i = 0; i < n; i += 1) this.order[i] = (keys[i] as number) % SLOT_RANGE;
    this.orderLength = n;
    this.orderDirty = false;
  }

  /** Primera posición cuyo día es ≥ `day`. */
  private lowerBoundDay(day: number): number {
    let lo = 0;
    let hi = this.orderLength;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((this.epochDay[this.order[mid] as number] as number) < day) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Primera posición cuya clave (día, slot) es ≥ la dada. */
  private lowerBoundKey(day: number, slot: number): number {
    let lo = 0;
    let hi = this.orderLength;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const midSlot = this.order[mid] as number;
      const midDay = this.epochDay[midSlot] as number;
      if (midDay < day || (midDay === day && midSlot < slot)) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private orderInsert(slot: number): void {
    const pos = this.lowerBoundKey(this.epochDay[slot] as number, slot);
    this.order.copyWithin(pos + 1, pos, this.orderLength);
    this.order[pos] = slot;
    this.orderLength += 1;
  }

  private orderRemove(slot: number): void {
    const pos = this.lowerBoundKey(this.epochDay[slot] as number, slot);
    this.order.copyWithin(pos, pos + 1, this.orderLength);
    this.orderLength -= 1;
  }
}

interface TypedArrayCtor<T> {
  new (length: number): T;
}

function growTyped<T extends { set(source: T): void }>(old: T, length: number, ctor: TypedArrayCtor<T>): T {
  const next = new ctor(length);
  next.set(old);
  return next;
}

/** Crea un índice vacío (equivale a `TransactionIndex.empty()`). */
export function createTransactionIndex(): TransactionIndex {
  return new ColumnarTransactionIndex();
}
