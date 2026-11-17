import { test, expect } from '@playwright/test'
import { clickDownload, readDownloadedXlsx, xlsxFile } from './helpers'

test('limpiar una tabla de principio a fin en un Android', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('link', { name: /Limpiar tabla/ }).click()

  await page.getByLabel('Archivo de Excel').setInputFiles(
    await xlsxFile('clientes.xlsx', [
      ['Nombre', 'Ciudad'],
      ['Ana', 'Madrid'],
      [null, null],
      ['Ana ', 'Madrid'],
      ['Luis', 'Sevilla'],
    ]),
  )
  await page.getByRole('button', { name: 'Limpiar' }).click()

  await expect(page.getByRole('status')).toContainText('Quedan 2 filas')
  await expect(page.getByRole('status')).toContainText('1 duplicada y 1 vacía')

  const download = await clickDownload(page, /clientes-limpio\.xlsx/)
  expect(await readDownloadedXlsx(download)).toEqual([['Nombre', 'Ciudad'], ['Ana', 'Madrid'], ['Luis', 'Sevilla']])
})

test('rechaza un Excel antiguo con un mensaje claro', async ({ page }) => {
  await page.goto('./#limpiar')
  await page.getByLabel('Archivo de Excel').setInputFiles({ name: 'viejo.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') })
  await expect(page.getByRole('alert')).toContainText('guárdalo como .xlsx')
})
