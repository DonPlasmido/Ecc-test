import { describe, expect, it } from 'vitest';
import {
  BACKUP_ENVELOPE_VERSION,
  BACKUP_MAGIC,
  DEFAULT_KDF_ITERATIONS,
  GCM_TAG_BYTES,
  IV_BYTES,
  MAX_HEADER_BYTES,
  MAX_KDF_ITERATIONS,
  MIN_KDF_ITERATIONS,
  SALT_BYTES,
  assembleEnvelope,
  buildEnvelopePrefix,
  parseEnvelope,
} from '@/infrastructure/crypto/backupEnvelope';

const textEncoder = new TextEncoder();

function bytes(length: number, fill: number): Uint8Array {
  return new Uint8Array(length).fill(fill);
}

function validParts(iterations = DEFAULT_KDF_ITERATIONS) {
  return { iterations, salt: bytes(SALT_BYTES, 1), iv: bytes(IV_BYTES, 2) };
}

function validEnvelope(iterations = DEFAULT_KDF_ITERATIONS): Uint8Array {
  const prefix = buildEnvelopePrefix(validParts(iterations));
  return assembleEnvelope(prefix, bytes(GCM_TAG_BYTES + 5, 3));
}

/** Construye un sobre con una cabecera JSON arbitraria (para probar el parser estricto). */
function envelopeWithHeader(header: unknown, ciphertext = bytes(GCM_TAG_BYTES, 3)): Uint8Array {
  const json = textEncoder.encode(typeof header === 'string' ? header : JSON.stringify(header));
  const prefix = new Uint8Array(8 + json.length);
  prefix.set(BACKUP_MAGIC, 0);
  new DataView(prefix.buffer).setUint32(4, json.length, false);
  prefix.set(json, 8);
  return assembleEnvelope(prefix, ciphertext);
}

function b64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

function goodHeader() {
  return {
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt: b64(bytes(SALT_BYTES, 1)) },
    cipher: { name: 'AES-GCM', iv: b64(bytes(IV_BYTES, 2)) },
  };
}

function expectErrorCode(result: ReturnType<typeof parseEnvelope>, code: string): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

describe('constantes del sobre', () => {
  it('fija las iteraciones por defecto en 600.000', () => {
    expect(DEFAULT_KDF_ITERATIONS).toBe(600_000);
  });

  it('usa el magic CCBK y versión 1', () => {
    expect(new TextDecoder().decode(BACKUP_MAGIC)).toBe('CCBK');
    expect(BACKUP_ENVELOPE_VERSION).toBe(1);
  });

  it('usa sal de 16 B e IV de 12 B', () => {
    expect(SALT_BYTES).toBe(16);
    expect(IV_BYTES).toBe(12);
  });

  it('deja margen para subir las iteraciones en el futuro', () => {
    expect(MAX_KDF_ITERATIONS).toBeGreaterThan(DEFAULT_KDF_ITERATIONS);
    expect(MIN_KDF_ITERATIONS).toBeLessThanOrEqual(DEFAULT_KDF_ITERATIONS);
  });
});

describe('buildEnvelopePrefix / assembleEnvelope', () => {
  it('empieza por el magic seguido de la longitud de cabecera en uint32 BE', () => {
    const prefix = buildEnvelopePrefix(validParts());

    expect([...prefix.subarray(0, 4)]).toEqual([...BACKUP_MAGIC]);
    const headerLength = new DataView(prefix.buffer, prefix.byteOffset).getUint32(4, false);
    expect(prefix.length).toBe(8 + headerLength);
  });

  it('serializa una cabecera JSON con versión, parámetros KDF y cifrado', () => {
    const prefix = buildEnvelopePrefix(validParts(123_456));

    const header = JSON.parse(new TextDecoder().decode(prefix.subarray(8)));
    expect(header).toMatchObject({
      v: 1,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 123_456 },
      cipher: { name: 'AES-GCM' },
    });
  });

  it('concatena prefijo y ciphertext sin alterarlos', () => {
    const prefix = buildEnvelopePrefix(validParts());
    const ciphertext = bytes(20, 9);

    const envelope = assembleEnvelope(prefix, ciphertext);

    expect(envelope.length).toBe(prefix.length + ciphertext.length);
    expect([...envelope.subarray(0, prefix.length)]).toEqual([...prefix]);
    expect([...envelope.subarray(prefix.length)]).toEqual([...ciphertext]);
  });

  it('rechaza sal o IV con longitud incorrecta al construir', () => {
    expect(() => buildEnvelopePrefix({ ...validParts(), salt: bytes(8, 1) })).toThrow();
    expect(() => buildEnvelopePrefix({ ...validParts(), iv: bytes(16, 1) })).toThrow();
  });
});

