import { afterEach, describe, expect, it, vi } from 'vitest'
import { IndexSync } from '@/composition/IndexSync'
import { createTransactionIndex } from '@/application/read-model/TransactionIndex'
import { createTransactionIndexStore } from '@/application/read-model/TransactionIndexStore'
import type { TransactionRepository } from '@/application/ports/outbound/TransactionRepository'
import type { Transaction } from '@/domain/transaction/Transaction'
import { createInMemoryState } from '../fakes/InMemoryState'
import { InMemoryTransactionRepository } from '../fakes/InMemoryTransactionRepository'
import { tx } from '../fixtures/txBuilder'

/** Repositorio que falla en el siguiente `scan` a mitad (tras entregar el primer bloque). */
function flakyRepository(state: ReturnType<typeof createInMemoryState>) {
  const inner = new InMemoryTransactionRepository(state)
  let failNext = false
  const repo: TransactionRepository = Object.assign(Object.create(inner) as TransactionRepository, {
    scan: async (onBatch: (batch: readonly Transaction[]) => void, batchSize?: number) => {
      if (!failNext) return inner.scan(onBatch, batchSize)
      failNext = false
      const all = [...state.transactions.values()]
      onBatch(all.slice(0, 1))
      throw new DOMException('aborted', 'AbortError')
    },
  })
  return { repo, failOnce: () => { failNext = true } }
}

function setup() {
  const state = createInMemoryState()
  for (const t of [tx({ id: 't1' }), tx({ id: 't2' }), tx({ id: 't3' })]) state.transactions.set(t.id, t)
  const { repo, failOnce } = flakyRepository(state)
  const index = createTransactionIndex()
  const store = createTransactionIndexStore(index)
  const sync = new IndexSync(repo, index, store)
  return { state, index, store, sync, failOnce }
}

describe('IndexSync: fallos visibles y recuperables (silent-failures ALTA-1/2)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('registra el error y vuelve a «ready» cuando una pasada posterior va bien', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { store, sync, failOnce } = setup()
    await sync.hydrate()
    failOnce()
    sync.notifyDataChanged()
    await sync.whenIdle()
    expect(errorLog).toHaveBeenCalled()
    expect(store.getSnapshot().hydration.status).toBe('ready')
  })

  it('tras un fallo a mitad, la siguiente pasada correcta quita lo borrado', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { state, index, sync, failOnce } = setup()
    await sync.hydrate()
    state.transactions.delete('t3' as Transaction['id'])
    failOnce()
    sync.notifyDataChanged()
    await sync.whenIdle()
    expect(index.size).toBe(2)
  })
})
