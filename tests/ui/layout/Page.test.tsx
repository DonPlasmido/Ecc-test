import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { initI18n } from '@/ui/i18n/i18n'
import { Page } from '@/ui/layout/Page'

let navigate: ReturnType<typeof useNavigate> = () => undefined
let setParams: ReturnType<typeof useSearchParams>[1] = () => undefined

function Harness() {
  navigate = useNavigate()
  ;[, setParams] = useSearchParams()
  return (
    <Page title="Movimientos">
      <input aria-label="Buscar" />
    </Page>
  )
}

async function setup() {
  const i18n = await initI18n('es')
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/a']}>
        <Routes>
          <Route path="/a" element={<Harness />} />
          <Route path="/b" element={<Harness />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('Page focus management (a11y T6, WCAG 3.2.2)', () => {
  afterEach(cleanup)

  it('no mueve el foco al cambiar solo los parámetros de búsqueda (filtros)', async () => {
    await setup()
    const search = screen.getByRole('textbox', { name: 'Buscar' })
    search.focus()
    act(() => setParams({ q: 'mercadona' }))
    expect(search).toHaveFocus()
  })

  it('mueve el foco al h1 al navegar a otra pantalla', async () => {
    await setup()
    act(() => navigate('/b'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })
})
