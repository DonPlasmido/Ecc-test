import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AppContainer } from '@/composition/container.types'
import { createContainer } from '@/composition/createContainer'
import type { AccountId } from '@/domain/account/Account'
import { uniqueDbName } from '../infrastructure/indexeddb/fixtures'

/**
 * Extracto FICTICIO al estilo imagin (el formato real no está documentado públicamente): 60 movimientos de
 * ago-oct 2026, saldo final 2.598,34 €. Generado por tests/fixtures/imagin/generate.cjs.
 */
const FAST_CIPHER = { iterations: 1000, iterationLimits: { min: 1, max: 2_000_000 } } as const
let container: AppContainer | null = null

function file(name: string): { name: string; bytes: ArrayBuffer } {
  const buf = readFileSync(resolve(__dirname, '../fixtures/imagin', name))
  return { name, bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer }
}

async function newAccount(c: AppContainer): Promise<AccountId> {
  const saved = await c.manageCatalog.saveAccount({ name: 'imagin ficticia', ibanLast4: null })
  if (!saved.ok) throw new Error(saved.error.code)
  return saved.value.id
}

async function importFile(c: AppContainer, name: string, accountId: AccountId) {
  const preview = await c.importStatement.preview(file(name))
  if (!preview.ok) throw new Error(preview.error.code)
  const committed = await c.importStatement.commit({
    previewId: preview.value.previewId,
    accountId,
    mapping: preview.value.suggestedMapping,
  })
  if (!committed.ok) throw new Error(committed.error.code)
  return committed.value
}

describe('extracto estilo imagin (XLSX y CSV con «EUR»)', () => {
  afterEach(() => {
    container?.dispose()
    container = null
  })

  it('importa el CSV con importes «-3,20EUR» sin filas con error', async () => {
    container = await createContainer({ dbName: uniqueDbName('imagin-csv'), cipherOptions: FAST_CIPHER })
    const result = await importFile(container, 'imagin-ficticio.csv', await newAccount(container))
    expect(result.rowErrors).toEqual([])
    expect(result.inserted).toBe(60)
  })

  it('reimportar el mismo extracto en otro formato (XLSX → CSV) no duplica nada', async () => {
    container = await createContainer({ dbName: uniqueDbName('imagin-cross'), cipherOptions: FAST_CIPHER })
    const account = await newAccount(container)
    const first = await importFile(container, 'imagin-ficticio.xlsx', account)
    const second = await importFile(container, 'imagin-ficticio.csv', account)
    expect(first.inserted).toBe(60)
    expect(second.inserted).toBe(0)
    expect({ duplicates: second.duplicates, rowErrors: second.rowErrors }).toEqual({ duplicates: 60, rowErrors: [] })
  })
})
