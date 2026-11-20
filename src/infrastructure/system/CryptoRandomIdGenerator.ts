import type { IdGeneratorPort } from '@/application/ports/outbound/IdGeneratorPort';

/** Identificadores UUID v4 con `crypto.randomUUID`. */
export class CryptoRandomIdGenerator implements IdGeneratorPort {
  constructor(private readonly source: Pick<Crypto, 'randomUUID'> = globalThis.crypto) {}

  next(): string {
    return this.source.randomUUID();
  }
}
