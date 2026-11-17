import { domainError, type DomainError, type DomainErrorCode } from '@/domain/shared/DomainError';
import { err, ok, type Result } from '@/domain/shared/Result';

/**
 * Sobre binario `.ccbackup` (ADR-0004, architecture §10):
 * `magic "CCBK"` (4 B) · longitud de cabecera (uint32 BE) · cabecera JSON UTF-8 · ciphertext.
 * El "prefijo" (magic + longitud + cabecera) es el `additionalData` de AES-GCM.
 */

export const BACKUP_MAGIC: Uint8Array = new Uint8Array([0x43, 0x43, 0x42, 0x4b]);
export const BACKUP_ENVELOPE_VERSION = 1;
export const KDF_NAME = 'PBKDF2';
export const KDF_HASH = 'SHA-256';
export const CIPHER_NAME = 'AES-GCM';
export const DEFAULT_KDF_ITERATIONS = 600_000;
/** Límites anti-DoS / anti-downgrade para las iteraciones leídas del sobre. */
export const MIN_KDF_ITERATIONS = 100_000;
export const MAX_KDF_ITERATIONS = 2_000_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const GCM_TAG_BYTES = 16;
export const MAX_HEADER_BYTES = 1024;

const LENGTH_FIELD_BYTES = 4;
const PREFIX_FIXED_BYTES = BACKUP_MAGIC.length + LENGTH_FIELD_BYTES;

export interface EnvelopeParts {
  readonly iterations: number;
  readonly salt: Uint8Array;
  readonly iv: Uint8Array;
}

export interface ParsedEnvelope {
  readonly iterations: number;
  readonly salt: Uint8Array<ArrayBuffer>;
  readonly iv: Uint8Array<ArrayBuffer>;
  /** Magic + longitud + cabecera: datos adicionales autenticados. */
  readonly aad: Uint8Array<ArrayBuffer>;
  readonly ciphertext: Uint8Array<ArrayBuffer>;
}

export interface IterationLimits {
  readonly min: number;
  readonly max: number;
}

const DEFAULT_LIMITS: IterationLimits = { min: MIN_KDF_ITERATIONS, max: MAX_KDF_ITERATIONS };

function fail(code: DomainErrorCode): Result<never, DomainError> {
  return err(domainError(code));
}

function toBase64(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Decodifica base64 canónico; `null` si no lo es o la longitud no coincide. */
function fromBase64(text: unknown, expectedLength: number): Uint8Array<ArrayBuffer> | null {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  try {
    const binary = atob(text);
    if (binary.length !== expectedLength) return null;
    const out = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return toBase64(out) === text ? out : null;
  } catch {
    return null;
  }
}

/** Construye magic + longitud + cabecera JSON. Lanza si sal/IV tienen longitud incorrecta (error de programación). */
export function buildEnvelopePrefix(parts: EnvelopeParts): Uint8Array<ArrayBuffer> {
  if (parts.salt.length !== SALT_BYTES) throw new RangeError('invalid salt length');
  if (parts.iv.length !== IV_BYTES) throw new RangeError('invalid iv length');
  const header = {
    v: BACKUP_ENVELOPE_VERSION,
    kdf: { name: KDF_NAME, hash: KDF_HASH, iterations: parts.iterations, salt: toBase64(parts.salt) },
    cipher: { name: CIPHER_NAME, iv: toBase64(parts.iv) },
  };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const prefix = new Uint8Array(PREFIX_FIXED_BYTES + json.length);
  prefix.set(BACKUP_MAGIC, 0);
  new DataView(prefix.buffer).setUint32(BACKUP_MAGIC.length, json.length, false);
  prefix.set(json, PREFIX_FIXED_BYTES);
  return prefix;
}

export function assembleEnvelope(prefix: Uint8Array, ciphertext: Uint8Array): Uint8Array<ArrayBuffer> {
  const envelope = new Uint8Array(prefix.length + ciphertext.length);
  envelope.set(prefix, 0);
  envelope.set(ciphertext, prefix.length);
  return envelope;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(obj, key));
}

function parseHeaderJson(headerBytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(headerBytes));
  } catch {
    return undefined;
  }
}

function parseKdf(kdf: unknown, limits: IterationLimits): { iterations: number; salt: Uint8Array<ArrayBuffer> } | null {
  if (!isPlainObject(kdf) || !hasExactKeys(kdf, ['name', 'hash', 'iterations', 'salt'])) return null;
  if (kdf.name !== KDF_NAME || kdf.hash !== KDF_HASH) return null;
  const { iterations } = kdf;
  if (typeof iterations !== 'number' || !Number.isInteger(iterations)) return null;
  if (iterations < limits.min || iterations > limits.max) return null;
  const salt = fromBase64(kdf.salt, SALT_BYTES);
  return salt ? { iterations, salt } : null;
}

function parseCipher(cipher: unknown): { iv: Uint8Array<ArrayBuffer> } | null {
  if (!isPlainObject(cipher) || !hasExactKeys(cipher, ['name', 'iv'])) return null;
  if (cipher.name !== CIPHER_NAME) return null;
  const iv = fromBase64(cipher.iv, IV_BYTES);
  return iv ? { iv } : null;
}

/** Parser estricto: rechaza cualquier sobre malformado sin lanzar y sin filtrar contenido. */
export function parseEnvelope(
  envelope: Uint8Array,
  limits: IterationLimits = DEFAULT_LIMITS,
): Result<ParsedEnvelope, DomainError> {
  if (envelope.length < PREFIX_FIXED_BYTES) return fail('backup.invalidFormat');
  if (!BACKUP_MAGIC.every((byte, index) => envelope[index] === byte)) return fail('backup.invalidFormat');

  const view = new DataView(envelope.buffer, envelope.byteOffset, envelope.byteLength);
  const headerLength = view.getUint32(BACKUP_MAGIC.length, false);
  if (headerLength === 0 || headerLength > MAX_HEADER_BYTES) return fail('backup.invalidFormat');

  const prefixLength = PREFIX_FIXED_BYTES + headerLength;
  if (envelope.length < prefixLength + GCM_TAG_BYTES) return fail('backup.invalidFormat');

  const header = parseHeaderJson(envelope.subarray(PREFIX_FIXED_BYTES, prefixLength));
  if (!isPlainObject(header) || typeof header.v !== 'number') return fail('backup.invalidFormat');
  if (Number.isInteger(header.v) && header.v !== BACKUP_ENVELOPE_VERSION) return fail('backup.unsupportedVersion');
  if (header.v !== BACKUP_ENVELOPE_VERSION || !hasExactKeys(header, ['v', 'kdf', 'cipher'])) {
    return fail('backup.invalidFormat');
  }

  const kdf = parseKdf(header.kdf, limits);
  const cipher = parseCipher(header.cipher);
  if (!kdf || !cipher) return fail('backup.invalidFormat');

  return ok({
    iterations: kdf.iterations,
    salt: kdf.salt,
    iv: cipher.iv,
    aad: envelope.slice(0, prefixLength),
    ciphertext: envelope.slice(prefixLength),
  });
}
