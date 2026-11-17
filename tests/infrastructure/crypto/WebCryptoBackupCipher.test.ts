import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackupCipherPort } from '@/application/ports/outbound/BackupCipherPort';
import {
  DEFAULT_KDF_ITERATIONS,
  GCM_TAG_BYTES,
  IV_BYTES,
  MAX_KDF_ITERATIONS,
  SALT_BYTES,
  assembleEnvelope,
  buildEnvelopePrefix,
  parseEnvelope,
} from '@/infrastructure/crypto/backupEnvelope';
import { WebCryptoBackupCipher } from '@/infrastructure/crypto/WebCryptoBackupCipher';

const FAST_ITERATIONS = 1000;
const PASSWORD = 'correct horse battery staple';
const ERROR_CODES = ['backup.invalidFormat', 'backup.unsupportedVersion', 'backup.wrongPasswordOrCorrupted'];

function fastCipher(): BackupCipherPort {
  return new WebCryptoBackupCipher({ iterations: FAST_ITERATIONS, iterationLimits: { min: 1, max: MAX_KDF_ITERATIONS } });
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function parsed(envelope: Uint8Array) {
  const result = parseEnvelope(envelope, { min: 1, max: MAX_KDF_ITERATIONS });
  if (!result.ok) throw new Error('sobre inválido');
  return result.value;
}

function flipped(envelope: Uint8Array, index: number): Uint8Array {
  const copy = envelope.slice();
  copy[index] = (copy[index] ?? 0) ^ 0x01;
  return copy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WebCryptoBackupCipher', () => {
  describe('ida y vuelta', () => {
    it('descifra lo que cifró con la misma contraseña', async () => {
      const cipher = fastCipher();
      const plaintext = text('{"transactions":[{"amount":-1250}]}');

      const result = await cipher.decrypt(await cipher.encrypt(plaintext, PASSWORD), PASSWORD);

      expect(result.ok).toBe(true);
      if (result.ok) expect([...result.value]).toEqual([...plaintext]);
    });

    it('admite texto en claro vacío', async () => {
      const cipher = fastCipher();

      const result = await cipher.decrypt(await cipher.encrypt(new Uint8Array(0), PASSWORD), PASSWORD);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });

    it('admite datos binarios grandes (1 MiB)', async () => {
      const cipher = fastCipher();
      const plaintext = new Uint8Array(1024 * 1024);
      for (let i = 0; i < plaintext.length; i += 4096) plaintext[i] = i % 251;

      const result = await cipher.decrypt(await cipher.encrypt(plaintext, PASSWORD), PASSWORD);

      expect(result.ok).toBe(true);
      if (result.ok) expect(Buffer.from(result.value).equals(Buffer.from(plaintext))).toBe(true);
    });

    it('un cifrador con otras iteraciones descifra usando las del sobre', async () => {
      const writer = new WebCryptoBackupCipher({ iterations: 1500, iterationLimits: { min: 1, max: 5000 } });
      const reader = new WebCryptoBackupCipher({ iterations: 1000, iterationLimits: { min: 1, max: 5000 } });
      const plaintext = text('datos');

      const result = await reader.decrypt(await writer.encrypt(plaintext, PASSWORD), PASSWORD);

      expect(result.ok).toBe(true);
    });

    it('no modifica el texto en claro de entrada', async () => {
      const plaintext = text('abc');
      const copy = plaintext.slice();

      await fastCipher().encrypt(plaintext, PASSWORD);

      expect([...plaintext]).toEqual([...copy]);
    });
  });

  describe('parámetros', () => {
    it('usa 600.000 iteraciones por defecto', async () => {
      const deriveKey = vi.spyOn(crypto.subtle, 'deriveKey');

      const envelope = await new WebCryptoBackupCipher().encrypt(text('x'), PASSWORD);

      const params = deriveKey.mock.calls[0]?.[0] as Pbkdf2Params;
      expect(params.iterations).toBe(600_000);
      expect(params.iterations).toBe(DEFAULT_KDF_ITERATIONS);
      expect(params.hash).toBe('SHA-256');
      expect(parsed(envelope).iterations).toBe(600_000);
    });

    it('deriva una clave AES-GCM de 256 bits no extraíble', async () => {
      const deriveKey = vi.spyOn(crypto.subtle, 'deriveKey');

      await fastCipher().encrypt(text('x'), PASSWORD);

      const call = deriveKey.mock.calls[0];
      expect(call?.[2]).toEqual({ name: 'AES-GCM', length: 256 });
      expect(call?.[3]).toBe(false);
    });

    it('escribe sal de 16 B e IV de 12 B', async () => {
      const envelope = await fastCipher().encrypt(text('x'), PASSWORD);
      const { salt, iv, ciphertext } = parsed(envelope);

      expect(salt.length).toBe(SALT_BYTES);
      expect(iv.length).toBe(IV_BYTES);
      expect(ciphertext.length).toBe(1 + GCM_TAG_BYTES);
    });

    it('genera sal e IV distintos en cada cifrado', async () => {
      const cipher = fastCipher();
      const first = parsed(await cipher.encrypt(text('igual'), PASSWORD));
      const second = parsed(await cipher.encrypt(text('igual'), PASSWORD));

      expect(Buffer.from(first.salt).equals(Buffer.from(second.salt))).toBe(false);
      expect(Buffer.from(first.iv).equals(Buffer.from(second.iv))).toBe(false);
      expect(Buffer.from(first.ciphertext).equals(Buffer.from(second.ciphertext))).toBe(false);
    });

    it('rechaza al construir iteraciones no enteras o fuera de límites', () => {
      expect(() => new WebCryptoBackupCipher({ iterations: 0 })).toThrow();
      expect(() => new WebCryptoBackupCipher({ iterations: 1.5 })).toThrow();
      expect(() => new WebCryptoBackupCipher({ iterations: MAX_KDF_ITERATIONS + 1 })).toThrow();
      expect(() => new WebCryptoBackupCipher({ iterations: 1000 })).toThrow();
    });

    it('rechaza cifrar con contraseña vacía', async () => {
      await expect(fastCipher().encrypt(text('x'), '')).rejects.toThrow();
    });
  });

  describe('contraseña incorrecta', () => {
    it('devuelve wrongPasswordOrCorrupted y ningún texto parcial', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('secreto'), PASSWORD);

      const result = await cipher.decrypt(envelope, 'otra contraseña');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toEqual({ code: 'backup.wrongPasswordOrCorrupted' });
      expect(result).not.toHaveProperty('value');
    });

    it('distingue mayúsculas y espacios', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('x'), 'Clave Segura 123');

      expect((await cipher.decrypt(envelope, 'clave segura 123')).ok).toBe(false);
      expect((await cipher.decrypt(envelope, 'Clave Segura 123 ')).ok).toBe(false);
    });

    it('no filtra contraseña ni contenido en el error', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('DATOS-PRIVADOS'), PASSWORD);

      const result = await cipher.decrypt(envelope, 'intento-erroneo');

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('intento-erroneo');
      expect(serialized).not.toContain('DATOS-PRIVADOS');
    });

    it('descifra con contraseña vacía sin lanzar y devuelve error', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('x'), PASSWORD);

      const result = await cipher.decrypt(envelope, '');

      expect(result.ok).toBe(false);
    });
  });

  describe('manipulación', () => {
    it('rechaza cualquier byte alterado en todo el sobre', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('contenido'), PASSWORD);

      for (let index = 0; index < envelope.length; index++) {
        const result = await cipher.decrypt(flipped(envelope, index), PASSWORD);
        expect(result.ok, `byte ${index}`).toBe(false);
        if (!result.ok) expect(ERROR_CODES).toContain(result.error.code);
      }
    });

    it('un byte alterado en el ciphertext da wrongPasswordOrCorrupted', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('contenido'), PASSWORD);

      const result = await cipher.decrypt(flipped(envelope, envelope.length - 1), PASSWORD);

      if (result.ok) throw new Error('esperaba error');
      expect(result.error.code).toBe('backup.wrongPasswordOrCorrupted');
    });

    it('la etiqueta GCM alterada da wrongPasswordOrCorrupted', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('contenido'), PASSWORD);

      const result = await cipher.decrypt(flipped(envelope, envelope.length - GCM_TAG_BYTES), PASSWORD);

      if (result.ok) throw new Error('esperaba error');
      expect(result.error.code).toBe('backup.wrongPasswordOrCorrupted');
    });

    it('un IV intercambiado por otro válido da wrongPasswordOrCorrupted', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('contenido'), PASSWORD);
      const { salt, iv, ciphertext } = parsed(envelope);
      const otherIv = iv.slice();
      otherIv[0] = (otherIv[0] ?? 0) ^ 0xff;
      const forged = assembleEnvelope(buildEnvelopePrefix({ iterations: FAST_ITERATIONS, salt, iv: otherIv }), ciphertext);

      const result = await cipher.decrypt(forged, PASSWORD);

      if (result.ok) throw new Error('esperaba error');
      expect(result.error.code).toBe('backup.wrongPasswordOrCorrupted');
    });

    it('una sal intercambiada por otra válida da wrongPasswordOrCorrupted', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('contenido'), PASSWORD);
      const { salt, iv, ciphertext } = parsed(envelope);
      const otherSalt = salt.slice();
      otherSalt[0] = (otherSalt[0] ?? 0) ^ 0xff;
      const forged = assembleEnvelope(buildEnvelopePrefix({ iterations: FAST_ITERATIONS, salt: otherSalt, iv }), ciphertext);

      const result = await cipher.decrypt(forged, PASSWORD);

      if (result.ok) throw new Error('esperaba error');
      expect(result.error.code).toBe('backup.wrongPasswordOrCorrupted');
    });

    it('unas iteraciones alteradas (cabecera autenticada) dan error', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('contenido'), PASSWORD);
      const { salt, iv, ciphertext } = parsed(envelope);
      const forged = assembleEnvelope(buildEnvelopePrefix({ iterations: FAST_ITERATIONS + 1, salt, iv }), ciphertext);

      const result = await cipher.decrypt(forged, PASSWORD);

      if (result.ok) throw new Error('esperaba error');
      expect(result.error.code).toBe('backup.wrongPasswordOrCorrupted');
    });

    it('rechaza una versión desconocida con unsupportedVersion', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('x'), PASSWORD);
      const prefixLength = 8 + new DataView(envelope.buffer).getUint32(4, false);
      const header = new TextDecoder().decode(envelope.subarray(8, prefixLength)).replace('"v":1', '"v":2');
      const headerBytes = text(header);
      const prefix = new Uint8Array(8 + headerBytes.length);
      prefix.set(envelope.subarray(0, 8));
      new DataView(prefix.buffer).setUint32(4, headerBytes.length, false);
      prefix.set(headerBytes, 8);

      const result = await cipher.decrypt(assembleEnvelope(prefix, envelope.subarray(prefixLength)), PASSWORD);

      if (result.ok) throw new Error('esperaba error');
      expect(result.error.code).toBe('backup.unsupportedVersion');
    });

    it.each([
      ['vacío', () => new Uint8Array(0)],
      ['truncado a la mitad', (e: Uint8Array) => e.slice(0, Math.floor(e.length / 2))],
      ['sin el último byte', (e: Uint8Array) => e.slice(0, -1)],
      ['solo el magic', (e: Uint8Array) => e.slice(0, 4)],
      ['basura aleatoria', () => crypto.getRandomValues(new Uint8Array(200))],
    ])('un sobre %s da error sin lanzar', async (_name, mutate) => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('contenido'), PASSWORD);

      const result = await cipher.decrypt(mutate(envelope), PASSWORD);

      if (result.ok) throw new Error('esperaba error');
      expect(ERROR_CODES).toContain(result.error.code);
    });

    it('un sobre con bytes añadidos al final da error', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('contenido'), PASSWORD);
      const extended = new Uint8Array(envelope.length + 1);
      extended.set(envelope);

      expect((await cipher.decrypt(extended, PASSWORD)).ok).toBe(false);
    });
  });

  describe('iteraciones absurdas (anti-DoS)', () => {
    async function forgedWithIterations(iterations: number): Promise<Uint8Array> {
      const prefix = buildEnvelopePrefix({
        iterations,
        salt: new Uint8Array(SALT_BYTES),
        iv: new Uint8Array(IV_BYTES),
      });
      return assembleEnvelope(prefix, new Uint8Array(GCM_TAG_BYTES));
    }

    it.each([0, 1, 99_999, MAX_KDF_ITERATIONS + 1, 2_000_000_000])(
      'rechaza %i iteraciones con los límites por defecto sin derivar la clave',
      async (iterations) => {
        const deriveKey = vi.spyOn(crypto.subtle, 'deriveKey');

        const result = await new WebCryptoBackupCipher().decrypt(await forgedWithIterations(iterations), PASSWORD);

        if (result.ok) throw new Error('esperaba error');
        expect(result.error.code).toBe('backup.invalidFormat');
        expect(deriveKey).not.toHaveBeenCalled();
      },
    );
  });

  describe('contraseña Unicode', () => {
    const nfc = 'contraseña-Ångström-é'.normalize('NFC');
    const nfd = nfc.normalize('NFD');

    it('las formas NFC y NFD son distintas como cadenas (precondición)', () => {
      expect(nfc).not.toBe(nfd);
    });

    it('cifrar con NFC y descifrar con NFD funciona', async () => {
      const cipher = fastCipher();
      const result = await cipher.decrypt(await cipher.encrypt(text('x'), nfc), nfd);
      expect(result.ok).toBe(true);
    });

    it('cifrar con NFD y descifrar con NFC funciona', async () => {
      const cipher = fastCipher();
      const result = await cipher.decrypt(await cipher.encrypt(text('x'), nfd), nfc);
      expect(result.ok).toBe(true);
    });

    it('admite emojis y caracteres fuera del plano básico', async () => {
      const cipher = fastCipher();
      const password = 'p4ss-🔐-日本語-𝒳';
      const result = await cipher.decrypt(await cipher.encrypt(text('x'), password), password);
      expect(result.ok).toBe(true);
    });

    it('contraseñas que solo difieren en un carácter Unicode no coinciden', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('x'), 'clave-é');
      expect((await cipher.decrypt(envelope, 'clave-è')).ok).toBe(false);
    });
  });

  describe('fallos inesperados de WebCrypto', () => {
    it('decrypt no lanza si WebCrypto falla y devuelve wrongPasswordOrCorrupted', async () => {
      const cipher = fastCipher();
      const envelope = await cipher.encrypt(text('x'), PASSWORD);
      vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(new Error('boom: detalle interno'));

      const result = await cipher.decrypt(envelope, PASSWORD);

      if (result.ok) throw new Error('esperaba error');
      expect(result.error).toEqual({ code: 'backup.wrongPasswordOrCorrupted' });
      expect(JSON.stringify(result)).not.toContain('boom');
    });
  });
});
