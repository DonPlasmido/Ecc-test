import type { Transaction } from '@/domain/transaction/Transaction';

/** Detalle opcional de una escritura de movimientos: permite sincronizar el índice sin releer todo. */
export interface DataChange {
  /** Movimientos ya persistidos (nuevos o modificados). No describe borrados. */
  readonly upserted: readonly Transaction[];
}

/** Aviso de cambio de datos. Sin detalle, quien escucha debe reconciliar todo. */
export type DataChangedNotifier = (change?: DataChange) => void;
