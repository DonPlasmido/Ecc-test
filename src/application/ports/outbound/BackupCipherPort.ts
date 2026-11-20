import type { DomainError } from '@/domain/shared/DomainError';
import type { Result } from '@/domain/shared/Result';

/** Cifrado de copias con contraseña (AES-GCM 256 + PBKDF2-SHA-256, ADR-0004). */
export interface BackupCipherPort {
  /** Devuelve el sobre binario completo (magic + cabecera + ciphertext). */
  encrypt(plaintext: Uint8Array, password: string): Promise<Uint8Array>;
  /**
   * Errores: `backup.invalidFormat` | `backup.unsupportedVersion` | `backup.wrongPasswordOrCorrupted`
   * (este último no distingue contraseña errónea de archivo dañado).
   */
  decrypt(envelope: Uint8Array, password: string): Promise<Result<Uint8Array, DomainError>>;
}
