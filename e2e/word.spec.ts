import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import PizZip from 'pizzip'
import { xlsxFile } from './helpers'

const docxText = (data: Buffer): string =>
  [...new PizZip(data).file('word/document.xml')!.asText().matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')

test('crear un Word por fila con la plantilla de ejemplo', async ({ page, request }) => {
  await page.goto('./')
  await page.getByRole('link', { name: /Rellenar Word/ }).click()

  const template = await (await request.get('./ejemplos/plantilla-ejemplo.docx')).body()
  await page.getByLabel('Plantilla de Word').setInputFiles({
    name: 'plantilla.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: template,
  })
  await page.getByLabel('Excel con los datos').setInputFiles(
    await xlsxFile('clientes.xlsx', [
      ['Nombre', 'Importe', 'Fecha', 'Ciudad'],
      ['Ana', 120.5, new Date(Date.UTC(2026, 11, 15)), 'Madrid'],
      ['Luis', 89, new Date(Date.UTC(2026, 11, 20)), 'Sevilla'],
    ]),
  )
  await page.getByLabel('Nombre de cada archivo').selectOption({ label: 'Según la columna «Nombre»' })
  await page.getByRole('button', { name: 'Crear documentos' }).click()

  await expect(page.getByRole('status')).toContainText('2 documentos creados')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /documentos\.zip/ }).click(),
  ])
  const zip = new PizZip(await readFile(await download.path()))
  expect(Object.keys(zip.files).sort()).toEqual(['Ana.docx', 'Luis.docx'])
  const ana = docxText(Buffer.from(zip.file('Ana.docx')!.asUint8Array()))
  expect(ana).toContain('Hola Ana,')
  expect(ana).toContain('120,5 € con fecha límite el 15/12/2026')
})

test('avisa si la plantilla usa columnas que el Excel no tiene', async ({ page, request }) => {
  await page.goto('./#word')
  const template = await (await request.get('./ejemplos/plantilla-ejemplo.docx')).body()
  await page.getByLabel('Plantilla de Word').setInputFiles({ name: 'p.docx', mimeType: 'application/octet-stream', buffer: template })
  await page.getByLabel('Excel con los datos').setInputFiles(await xlsxFile('pocos.xlsx', [['Nombre'], ['Ana']]))
  await page.getByRole('button', { name: 'Crear documentos' }).click()
  await expect(page.getByRole('alert')).toContainText('La plantilla usa columnas que el Excel no tiene: «Importe», «Fecha», «Ciudad».')
})
