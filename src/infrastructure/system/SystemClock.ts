import type { ClockPort } from '@/application/ports/outbound/ClockPort';
import type { IsoDate } from '@/domain/date/IsoDate';

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/** Reloj del sistema; `today()` usa la zona horaria local. */
export class SystemClock implements ClockPort {
  constructor(private readonly currentDate: () => Date = () => new Date()) {}

  now(): string {
    return this.currentDate().toISOString();
  }

  today(): IsoDate {
    const d = this.currentDate();
    return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}` as IsoDate;
  }
}
