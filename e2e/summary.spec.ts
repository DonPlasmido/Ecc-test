import { test, expect } from '@playwright/test'
import { xlsxFile } from './helpers'

const ventas = [
  ['Tienda', 'Importe'],
  ['Centro', 100],
  ['Norte', '50,5'],
  ['Centro', 25],
  ['Sur', 'sin dato'],
]

test('resumen y gráfico agrupado de una columna', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('link', { name: /Resumen y gráfico/ }).click()
  await page.getByLabel('Archivo de Excel').setInputFiles(await xlsxFile('ventas.xlsx', ventas))

  await expect(page.getByLabel('Columna a calcular')).toHaveValue('1')
  await page.getByLabel('Agrupar por (para el gráfico)').selectOption({ label: 'Tienda' })
  await page.getByRole('button', { name: 'Calcular' }).click()

  const stats = page.locator('.stats')
  await expect(stats).toContainText('175,5')
  await expect(stats).toContainText('58,5')
  await expect(page.getByText('1 celda no es un número')).toBeVisible()
  await expect(page.getByRole('img', { name: /Importe por grupo/ })).toBeVisible()

  await page.getByText('Ver como tabla').click()
  await expect(page.locator('table.data tbody tr').first()).toContainText('Centro')
  await expect(page.locator('table.data tbody tr').first()).toContainText('125')

  const href = await page.getByRole('link', { name: /Descargar gráfico/ }).getAttribute('href')
  expect(href).toMatch(/^data:image\/png;base64,/)
})

test('avisa si la hoja no tiene números', async ({ page }) => {
  await page.goto('./#resumen')
  await page.getByLabel('Archivo de Excel').setInputFiles(await xlsxFile('texto.xlsx', [['Nombre'], ['Ana']]))
  await expect(page.getByRole('alert')).toContainText('ninguna columna con números')
  await expect(page.getByRole('button', { name: 'Calcular' })).toBeDisabled()
})
