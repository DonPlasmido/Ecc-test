import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import type { Account } from '@/domain/account/Account';
import type { Category } from '@/domain/category/Category';
import type { ImportBatch } from '@/domain/import/ImportBatch';
import type { ImportProfile } from '@/domain/import/ImportProfile';
import type { Rule } from '@/domain/rule/Rule';

/** Nombre de la base de datos. */
export const DB_NAME = 'cuentas-claras';
/** Versión actual del esquema (ver `upgradeSchema`). */
export const DB_VERSION = 1;

/** Registro plano de `transactions` (Money en céntimos). */
export interface TransactionRecord {
  id: string;
  accountId: string;
  date: string;
  valueDate: string | null;
  amountCents: number;
  balanceCents: number | null;
  rawDescription: string;
  description: string;
  normalizedDescription: string;
  categoryId: string;
  categorySource: 'none' | 'rule' | 'manual';
  ruleId: string | null;
  note: string;
  dedupKey: string;
  importBatchId: string;
  createdAt: string;
  updatedAt: string;
}

/** Registro plano de `budgets` (Money en céntimos). */
export interface BudgetRecord {
  id: string;
  categoryId: string;
  monthlyLimitCents: number;
  startMonth: string;
  endMonth: string | null;
}

/** Registro de la store `meta` (clave/valor). */
export interface MetaRecord {
  key: string;
  value: unknown;
}

export interface CuentasClarasDB extends DBSchema {
  transactions: {
    key: string;
    value: TransactionRecord;
    indexes: {
      byDedupKey: string;
      byDate: string;
      byAccountDate: [string, string];
      byCategoryDate: [string, string];
      byImportBatch: string;
    };
  };
  accounts: { key: string; value: Account };
  categories: { key: string; value: Category };
  rules: { key: string; value: Rule; indexes: { byPriority: number } };
  budgets: { key: string; value: BudgetRecord; indexes: { byCategory: string } };
  importBatches: { key: string; value: ImportBatch; indexes: { byImportedAt: string } };
  importProfiles: { key: string; value: ImportProfile };
  meta: { key: string; value: MetaRecord };
}

export type CuentasClarasDatabase = IDBPDatabase<CuentasClarasDB>;
export type StoreName = StoreNames<CuentasClarasDB>;

/** Clave de `meta` con los ajustes de la app. */
export const META_SETTINGS_KEY = 'settings';
/** Clave de `meta` con la versión de esquema. */
export const META_SCHEMA_VERSION_KEY = 'schemaVersion';

type UpgradeTx = IDBPTransaction<CuentasClarasDB, StoreName[], 'versionchange'>;

/**
 * Migración acumulativa: cada `case` lleva la base de la versión N-1 a la N y cae al siguiente.
 * Para añadir la v2, agregar `case 1:` antes del `break` final.
 */
export function upgradeSchema(db: CuentasClarasDatabase, oldVersion: number, tx: UpgradeTx): void {
  switch (oldVersion) {
    case 0: {
      const txs = db.createObjectStore('transactions', { keyPath: 'id' });
      txs.createIndex('byDedupKey', 'dedupKey', { unique: true });
      txs.createIndex('byDate', 'date');
      txs.createIndex('byAccountDate', ['accountId', 'date']);
      txs.createIndex('byCategoryDate', ['categoryId', 'date']);
      txs.createIndex('byImportBatch', 'importBatchId');
      db.createObjectStore('accounts', { keyPath: 'id' });
      db.createObjectStore('categories', { keyPath: 'id' });
      db.createObjectStore('rules', { keyPath: 'id' }).createIndex('byPriority', 'priority');
      db.createObjectStore('budgets', { keyPath: 'id' }).createIndex('byCategory', 'categoryId');
      db.createObjectStore('importBatches', { keyPath: 'id' }).createIndex('byImportedAt', 'importedAt');
      db.createObjectStore('importProfiles', { keyPath: 'headerSignature' });
      db.createObjectStore('meta', { keyPath: 'key' });
    }
  }
  void tx.objectStore('meta').put({ key: META_SCHEMA_VERSION_KEY, value: DB_VERSION });
}
