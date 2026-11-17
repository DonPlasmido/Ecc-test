import { expect, test } from '@playwright/test'
import { DashboardPage, ImportPage, SAMPLE_TRANSACTION_COUNT, TransactionsPage, expectNoA11yViolations } from './fixtures'

test.describe('smoke: recorrido principal', () => {
  // La UI aún no existe (la está construyendo otro agente). Se activa cuando haya pantallas
  // y se ajusten los selectores de e2e/fixtures/pages.ts a los nombres accesibles reales.
  test.fixme(true, 'Espera a la UI: Panel, Movimientos e Importar todavía no están implementadas')

  test('importa un extracto, lo ve en Movimientos y no hay violaciones de accesibilidad @a11y', async ({ page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()
    await expectNoA11yViolations(page)

    await dashboard.navigateTo('Importar')
    const importPage = new ImportPage(page)
    await importPage.expectLoaded()
    await importPage.chooseFile('bbva.csv')
    await expect(importPage.preview).toBeVisible()
    await importPage.confirmButton.click()
    await expect(importPage.summary).toContainText(String(SAMPLE_TRANSACTION_COUNT))

    await importPage.navigateTo('Movimientos')
    const transactions = new TransactionsPage(page)
    await transactions.expectLoaded()
    await transactions.search('MERCADONA')
    await expect(transactions.rowWithText(/MERCADONA/).first()).toBeVisible()
    await expectNoA11yViolations(page)
  })
})
