import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './fixtures'
import { TransactionsScreen } from './fixtures/pages/transactionsPage'

test.describe('Movimientos (Pixel 7)', () => {
  test('sin datos muestra el estado vacío con enlace a Importar y sin violaciones de accesibilidad @a11y', async ({ page }) => {
    const screen = new TransactionsScreen(page)
    await screen.goto()

    await expect(screen.emptyState).toBeVisible()
    await expect(screen.grid).toHaveCount(0)
    await expectNoA11yViolations(page)

    await screen.importLink.click()
    await expect(page.getByRole('heading', { level: 1, name: 'Importar extracto' })).toBeVisible()
    expect(new URL(page.url()).hash).toBe('#/importar')
  })

  test('los filtros se guardan en la URL, sobreviven a la recarga y no mueven el foco', async ({ page }) => {
    const screen = new TransactionsScreen(page)
    await screen.goto()

    await screen.searchBox.fill('mercadona')
    await expect.poll(() => screen.hashQuery()).toBe('?q=mercadona')
    await expect(screen.searchBox).toBeFocused()

    await screen.filtersToggle.click()
    await expect(screen.filtersToggle).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('radio', { name: 'Gastos' }).check()
    await page.getByLabel('Ordenar por').selectOption({ label: 'Importe: de mayor a menor' })
    await expect.poll(() => screen.hashQuery()).toBe('?q=mercadona&tipo=expense&orden=amountDesc')
    await expectNoA11yViolations(page)

    await page.reload()
    await expect(screen.heading).toBeVisible()
    await expect(screen.searchBox).toHaveValue('mercadona')
    await expect(screen.filtersToggle).toHaveText('Filtros (2)')
    await expect(page.getByLabel('Ordenar por')).toHaveValue('amountDesc')

    await screen.removeFilterChip('Gastos').click()
    await expect.poll(() => screen.hashQuery()).toBe('?q=mercadona&orden=amountDesc')
    await screen.clearFilters.click()
    await expect.poll(() => screen.hashQuery()).toBe('?orden=amountDesc')
    await expect(screen.searchBox).toBeFocused()
    await expect(screen.searchBox).toHaveValue('')
  })

  test.describe('con movimientos importados', () => {
    // La pantalla /importar todavía es un marcador (PlaceholderNotice) en esta rama, y el encargo prohíbe
    // sembrar datos con una página de pruebas: sin importación por UI no hay forma legítima de tener filas.
    // Activar cuando exista la importación (e2e/fixtures/samples.ts ya trae los extractos de ejemplo).
    test.fixme(true, 'Requiere la UI de importación (/importar) para sembrar movimientos')

    test('busca, abre un movimiento, cambia su categoría y crea la regla propuesta (AC-019, AC-035) @a11y', async ({ page }) => {
      const screen = new TransactionsScreen(page)
      await screen.goto()
      // 1) Importar `bbva.csv` desde /importar. 2) Buscar «NETFLIX» y abrir la fila.
      // 3) Cambiar la categoría a «Ocio» y guardar. 4) En «¿Crear regla?», comprobar el patrón y
      //    «Afectaría a N movimientos más», aceptar y verificar el anuncio. 5) Recargar: la categoría persiste.
      await expect(screen.grid).toBeVisible()
      await expectNoA11yViolations(page)
    })

    test('lista de 100.000 movimientos: ≤ 100 filas en el DOM y búsqueda ≤ 200 ms (AC-031, AC-033)', async ({ page }) => {
      const screen = new TransactionsScreen(page)
      await screen.goto()
      await expect(screen.grid).toHaveAttribute('aria-rowcount', '100001')
    })
  })
})
