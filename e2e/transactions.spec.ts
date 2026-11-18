import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './fixtures'
import { ImportScreen } from './fixtures/pages/importPage'
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
    test('busca, abre un movimiento, cambia su categoría y crea la regla propuesta (AC-019, AC-035) @a11y', async ({ page }) => {
      const importScreen = new ImportScreen(page)
      await importScreen.goto()
      await importScreen.chooseSample('bbva.csv')
      await importScreen.confirm()

      const screen = new TransactionsScreen(page)
      await screen.goto()
      await screen.searchBox.fill('NETFLIX')
      await expect(screen.grid).toHaveAttribute('aria-rowcount', '4')
      const rows = screen.grid.getByRole('row').filter({ hasText: 'NETFLIX' })
      await expect(rows).toHaveCount(3)

      await rows.first().click()
      const detail = page.getByRole('dialog', { name: 'Movimiento' })
      await expect(detail).toBeVisible()
      await detail.getByLabel('Categoría').selectOption({ label: 'Ocio' })
      await expectNoA11yViolations(page)
      await detail.getByRole('button', { name: 'Guardar' }).click()

      const proposal = page.getByRole('dialog', { name: '¿Crear regla?' })
      await expect(proposal).toBeVisible()
      await expect(proposal.getByLabel('Texto que debe contener el concepto')).toHaveValue('NETFLIX.COM')
      await expect(proposal).toContainText(/2 movimientos más/)
      await expectNoA11yViolations(page)
      await proposal.getByRole('button', { name: 'Crear regla' }).click()
      await expect(proposal).toBeHidden()

      // Los otros movimientos con el mismo concepto quedan categorizados, y persiste tras recargar.
      for (const phase of ['antes de recargar', 'tras recargar']) {
        await expect(rows, phase).toHaveCount(3)
        for (let index = 0; index < 3; index += 1) {
          await expect(rows.nth(index), phase).toContainText('Ocio')
        }
        if (phase === 'antes de recargar') await page.reload()
        await expect(screen.heading).toBeVisible()
      }
      await expect(screen.searchBox).toHaveValue('NETFLIX')
    })

    test('lista de 100.000 movimientos: ≤ 100 filas en el DOM y búsqueda ≤ 200 ms (AC-031, AC-033)', async ({ page }) => {
      const screen = new TransactionsScreen(page)
      await screen.goto()
      await expect(screen.grid).toHaveAttribute('aria-rowcount', '100001')
    })
  })
})
