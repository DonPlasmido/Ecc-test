/** Generador de identificadores únicos (el llamador aplica el brand). */
export interface IdGeneratorPort {
  next(): string;
}
