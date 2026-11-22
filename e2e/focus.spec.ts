import { expect, test } from '@playwright/test'
import { ImportScreen } from './fixtures/pages/importPage'
import { TransactionsScreen } from './fixtures/pages/transactionsPage'

test('con el teclado, la fila enfocada de la lista nunca queda bajo la navegación inferior (WCAG 2.4.11)', async ({ page }) => {
  const importScreen = new ImportScreen(page)
  await importScreen.goto()
  await importScreen.chooseSample('bbva.csv')
  await importScreen.confirm()
  const screen = new TransactionsScreen(page)
  await screen.goto()
  await screen.grid.getByRole('row').nth(1).focus()

  await page.keyboard.press('Control+End')

  await expect(page.locator('[role="row"]:focus')).toBeVisible()
  const { rowBottom, navTop } = await page.evaluate(() => {
    const row = document.activeElement?.getBoundingClientRect()
    const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect()
    return { rowBottom: row?.bottom ?? Infinity, navTop: nav?.top ?? 0 }
  })
  expect(rowBottom, 'la fila enfocada queda bajo la navegación').toBeLessThanOrEqual(navTop)
})

test('con el botón Atrás del navegador el foco va al h1 de la pantalla', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByRole('heading', { level: 1, name: 'Panel' })).toBeVisible()
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeFocused()

  await page.goBack()

  await expect(page.getByRole('heading', { level: 1, name: 'Panel' })).toBeFocused()
})
