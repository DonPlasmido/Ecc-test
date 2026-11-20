import { fileURLToPath } from 'node:url'

export const SAMPLE_FILES = [
  'bbva.csv',
  'santander.csv',
  'caixabank.csv',
  'ing.csv',
  'sabadell.csv',
  'bbva.xlsx',
  'ing.xlsx',
] as const

export type SampleFile = (typeof SAMPLE_FILES)[number]

/** Ruta absoluta a un extracto ficticio de public/samples/ (para setInputFiles). */
export function samplePath(name: SampleFile): string {
  return fileURLToPath(new URL(`../../public/samples/${name}`, import.meta.url))
}

/** Cada extracto tiene los mismos movimientos (ver public/samples/README.md). */
export const SAMPLE_TRANSACTION_COUNT = 50
