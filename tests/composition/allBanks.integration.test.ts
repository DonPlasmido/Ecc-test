import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AppContainer } from '@/composition/container.types'
import { createContainer } from '@/composition/createContainer'
import type { YearMonth } from '@/domain/date/YearMonth'
import { uniqueDbName } from '../infrastructure/indexeddb/fixtures'

/** Los 7 extractos de public/samples/ contienen los mismos 50 movimientos y terminan en 1.767,93 €. */
const FAST_CIPHER = { iterations: 1000, iterationLimits: { min: 1, max: 2_000_000 } } as const
const SAMPLES = ['bbva.csv', 'santander.csv', 'caixabank.csv', 'ing.csv', 'sabadell.csv', 'bbva.xlsx', 'ing.xlsx'] as const
const EXPECTED_ROWS = 50
const EXPECTED_BALANCE_CENTS = 176793
const ALL_TIME = { from: '2026-01' as YearMonth, to: '2026-12' as YearMonth }
let container: AppContainer | null = null

function sample(name: string): { name: string; bytes: ArrayBuffer } {
  const buf = readFileSync(resolve(__dirname, '../../public/samples', name))
  return { name, bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer }
}

describe('los 7 extractos de ejemplo se importan solos, sin tocar el mapeo', () => {
  afterEach(() => {
    container?.dispose()
    container = null
  })

  it.each(SAMPLES)('%s: 50 movimientos, 0 errores y saldo final 1.767,93 € no estimado', async (name) => {
    container = await createContainer({ dbName: uniqueDbName(`bank-${name}`), cipherOptions: FAST_CIPHER })
    const saved = await container.manageCatalog.saveAccount({ name: 'cuenta nueva', ibanLast4: null })
    if (!saved.ok) throw new Error(saved.error.code)
    const preview = await container.importStatement.preview(sample(name))
    if (!preview.ok) throw new Error(preview.error.code)
    const committed = await container.importStatement.commit({
      previewId: preview.value.previewId,
      accountId: saved.value.id,
      mapping: preview.value.suggestedMapping,
    })
    if (!committed.ok) throw new Error(committed.error.code)
    await container.whenIndexIdle()

    expect(committed.value.rowErrors).toEqual([])
    expect(committed.value.inserted).toBe(EXPECTED_ROWS)
    const dashboard = await container.buildDashboard.execute(ALL_TIME)
    const balance = dashboard.balances.find((b) => b.accountId === saved.value.id)
    expect(balance?.balance).toEqual({ cents: EXPECTED_BALANCE_CENTS })
    expect(balance?.estimated ?? false).toBe(false)
  })
})
