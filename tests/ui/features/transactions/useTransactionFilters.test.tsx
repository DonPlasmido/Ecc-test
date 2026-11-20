import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useTransactionFilters } from '@/ui/features/transactions/useTransactionFilters'

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/movimientos?q=mercadona']}>{children}</MemoryRouter>
}

describe('useTransactionFilters', () => {
  it('dos cambios seguidos en el mismo tick se conservan los dos (bug visto en CI)', () => {
    const { result } = renderHook(() => ({ filters: useTransactionFilters(), location: useLocation() }), { wrapper })

    act(() => {
      result.current.filters.update({ sign: 'expense' })
      result.current.filters.update({ sort: 'amountDesc' })
    })

    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('q')).toBe('mercadona')
    expect(params.get('tipo')).toBe('expense')
    expect(params.get('orden')).toBe('amountDesc')
  })
})
