import { expect, test } from '@playwright/test'
import { DashboardPage, ROUTES, expectNoA11yViolations } from './fixtures'

// Primer uso del panel (AC-030). El flujo con datos lo cubre el E2E de importación.
test.describe('Panel: primer uso', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`muestra el libro vacío con las dos salidas, sin errores ni violaciones (${colorScheme}) @a11y`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })
      await page.emulateMedia({ colorScheme })

      const dashboard = new DashboardPage(page)
      await dashboard.goto()

      await expect(dashboard.emptyState).toBeVisible()
      await expect(dashboard.importAction).toBeVisible()
      await expect(page.getByRole('link', { name: 'Probar con datos de ejemplo' })).toBeVisible()
      await expect(page.getByText('NaN')).toHaveCount(0)
      await expectNoA11yViolations(page)
      expect(consoleErrors).toEqual([])
    })
  }

  test('«Importar extracto» lleva a la pantalla de importación', async ({ page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await dashboard.importAction.click()

    await expect(page).toHaveURL(new RegExp(`#?${ROUTES.import}$`))
  })
})
