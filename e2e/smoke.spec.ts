import { expect, test } from '@playwright/test'
import { DashboardPage, SAMPLE_TRANSACTION_COUNT, expectNoA11yViolations } from './fixtures'
import { ImportScreen } from './fixtures/pages/importPage'
import { TransactionsScreen } from './fixtures/pages/transactionsPage'

test.describe('smoke: recorrido principal', () => {
  test('Panel vacío, importa el ejemplo de CaixaBank, ve los movimientos y el gasto del mes, sin violaciones @a11y', async ({ page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()
    await expect(dashboard.emptyState).toBeVisible()
    await expectNoA11yViolations(page)

    await dashboard.navigateTo('Importar')
    const importScreen = new ImportScreen(page)
    await importScreen.chooseSample('caixabank.csv')
    await importScreen.confirm()
    await expect(importScreen.summaryFigure('Movimientos importados')).toHaveText(String(SAMPLE_TRANSACTION_COUNT))
    await expectNoA11yViolations(page)

    await dashboard.navigateTo('Movimientos')
    const transactions = new TransactionsScreen(page)
    await expect(transactions.heading).toBeVisible()
    await expect(transactions.grid).toHaveAttribute('aria-rowcount', String(SAMPLE_TRANSACTION_COUNT + 1))
    await expect(transactions.grid.getByRole('row').filter({ hasText: 'MERCADONA' }).first()).toBeVisible()
    await expectNoA11yViolations(page)

    await dashboard.navigateTo('Panel')
    await expect(dashboard.heading).toBeVisible()
    await expect(dashboard.emptyState).toHaveCount(0)
    const headline = page.getByRole('region', { name: /^Gastado en / })
    await expect(headline).toBeVisible()
    await expect(headline.locator('.dash-hero__figure')).toHaveText(/[1-9]/)
    await expect(page.getByText('NaN')).toHaveCount(0)
    await expectNoA11yViolations(page)
  })
})
