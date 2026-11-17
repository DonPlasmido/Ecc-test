import type { BackupCipherPort } from '@/application/ports/outbound/BackupCipherPort';
import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';
import {
  DEFAULT_KDF_ITERATIONS,
  GCM_TAG_BYTES,
  IV_BYTES,
  KDF_HASH,
  MAX_KDF_ITERATIONS,
  MIN_KDF_ITERATIONS,
  SALT_BYTES,
  assembleEnvelope,
  buildEnvelopePrefix,
  parseEnvelope,
  type IterationLimits,
} from './backupEnvelope';

export interface WebCryptoBackupCipherOptions {
  /** Iteraciones PBKDF2 al cifrar. Por defecto 600.000. */
  readonly iterations?: number;
  /** Rango aceptado de iteraciones (al construir y al leer sobres). Se rebaja solo en tests. */
  readonly iterationLimits?: IterationLimits;
}

const GCM_TAG_BITS = GCM_TAG_BYTES * 8;

/** PBKDF2-HMAC-SHA-256 → AES-GCM 256 con WebCrypto nativo (ADR-0004). */
export class WebCryptoBackupCipher implements BackupCipherPort {
  private readonly iterations: number;
  private readonly limits: IterationLimits;

  constructor(options: WebCryptoBackupCipherOptions = {}) {
    this.iterations = options.iterations ?? DEFAULT_KDF_ITERATIONS;
    this.limits = options.iterationLimits ?? { min: MIN_KDF_ITERATIONS, max: MAX_KDF_ITERATIONS };
    if (
      !Number.isInteger(this.iterations) ||
      this.iterations < this.limits.min ||
      this.iterations > this.limits.max
    ) {
      throw new RangeError('KDF iterations out of range');
    }
  }

  async encrypt(plaintext: Uint8Array, password: string): Promise<Uint8Array> {
    if (password.length === 0) throw new RangeError('password must not be empty');
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const prefix = buildEnvelopePrefix({ iterations: this.iterations, salt, iv });
    const key = await deriveKey(password, salt, this.iterations);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: prefix, tagLength: GCM_TAG_BITS },
      key,
      new Uint8Array(plaintext),
    );
    return assembleEnvelope(prefix, new Uint8Array(ciphertext));
  }

  async decrypt(envelope: Uint8Array, password: string): Promise<Result<Uint8Array, DomainError>> {
    const parsed = parseEnvelope(envelope, this.limits);
    if (!parsed.ok) return parsed;
    const { salt, iv, iterations, aad, ciphertext } = parsed.value;
    try {
      const key = await deriveKey(password, salt, iterations);
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: aad, tagLength: GCM_TAG_BITS },
        key,
        ciphertext,
      );
      return { ok: true, value: new Uint8Array(plaintext) };
    } catch {
      // Contraseña errónea, sobre manipulado o fallo de WebCrypto: mismo error, sin detalles.
      return { ok: false, error: { code: 'backup.wrongPasswordOrCorrupted' } };
    }
  }
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password.normalize('NFC'));
  const baseKey = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: KDF_HASH, salt, iterations },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
