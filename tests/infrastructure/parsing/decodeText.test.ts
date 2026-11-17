import { describe, expect, test } from 'vitest';
import { decodeText } from '@/infrastructure/parsing/decodeText';
import { cp1252Bytes, toArrayBuffer } from './helpers';

describe('decodeText', () => {
  test('decodes plain UTF-8 with accents and eñe', () => {
    const bytes = new TextEncoder().encode('Fecha operación;Ñandú');

    expect(decodeText(toArrayBuffer(bytes))).toBe('Fecha operación;Ñandú');
  });

  test('strips the UTF-8 BOM', () => {
    const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('Fecha;Importe')]);

    expect(decodeText(toArrayBuffer(bytes))).toBe('Fecha;Importe');
  });

  test('falls back to Windows-1252 when bytes are not valid UTF-8', () => {
    const bytes = cp1252Bytes('Fecha operación;Descripción;Año');

    expect(decodeText(toArrayBuffer(bytes))).toBe('Fecha operación;Descripción;Año');
  });

  test('decodes the euro sign in Windows-1252', () => {
    expect(decodeText(toArrayBuffer(cp1252Bytes('12,50 €')))).toBe('12,50 €');
  });

  test('returns an empty string for empty input', () => {
    expect(decodeText(new ArrayBuffer(0))).toBe('');
  });

  test('accepts a Uint8Array view as well as an ArrayBuffer', () => {
    expect(decodeText(new TextEncoder().encode('hola'))).toBe('hola');
  });

  test('respects the byteOffset of a Uint8Array view', () => {
    const backing = new TextEncoder().encode('xxhola');

    expect(decodeText(backing.subarray(2))).toBe('hola');
  });

  test('keeps emojis intact when the file is valid UTF-8', () => {
    expect(decodeText(new TextEncoder().encode('Café ☕ 🎉'))).toBe('Café ☕ 🎉');
  });

  test('does not strip a BOM that is not at the start', () => {
    expect(decodeText(new TextEncoder().encode('a﻿b'))).toBe('a﻿b');
  });
});
