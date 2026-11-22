import type { Brand } from '@/domain/shared/brand';

/** Identificador de categoría. */
export type CategoryId = Brand<string, 'CategoryId'>;

/** Categoría centinela "sin categoría"; evita `null` (IndexedDB no indexa `null`). */
export const UNCATEGORIZED = '__uncategorized__' as CategoryId;
/** Traspasos entre cuentas propias: no son gasto ni ingreso en el Panel. */
export const TRANSFERS_CATEGORY_ID = 'cat-transfers' as CategoryId;

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
