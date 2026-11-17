import type { Brand } from '@/domain/shared/brand';
import type { TransactionDraft } from '@/domain/transaction/Transaction';

/**
 * Clave de deduplicación legible (ADR-0010):
 * `${accountId}|${date}|${cents}|${normalizedDescription}|${balanceCents ?? ''}#${occurrence}`.
 */
export type DedupKey = Brand<string, 'DedupKey'>;

/** Separador entre campos de la huella. */
export const DEDUP_FIELD_SEPARATOR = '|';
/** Separador entre huella y contador de ocurrencia. */
export const DEDUP_OCCURRENCE_SEPARATOR = '#';

/** Borrador con su clave de deduplicación asignada. */
export type KeyedTransactionDraft = TransactionDraft & { readonly dedupKey: DedupKey };

// TODO(domain): implementar en este archivo.
// export function baseFingerprint(d: Pick<TransactionDraft,
//   'accountId' | 'date' | 'amount' | 'normalizedDescription' | 'balance'>): string;
// export function assignDedupKeys(drafts: readonly TransactionDraft[]): readonly KeyedTransactionDraft[];
