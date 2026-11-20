import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Page object de «Movimientos» con los nombres accesibles reales de la pantalla (namespace `transactions`).
 * La app usa hash router: la ruta va tras `#`.
 */
export class TransactionsScreen {
  static readonly hashPath = '#/movimientos'

  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Movimientos' })
  }
  get searchBox(): Locator {
    return this.page.getByRole('searchbox', { name: 'Buscar movimientos' })
  }
  get filtersToggle(): Locator {
    return this.page.getByRole('button', { name: /^Filtros/ })
  }
  get grid(): Locator {
    return this.page.getByRole('grid', { name: 'Movimientos' })
  }
  get emptyState(): Locator {
    return this.page.getByRole('heading', { name: 'Aún no hay movimientos' })
  }
  get importLink(): Locator {
    return this.page.getByRole('link', { name: 'Importar extracto' })
  }
  get clearFilters(): Locator {
    return this.page.getByRole('button', { name: 'Limpiar filtros' })
  }

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/${TransactionsScreen.hashPath}${query}`)
    await expect(this.heading).toBeVisible()
  }

  /** Query del hash (`?q=…&tipo=…`). */
  async hashQuery(): Promise<string> {
    const hash = new URL(this.page.url()).hash
    const index = hash.indexOf('?')
    return index === -1 ? '' : hash.slice(index)
  }

  removeFilterChip(name: string | RegExp): Locator {
    return this.page.getByRole('button', { name: typeof name === 'string' ? `Quitar filtro: ${name}` : name })
  }
}
