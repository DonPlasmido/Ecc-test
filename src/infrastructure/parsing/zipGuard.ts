import type { DomainError } from '@/domain/shared/DomainError';
import type { Err } from '@/domain/shared/Result';
import { MAX_UNCOMPRESSED_BYTES, MAX_ZIP_ENTRIES, MAX_ZIP_RATIO } from './limits';
import { failure } from './parseResult';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_MIN_BYTES = 22;
const EOCD_MAX_SEARCH = EOCD_MIN_BYTES + 0xffff;
const CENTRAL_HEADER_BYTES = 46;
const ZIP64_MARKER_16 = 0xffff;
const ZIP64_MARKER_32 = 0xffffffff;

function findEndOfCentralDirectory(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - EOCD_MAX_SEARCH);
  for (let pos = view.byteLength - EOCD_MIN_BYTES; pos >= lowest; pos -= 1) {
    if (view.getUint32(pos, true) === EOCD_SIGNATURE) return pos;
  }
  return -1;
}

const tooManyEntries = () => failure('import.unsupportedFormat', { field: 'entries', expected: MAX_ZIP_ENTRIES });
const tooBig = () => failure('import.unsupportedFormat', { field: 'uncompressedSize', expected: MAX_UNCOMPRESSED_BYTES });
const badRatio = () => failure('import.unsupportedFormat', { field: 'ratio', expected: MAX_ZIP_RATIO });

/**
 * Inspecciona el directorio central del ZIP sin descomprimir nada y rechaza bombas de descompresión:
 * demasiadas entradas, suma descomprimida declarada excesiva o ratio sospechoso en alguna entrada.
 * Devuelve `null` si el archivo es aceptable.
 */
export function inspectZip(bytes: ArrayBuffer): Err<DomainError> | null {
  const view = new DataView(bytes);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) return failure('import.corruptFile');

  const entryCount = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (entryCount === ZIP64_MARKER_16 || centralOffset === ZIP64_MARKER_32 || entryCount > MAX_ZIP_ENTRIES) {
    return tooManyEntries();
  }

  let pos = centralOffset;
  let total = 0;
  for (let i = 0; i < entryCount; i += 1) {
    if (pos + CENTRAL_HEADER_BYTES > view.byteLength || view.getUint32(pos, true) !== CENTRAL_SIGNATURE) {
      return failure('import.corruptFile');
    }
    const compressed = view.getUint32(pos + 20, true);
    const uncompressed = view.getUint32(pos + 24, true);
    if (compressed === ZIP64_MARKER_32 || uncompressed === ZIP64_MARKER_32) return tooBig();
    if (uncompressed > Math.max(compressed, 1) * MAX_ZIP_RATIO) return badRatio();
    total += uncompressed;
    if (total > MAX_UNCOMPRESSED_BYTES) return tooBig();
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    pos += CENTRAL_HEADER_BYTES + nameLen + extraLen + commentLen;
  }
  return null;
}
