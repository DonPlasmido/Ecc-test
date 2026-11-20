import type { AppSettings } from '@/application/backup/BackupSnapshot';
import type { Account } from '@/domain/account/Account';
import type { Budget } from '@/domain/budget/Budget';
import type { Category } from '@/domain/category/Category';
import type { ImportBatch } from '@/domain/import/ImportBatch';
import type { ImportProfile } from '@/domain/import/ImportProfile';
import type { Rule } from '@/domain/rule/Rule';
import type { Transaction } from '@/domain/transaction/Transaction';

/** Estado compartido por los fakes en memoria de los puertos de persistencia. */
export interface InMemoryState {
  transactions: Map<string, Transaction>;
  importBatches: Map<string, ImportBatch>;
  accounts: Map<string, Account>;
  categories: Map<string, Category>;
  rules: Map<string, Rule>;
  budgets: Map<string, Budget>;
  importProfiles: Map<string, ImportProfile>;
  settings: AppSettings | null;
}

export function createInMemoryState(): InMemoryState {
  return {
    transactions: new Map(),
    importBatches: new Map(),
    accounts: new Map(),
    categories: new Map(),
    rules: new Map(),
    budgets: new Map(),
    importProfiles: new Map(),
    settings: null,
  };
}

/** Copia profunda: igual que IndexedDB, nada se comparte por referencia con el almacén. */
export function copy<T>(value: T): T {
  return structuredClone(value);
}

/** Orden por unidades UTF-16, como las claves de IndexedDB. */
export function compareKeys(a: string | number, b: string | number): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Valores de un mapa ordenados por clave primaria. */
export function valuesByKey<T>(map: ReadonlyMap<string, T>): T[] {
  return [...map.entries()].sort(([a], [b]) => compareKeys(a, b)).map(([, v]) => copy(v));
}
