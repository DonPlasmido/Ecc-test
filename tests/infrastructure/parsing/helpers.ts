import type { RawCell, RawTable } from '@/domain/import/RawTable';
import type { StatementFile } from '@/domain/import/StatementFile';

/** Copia los bytes en un `ArrayBuffer` independiente. */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export function utf8File(name: string, text: string, withBom = false): StatementFile {
  const body = new TextEncoder().encode(text);
  const bytes = withBom ? Uint8Array.from([0xef, 0xbb, 0xbf, ...body]) : body;
  return { name, bytes: toArrayBuffer(bytes) };
}

const CP1252_EXTRA: Readonly<Record<string, number>> = { '€': 0x80 };

/** Codifica texto en Windows-1252 (suficiente para Latin-1 y el euro). */
export function cp1252Bytes(text: string): Uint8Array {
  return Uint8Array.from(Array.from(text, (ch) => CP1252_EXTRA[ch] ?? ch.charCodeAt(0)));
}

export function cp1252File(name: string, text: string): StatementFile {
  return { name, bytes: toArrayBuffer(cp1252Bytes(text)) };
}

export function cellToString(cell: RawCell): string {
  return cell.kind === 'empty' ? '' : String(cell.value);
}

/** Proyecta una tabla cruda a texto para aserciones legibles. */
export function toStrings(table: RawTable): string[][] {
  return table.rows.map((row) => row.map(cellToString));
}
