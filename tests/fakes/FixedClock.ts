import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { IsoDate } from '@/domain/date/IsoDate';

/** Reloj determinista: `now()` y `today()` fijos hasta que se llama a `set`. */
export class FixedClock implements ClockPort {
  constructor(private current = '2026-03-15T10:00:00.000Z') {}

  set(isoDateTime: string): void {
    this.current = isoDateTime;
  }

  now(): string {
    return this.current;
  }

  today(): IsoDate {
    return this.current.slice(0, 10) as IsoDate;
  }
}
