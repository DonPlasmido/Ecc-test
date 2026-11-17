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

/** Huella canónica de un movimiento (sin contador de ocurrencia). */
export function baseFingerprint(
  d: Pick<TransactionDraft, 'accountId' | 'date' | 'amount' | 'normalizedDescription' | 'balance'>,
): string {
  return [d.accountId, d.date, d.amount.cents, d.normalizedDescription, d.balance?.cents ?? ''].join(
    DEDUP_FIELD_SEPARATOR,
  );
}

/** Asigna `huella#ocurrencia` a cada borrador; movimientos idénticos reciben #0, #1, #2... */
export function assignDedupKeys(drafts: readonly TransactionDraft[]): readonly KeyedTransactionDraft[] {
  const seen = new Map<string, number>();
  return drafts.map((d) => {
    const fingerprint = baseFingerprint(d);
    const occurrence = seen.get(fingerprint) ?? 0;
    seen.set(fingerprint, occurrence + 1);
    return { ...d, dedupKey: `${fingerprint}${DEDUP_OCCURRENCE_SEPARATOR}${occurrence}` as DedupKey };
  });
}
