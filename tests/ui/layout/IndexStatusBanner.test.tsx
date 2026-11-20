import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, screen } from '@testing-library/react'
import { IndexStatusBanner } from '@/ui/layout/IndexStatusBanner'
import { domainError } from '@/domain/shared/DomainError'
import { createFakeContainer, createFakeIndexStore } from '../fakeContainer'
import { renderWithProviders, setupI18n } from '../renderWithProviders'

describe('IndexStatusBanner (silent-failures ALTA-1)', () => {
  beforeAll(() => setupI18n('es'))
  afterEach(cleanup)

  it('no muestra nada mientras el índice está listo', () => {
    renderWithProviders(<IndexStatusBanner />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('avisa con un alert y ofrece recargar cuando el índice falla, y desaparece al recuperarse', () => {
    const indexStore = createFakeIndexStore()
    renderWithProviders(<IndexStatusBanner />, { container: createFakeContainer({ indexStore }) })

    act(() => indexStore.bump({ hydration: { status: 'failed', error: domainError('storage.unavailable') } }))
    expect(screen.getByRole('alert')).toHaveTextContent(/no se han podido cargar/i)
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument()

    act(() => indexStore.bump({ hydration: { status: 'ready' } }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
