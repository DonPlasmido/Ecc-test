import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { stat } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import type { TransactionsScreen } from './pages/transactionsPage'

/** Límites de importación de la app (src/infrastructure/parsing/limits.ts). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_ROWS = 200_000

export const TOTAL_ROWS = Number(process.env.E2E_ROWS ?? 100_000)
/** AC-031: filas `[role=row]` en el DOM (sin contar la cabecera). */
export const MAX_DOM_ROWS = 100
/** AC-033: presupuesto de la búsqueda tras el debounce. */
export const SEARCH_BUDGET_MS = 200
/** AC-033: ralentización de CPU emulada para la búsqueda (equivale a un móvil de gama baja). */
export const CPU_SLOWDOWN = 4
/** Tope razonable para importar 100k filas por la UI (el aviso de > 90 s se documenta en docs/TESTS.md). */
export const IMPORT_100K_TIMEOUT_MS = 60_000

const MERCHANTS = [
  'MERCADONA',
  'REPSOL',
  'NETFLIX.COM',
  'FARMACIA GARCIA',
  'RESTAURANTE LA PLAZA',
  'AMAZON EU SARL',
  'ENDESA ENERGIA',
  'CAFETERIA EL RINCON',
  'SPOTIFY AB',
  'DECATHLON',
]
export const SEARCH_TERMS = ['mercadona', 'repsol', 'farmacia', 'endesa', 'amazon', 'cafeteria', 'decathlon', 'spotify', 'restaurante', 'netflix']

const pad = (value: number, size = 2) => String(value).padStart(size, '0')

/** Generador determinista (mulberry32) para que el extracto sea idéntico en cada ejecución. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Escribe un extracto sintético con el formato de Santander (`public/samples/santander.csv`):
 * `Fecha Operación;Fecha Valor;Concepto;Importe;Divisa;Saldo;Divisa`, fechas `dd-mm-aaaa`, importes con coma.
 * Cada concepto lleva un número de operación único para que la deduplicación no descarte filas.
 */
export async function writeSyntheticStatement(path: string, rows: number): Promise<{ bytes: number }> {
  const random = seededRandom(20260101)
  const stream = createWriteStream(path, { encoding: 'utf8' })
  stream.write('Fecha Operación;Fecha Valor;Concepto;Importe;Divisa;Saldo;Divisa\n')
  let balanceCents = 500_000
  for (let index = 0; index < rows; index += 1) {
    const dayOffset = Math.floor((index / rows) * 2190) // ~6 años, del más antiguo al más reciente
    const date = new Date(Date.UTC(2020, 0, 1 + dayOffset))
    const day = `${pad(date.getUTCDate())}-${pad(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`
    const merchant = MERCHANTS[Math.floor(random() * MERCHANTS.length)]
    const cents = 100 + Math.floor(random() * 20_000)
    balanceCents -= cents
    const euros = `-${Math.floor(cents / 100)},${pad(cents % 100)}`
    const balance = `${Math.trunc(balanceCents / 100)},${pad(Math.abs(balanceCents) % 100)}`
    const line = `${day};${day};COMPRA TARJ. ${merchant} REF${pad(index, 6)};${euros};EUR;${balance};EUR\n`
    if (!stream.write(line)) await once(stream, 'drain')
  }
  stream.end()
  await once(stream, 'finish')
  return { bytes: (await stat(path)).size }
}

/**
 * Escribe `term` en el buscador y devuelve los ms entre que la URL recibe el término (fin del debounce)
 * y el siguiente cambio del contador de resultados, medidos con `performance.now()` en la página.
 */
export async function measureSearchMs(page: Page, screen: TransactionsScreen, term: string): Promise<number> {
  await screen.searchBox.fill('')
  await page.waitForFunction(() => !location.hash.includes('q='))
  await page.evaluate((expected) => {
    const win = window as unknown as { __searchMs?: Promise<number> }
    win.__searchMs = new Promise<number>((resolve) => {
      let urlAt: number | null = null
      const originalReplace = history.replaceState.bind(history)
      const originalPush = history.pushState.bind(history)
      const mark = () => {
        if (urlAt === null && decodeURIComponent(location.hash).toLowerCase().includes(`q=${expected}`)) urlAt = performance.now()
      }
      history.replaceState = (...args) => {
        originalReplace(...args)
        mark()
      }
      history.pushState = (...args) => {
        originalPush(...args)
        mark()
      }
      const before = document.querySelector('.tx-summary__count')?.textContent
      const observer = new MutationObserver(() => {
        const text = document.querySelector('.tx-summary__count')?.textContent
        if (urlAt !== null && text !== before) {
          observer.disconnect()
          history.replaceState = originalReplace
          history.pushState = originalPush
          resolve(performance.now() - urlAt)
        }
      })
      observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    })
  }, term)
  await screen.searchBox.fill(term)
  return page.evaluate(() => (window as unknown as { __searchMs: Promise<number> }).__searchMs)
}

/** Cifra con separador de miles opcional (es-ES no lo pone en 4 cifras), p. ej. `100.000` o `100000`. */
export function thousandsPattern(value: number): RegExp {
  const digits = String(value)
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '[.\\s\u00a0]?')
  return new RegExp(`^${grouped}$`)
}
