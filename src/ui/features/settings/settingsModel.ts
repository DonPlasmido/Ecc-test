import { MIN_BACKUP_PASSWORD_LENGTH } from '@/application/ports/inbound/ExportEncryptedBackup';

/** Días sin copia a partir de los que se muestra el recordatorio. */
export const BACKUP_REMINDER_DAYS = 30;
const MS_PER_DAY = 86_400_000;
/** Longitud a partir de la que una contraseña larga cuenta como fuerte aunque tenga pocos tipos de carácter. */
const LONG_PASSWORD_LENGTH = 20;
const STRONG_LENGTH = 16;
const CHARACTER_CLASSES: readonly RegExp[] = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z\d]/];

export type PasswordStrength = 'tooShort' | 'weak' | 'fair' | 'strong';

/**
 * Medidor simple (sin librerías): longitud + variedad de caracteres. Es orientativo; la regla dura
 * es la longitud mínima, que también valida el caso de uso.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_BACKUP_PASSWORD_LENGTH) return 'tooShort';
  if (password.length >= LONG_PASSWORD_LENGTH) return 'strong';
  const classes = CHARACTER_CLASSES.filter((pattern) => pattern.test(password)).length;
  if (password.length >= STRONG_LENGTH && classes >= 3) return 'strong';
  if (classes >= 3 || password.length >= STRONG_LENGTH) return 'fair';
  return 'weak';
}

/** Nivel 0..3 del medidor (para la barra visual). */
export const STRENGTH_LEVEL: Readonly<Record<PasswordStrength, number>> = { tooShort: 0, weak: 1, fair: 2, strong: 3 };

export type PasswordProblem =
  | { readonly kind: 'tooShort'; readonly missing: number }
  | { readonly kind: 'mismatch' };

/** Valida la pareja contraseña / confirmación; `null` si es válida. */
export function exportPasswordProblem(password: string, confirmation: string): PasswordProblem | null {
  if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
    return { kind: 'tooShort', missing: MIN_BACKUP_PASSWORD_LENGTH - password.length };
  }
  if (password !== confirmation) return { kind: 'mismatch' };
  return null;
}

export type BackupAge =
  | { readonly kind: 'never' }
  | { readonly kind: 'recent'; readonly days: number }
  | { readonly kind: 'overdue'; readonly days: number };

/** Antigüedad de la última copia respecto a `nowMs`; `overdue` si supera el recordatorio. */
export function backupAge(lastBackupAt: string | undefined, nowMs: number): BackupAge {
  const last = lastBackupAt ? Date.parse(lastBackupAt) : Number.NaN;
  if (Number.isNaN(last)) return { kind: 'never' };
  const days = Math.max(0, Math.floor((nowMs - last) / MS_PER_DAY));
  return days > BACKUP_REMINDER_DAYS ? { kind: 'overdue', days } : { kind: 'recent', days };
}

/** Descarga los bytes como archivo (Blob + enlace temporal) y libera la URL. */
export function downloadFile(fileName: string, bytes: Uint8Array, doc: Document = document): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.hidden = true;
  doc.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Se revoca en la siguiente vuelta: algunos navegadores leen la URL tras el `click`.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;
const BYTES_PER_UNIT = 1024;

/** Tamaño legible con `Intl` («1,5 MB», «2 GB»). */
export function formatBytes(bytes: number, locale: string): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit += 1;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: BYTE_UNITS[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
}

/** Palabra que hay que teclear para borrar todos los datos (comparación sin mayúsculas ni espacios). */
export function matchesConfirmWord(typed: string, word: string): boolean {
  return typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();
}
