import { deflateRawSync } from 'node:zlib';
import { toArrayBuffer } from './helpers';

export interface ZipEntrySpec {
  readonly name: string;
  /** Contenido real; se comprime con DEFLATE. */
  readonly data?: Uint8Array;
  /** Tamaños declarados en el directorio central (para simular ZIP mentirosos). */
  readonly declared?: { readonly compressed: number; readonly uncompressed: number };
}

function u16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

/** Construye un ZIP mínimo (sin CRC válido: los parsers bajo prueba solo leen el directorio central). */
export function buildZip(entries: readonly ZipEntrySpec[]): ArrayBuffer {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const raw = entry.data ?? new Uint8Array(0);
    const packed = new Uint8Array(deflateRawSync(raw));
    const compressed = entry.declared?.compressed ?? packed.length;
    const uncompressed = entry.declared?.uncompressed ?? raw.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50);
    u16(lv, 4, 20);
    u16(lv, 8, 8);
    u32(lv, 18, packed.length);
    u32(lv, 22, raw.length);
    u16(lv, 26, name.length);
    local.set(name, 30);
    chunks.push(local, packed);

    const head = new Uint8Array(46 + name.length);
    const cv = new DataView(head.buffer);
    u32(cv, 0, 0x02014b50);
    u16(cv, 4, 20);
    u16(cv, 6, 20);
    u16(cv, 10, 8);
    u32(cv, 20, compressed);
    u32(cv, 24, uncompressed);
    u16(cv, 28, name.length);
    u32(cv, 42, offset);
    head.set(name, 46);
    central.push(head);
    offset += local.length + packed.length;
  }
  const centralSize = central.reduce((sum, c) => sum + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  u32(ev, 0, 0x06054b50);
  u16(ev, 8, entries.length);
  u16(ev, 10, entries.length);
  u32(ev, 12, centralSize);
  u32(ev, 16, offset);
  const all = [...chunks, ...central, eocd];
  const out = new Uint8Array(all.reduce((sum, c) => sum + c.length, 0));
  let pos = 0;
  for (const part of all) {
    out.set(part, pos);
    pos += part.length;
  }
  return toArrayBuffer(out);
}
