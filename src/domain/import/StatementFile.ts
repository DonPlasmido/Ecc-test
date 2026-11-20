/** Archivo de extracto tal como lo entrega la UI (sin decodificar). */
export interface StatementFile {
  readonly name: string;
  readonly bytes: ArrayBuffer;
}
