import type { AccountId } from '@/domain/account/Account';
import type { ColumnMapping } from '@/domain/import/ColumnMapping';

/** Mapeo recordado por banco, indexado por firma de cabecera. */
export interface ImportProfile {
  readonly headerSignature: string;
  readonly mapping: ColumnMapping;
  readonly accountId: AccountId | null;
}
