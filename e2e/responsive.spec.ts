import { test, expect, type Page } from '@playwright/test'
import { ImportScreen } from './fixtures/pages/importPage'

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `${label}: scroll horizontal de ${overflow}px`).toBeLessThanOrEqual(0)
}

test.use({ viewport: { width: 320, height: 640 } })

test('a 320 px ninguna pantalla tiene scroll horizontal, tampoco la vista previa de importación', async ({ page }) => {
  const importScreen = new ImportScreen(page)
  await importScreen.goto()
  await importScreen.chooseSample('caixabank.csv')
  await expect(importScreen.previewTable.getByRole('row').nth(1)).toBeVisible()
  await expectNoHorizontalScroll(page, 'vista previa de importación')

  for (const route of ['/', '/movimientos', '/presupuestos', '/reglas', '/ajustes']) {
    await page.goto(`./#${route}`)
    await page.waitForLoadState('networkidle')
    await expectNoHorizontalScroll(page, route)
  }
})
