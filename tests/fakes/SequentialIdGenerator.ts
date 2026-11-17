import type { IdGeneratorPort } from '@/application/ports/outbound/IdGeneratorPort';

/** Generador determinista: `id-1`, `id-2`, ... */
export class SequentialIdGenerator implements IdGeneratorPort {
  private counter = 0;

  constructor(private readonly prefix = 'id') {}

  next(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}