describe('parseEnvelope', () => {
  it('recupera los parámetros de un sobre válido (ida y vuelta)', () => {
    const parts = validParts(700_000);
    const prefix = buildEnvelopePrefix(parts);
    const ciphertext = bytes(GCM_TAG_BYTES + 7, 5);

    const result = parseEnvelope(assembleEnvelope(prefix, ciphertext));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.iterations).toBe(700_000);
    expect([...result.value.salt]).toEqual([...parts.salt]);
    expect([...result.value.iv]).toEqual([...parts.iv]);
    expect([...result.value.ciphertext]).toEqual([...ciphertext]);
    expect([...result.value.aad]).toEqual([...prefix]);
  });

  it('acepta un ciphertext de solo la etiqueta (texto en claro vacío)', () => {
    const prefix = buildEnvelopePrefix(validParts());
    const result = parseEnvelope(assembleEnvelope(prefix, bytes(GCM_TAG_BYTES, 0)));
    expect(result.ok).toBe(true);
  });

  it.each([
    ['vacío', new Uint8Array(0)],
    ['solo 3 bytes', textEncoder.encode('CCB')],
    ['solo el magic', BACKUP_MAGIC.slice()],
    ['magic y longitud incompletos', new Uint8Array([0x43, 0x43, 0x42, 0x4b, 0, 0])],
  ])('rechaza un sobre truncado: %s', (_name, input) => {
    expectErrorCode(parseEnvelope(input), 'backup.invalidFormat');
  });

  it('rechaza un sobre cuya cabecera está cortada', () => {
    const envelope = validEnvelope();
    const prefixLength = 8 + new DataView(envelope.buffer).getUint32(4, false);
    expectErrorCode(parseEnvelope(envelope.slice(0, prefixLength - 3)), 'backup.invalidFormat');
  });

  it('rechaza un sobre sin ciphertext', () => {
    const envelope = validEnvelope();
    const prefixLength = 8 + new DataView(envelope.buffer).getUint32(4, false);
    expectErrorCode(parseEnvelope(envelope.slice(0, prefixLength)), 'backup.invalidFormat');
  });

  it('rechaza un ciphertext más corto que la etiqueta GCM', () => {
    const prefix = buildEnvelopePrefix(validParts());
    const result = parseEnvelope(assembleEnvelope(prefix, bytes(GCM_TAG_BYTES - 1, 1)));
    expectErrorCode(result, 'backup.invalidFormat');
  });

  it('rechaza un magic distinto', () => {
    const envelope = validEnvelope();
    envelope[0] = 0x58;
    expectErrorCode(parseEnvelope(envelope), 'backup.invalidFormat');
  });

  it('rechaza una longitud de cabecera mayor que el máximo (anti-DoS)', () => {
    const envelope = validEnvelope();
    new DataView(envelope.buffer).setUint32(4, MAX_HEADER_BYTES + 1, false);
    expectErrorCode(parseEnvelope(envelope), 'backup.invalidFormat');
  });

  it('rechaza una longitud de cabecera de 4 GiB sin reservar memoria', () => {
    const envelope = validEnvelope();
    new DataView(envelope.buffer).setUint32(4, 0xffffffff, false);
    expectErrorCode(parseEnvelope(envelope), 'backup.invalidFormat');
  });

  it('rechaza una longitud de cabecera cero', () => {
    const envelope = validEnvelope();
    new DataView(envelope.buffer).setUint32(4, 0, false);
    expectErrorCode(parseEnvelope(envelope), 'backup.invalidFormat');
  });

  it('rechaza una cabecera que no es JSON', () => {
    expectErrorCode(parseEnvelope(envelopeWithHeader('{no es json')), 'backup.invalidFormat');
  });

  it('rechaza bytes que no son UTF-8 válido en la cabecera', () => {
    const prefix = new Uint8Array(8 + 3);
    prefix.set(BACKUP_MAGIC, 0);
    new DataView(prefix.buffer).setUint32(4, 3, false);
    prefix.set([0xff, 0xfe, 0xfd], 8);
    expectErrorCode(parseEnvelope(assembleEnvelope(prefix, bytes(16, 1))), 'backup.invalidFormat');
  });

  it.each([
    ['null', null],
    ['un array', []],
    ['un número', 5],
    ['un texto', 'hola'],
  ])('rechaza una cabecera JSON que es %s', (_name, header) => {
    expectErrorCode(parseEnvelope(envelopeWithHeader(JSON.stringify(header))), 'backup.invalidFormat');
  });

  it.each([2, 0, 99, -1])('rechaza la versión desconocida %i con unsupportedVersion', (version) => {
    expectErrorCode(parseEnvelope(envelopeWithHeader({ ...goodHeader(), v: version })), 'backup.unsupportedVersion');
  });

  it('informa de versión no soportada aunque el resto de la cabecera sea de otro formato', () => {
    expectErrorCode(parseEnvelope(envelopeWithHeader({ v: 2, algo: 'otro' })), 'backup.unsupportedVersion');
  });

  it.each([
    ['v ausente', (h: Record<string, unknown>) => { delete h.v; }],
    ['v no numérica', (h: Record<string, unknown>) => { h.v = '1'; }],
    ['v decimal', (h: Record<string, unknown>) => { h.v = 1.5; }],
    ['kdf ausente', (h: Record<string, unknown>) => { delete h.kdf; }],
    ['cipher ausente', (h: Record<string, unknown>) => { delete h.cipher; }],
    ['clave desconocida en la raíz', (h: Record<string, unknown>) => { h.extra = 1; }],
    ['kdf nulo', (h: Record<string, unknown>) => { h.kdf = null; }],
    ['cipher es un array', (h: Record<string, unknown>) => { h.cipher = []; }],
  ])('rechaza cabecera malformada: %s', (_name, mutate) => {
    const header = goodHeader() as unknown as Record<string, unknown>;
    mutate(header);
    expectErrorCode(parseEnvelope(envelopeWithHeader(header)), 'backup.invalidFormat');
  });

  it.each([
    ['name distinto', { name: 'scrypt' }],
    ['hash distinto', { hash: 'SHA-1' }],
    ['iteraciones como texto', { iterations: '600000' }],
    ['iteraciones decimales', { iterations: 600_000.5 }],
    ['iteraciones null', { iterations: null }],
    ['sal ausente', { salt: undefined }],
    ['sal no base64', { salt: '!!!!' }],
    ['sal de 8 B', { salt: b64(bytes(8, 1)) }],
    ['sal de 32 B', { salt: b64(bytes(32, 1)) }],
    ['sal base64 no canónico', { salt: `${b64(bytes(SALT_BYTES, 1)).slice(0, -2)}=B` }],
    ['clave desconocida en kdf', { extra: true }],
  ])('rechaza kdf inválido: %s', (_name, patch) => {
    const header = goodHeader();
    Object.assign(header.kdf, patch);
    expectErrorCode(parseEnvelope(envelopeWithHeader(header)), 'backup.invalidFormat');
  });

  it.each([
    ['name distinto', { name: 'AES-CBC' }],
    ['iv ausente', { iv: undefined }],
    ['iv no base64', { iv: '@@@@' }],
    ['iv de 16 B', { iv: b64(bytes(16, 2)) }],
    ['iv de 8 B', { iv: b64(bytes(8, 2)) }],
    ['iv numérico', { iv: 12 }],
    ['clave desconocida en cipher', { tagLength: 64 }],
  ])('rechaza cipher inválido: %s', (_name, patch) => {
    const header = goodHeader();
    Object.assign(header.cipher, patch);
    expectErrorCode(parseEnvelope(envelopeWithHeader(header)), 'backup.invalidFormat');
  });

  it.each([
    ['cero', 0],
    ['negativo', -600_000],
    ['uno', 1],
    ['justo por debajo del mínimo', MIN_KDF_ITERATIONS - 1],
    ['justo por encima del máximo', MAX_KDF_ITERATIONS + 1],
    ['absurdamente alto (DoS)', 4_000_000_000],
    ['Number.MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER],
  ])('rechaza iteraciones fuera de rango: %s', (_name, iterations) => {
    const header = goodHeader();
    header.kdf.iterations = iterations;
    expectErrorCode(parseEnvelope(envelopeWithHeader(header)), 'backup.invalidFormat');
  });

  it('acepta iteraciones en los límites del rango', () => {
    for (const iterations of [MIN_KDF_ITERATIONS, MAX_KDF_ITERATIONS]) {
      const header = goodHeader();
      header.kdf.iterations = iterations;
      expect(parseEnvelope(envelopeWithHeader(header)).ok).toBe(true);
    }
  });

  it('respeta límites de iteraciones inyectados', () => {
    const header = goodHeader();
    header.kdf.iterations = 1000;

    expect(parseEnvelope(envelopeWithHeader(header)).ok).toBe(false);
    expect(parseEnvelope(envelopeWithHeader(header), { min: 1000, max: 5000 }).ok).toBe(true);
    expect(parseEnvelope(envelopeWithHeader(header), { min: 1, max: 999 }).ok).toBe(false);
  });

  it('no filtra el contenido de la cabecera en los errores', () => {
    const header = goodHeader();
    header.kdf.name = 'SECRETO-que-no-debe-salir';
    const result = parseEnvelope(envelopeWithHeader(header));

    expect(JSON.stringify(result)).not.toContain('SECRETO');
  });

  it('no modifica el sobre de entrada', () => {
    const envelope = validEnvelope();
    const copy = envelope.slice();
    parseEnvelope(envelope);
    expect([...envelope]).toEqual([...copy]);
  });

  it('devuelve copias independientes del buffer de entrada', () => {
    const envelope = validEnvelope();
    const result = parseEnvelope(envelope);
    if (!result.ok) throw new Error('esperaba ok');
    const saltBefore = [...result.value.salt];

    envelope.fill(0);

    expect([...result.value.salt]).toEqual(saltBefore);
  });
});
