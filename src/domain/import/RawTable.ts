import type { IsoDate } from '@/domain/date/IsoDate';

/** Celda cruda, independiente del formato de archivo. */
export type RawCell =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number } // número nativo XLSX
  | { readonly kind: 'date'; readonly value: IsoDate } // fecha XLSX convertida en UTC
  | { readonly kind: 'empty' };

/** Tabla cruda producida por cualquier parser. */
export interface RawTable {
  readonly rows: readonly (readonly RawCell[])[];
  readonly sourceName: string;
}
