import type { IsoDate } from '@/domain/date/IsoDate';

/** Reloj inyectable (el dominio nunca llama a `Date.now`). */
export interface ClockPort {
  /** ISO datetime. */
  now(): string;
  /** Fecha de hoy en la zona local. */
  today(): IsoDate;
}
