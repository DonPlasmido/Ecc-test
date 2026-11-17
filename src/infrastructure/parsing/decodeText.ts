const UTF8_BOM = '﻿';

/**
 * Decodifica bytes de un extracto: UTF-8 estricto (con o sin BOM) y, si hay bytes
 * inválidos, Windows-1252 (habitual en bancos españoles).
 */
export function decodeText(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
  return text.startsWith(UTF8_BOM) ? text.slice(1) : text;
}
