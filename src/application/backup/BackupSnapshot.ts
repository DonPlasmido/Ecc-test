import type { Account } from '@/domain/account/Account';
import type { Budget } from '@/domain/budget/Budget';
import type { Category } from '@/domain/category/Category';
import type { ImportBatch } from '@/domain/import/ImportBatch';
import type { ImportProfile } from '@/domain/import/ImportProfile';
import type { Rule } from '@/domain/rule/Rule';
import type { Transaction } from '@/domain/transaction/Transaction';

/** Versión actual del formato de copia. */
export const BACKUP_FORMAT_VERSION = 1;

/** Idioma de la UI. */
export type AppLocale = 'es' | 'en';

/** Preferencia de tema. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Ajustes guardados en la store `meta`. */
export interface AppSettings {
  readonly locale: AppLocale;
  readonly theme: ThemePreference;
  /** ISO datetime de la última copia exportada; ausente si nunca se exportó. */
  readonly lastBackupAt?: string;
}

/**
 * Contenido completo de la copia (antes de comprimir y cifrar). Se valida entero
 * (esquema, `Money`, `IsoDate`) antes de `replaceAll`.
 */
export interface BackupSnapshot {
  readonly formatVersion: number;
  readonly schemaVersion: number;
  /** ISO datetime. */
  readonly exportedAt: string;
  readonly settings: AppSettings | null;
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly rules: readonly Rule[];
  readonly budgets: readonly Budget[];
  readonly importBatches: readonly ImportBatch[];
  readonly importProfiles: readonly ImportProfile[];
  readonly transactions: readonly Transaction[];
}

// TODO(application): src/application/backup/migrateSnapshot.ts
// export function migrateSnapshot(raw: unknown): Result<BackupSnapshot, DomainError>;
