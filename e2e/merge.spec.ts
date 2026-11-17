import { test, expect } from '@playwright/test'
import { clickDownload, readDownloadedXlsx, xlsxFile } from './helpers'

test('juntar dos Excels con columnas en distinto orden', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('link', { name: /Juntar Excels/ }).click()

  await page.getByLabel('Archivos de Excel').setInputFiles([
    await xlsxFile('enero.xlsx', [['Producto', 'Cantidad'], ['Pan', 3]]),
    await xlsxFile('febrero.xlsx', [['Cantidad', 'Producto', 'Precio'], [12, 'Huevos', 2.5]]),
  ])
  await page.getByRole('button', { name: 'Juntar' }).click()

  await expect(page.getByRole('status').first()).toContainText('2 filas en total')
  await expect(page.getByText('febrero.xlsx tiene una columna que los anteriores no tenían: «Precio».')).toBeVisible()

  const download = await clickDownload(page, /juntos\.xlsx/)
  expect(await readDownloadedXlsx(download)).toEqual([
    ['Origen', 'Producto', 'Cantidad', 'Precio'],
    ['enero.xlsx', 'Pan', 3],
    ['febrero.xlsx', 'Huevos', 12, 2.5],
  ])
})

test('avisa si solo se elige un archivo', async ({ page }) => {
  await page.goto('./#juntar')
  await page.getByLabel('Archivos de Excel').setInputFiles([await xlsxFile('solo.xlsx', [['A'], [1]])])
  await page.getByRole('button', { name: 'Juntar' }).click()
  await expect(page.getByRole('alert')).toContainText('al menos dos')
})
