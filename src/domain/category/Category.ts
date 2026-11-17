import type { Brand } from '@/domain/shared/brand';

/** Identificador de categoría. */
export type CategoryId = Brand<string, 'CategoryId'>;

/** Categoría centinela "sin categoría"; evita `null` (IndexedDB no indexa `null`). */
export const UNCATEGORIZED = '__uncategorized__' as CategoryId;

/** Naturaleza de la categoría. */
export type CategoryKind = 'expense' | 'income' | 'transfer';

/** Categoría de movimientos. */
export interface Category {
  readonly id: CategoryId;
  /** Editable; las por defecto usan `nameKey` i18n hasta que se editen. */
  readonly name: string;
  readonly nameKey: string | null;
  readonly kind: CategoryKind;
  /** Token de paleta del tema, no hex libre. */
  readonly color: string;
  readonly archived: boolean;
}

// TODO(domain): src/domain/category/defaultCategories.ts (ids estables, nombres vía i18n)
// export const DEFAULT_CATEGORIES: readonly Category[];
