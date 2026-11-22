import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

const LONG_CONCEPT = 'TRANSFERENCIA INTERNACIONAL CONCEPTO MUY LARGO SIN ABREVIAR PARA PROBAR EL AJUSTE DE LINEA EN LA LISTA Y EL DETALLE'
const HUGE_STATEMENT = [
  'Fecha;Concepto;Importe',
  `15/03/2026;${LONG_CONCEPT};-1.234.567,89`,
  '16/03/2026;COMPRA SUPERMERCADO;-12.345,67',
  '17/03/2026;NOMINA EMPRESA;999.999,99',
].join('\n')

async function importHugeStatement(page: Page): Promise<void> {
  const csvPath = join(tmpdir(), `cuentas-claras-e2e-${process.pid}-huge.csv`)
  await writeFile(csvPath, HUGE_STATEMENT, 'utf8')
  const importScreen = new ImportScreen(page)
  await importScreen.goto()
  await importScreen.fileInput.setInputFiles(csvPath)
  await expect(importScreen.previewTable).toBeVisible()
  await importScreen.confirm()
}

test('a 320 px Presupuestos con un presupuesto y Ajustes no desbordan en horizontal', async ({ page }) => {
  await page.goto('./#/presupuestos')
  await page.getByRole('button', { name: 'Añadir presupuesto' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo presupuesto' })
  await dialog.getByRole('combobox', { name: /categoría/i }).selectOption({ label: 'Supermercado' })
  await dialog.getByRole('textbox', { name: /límite mensual/i }).fill('300')
  await dialog.getByRole('button', { name: 'Guardar presupuesto' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Supermercado' })).toBeVisible()
  await expectNoHorizontalScroll(page, 'presupuestos con un presupuesto')

  await page.goto('./#/ajustes')
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
  await expect(page.getByRole('button', { name: /pedir almacenamiento persistente/i })).toBeVisible()
  await expectNoHorizontalScroll(page, 'ajustes con el aviso de almacenamiento')
})

test('a 320 px el detalle de un movimiento con importes enormes no desborda y se abre sin desplazar', async ({ page }) => {
  await importHugeStatement(page)
  await page.goto('./#/movimientos')
  await page.getByRole('row').filter({ hasText: 'TRANSFERENCIA INTERNACIONAL' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Movimiento' })
  await expect(dialog).toBeVisible()

  const metrics = await dialog.evaluate((el) => ({
    overflowX: el.scrollWidth - el.clientWidth,
    bodyScrollTop: el.querySelector('.dialog__body')?.scrollTop ?? -1,
  }))
  expect(metrics.overflowX, 'scroll horizontal del diálogo').toBeLessThanOrEqual(0)
  expect(metrics.bodyScrollTop, 'el cuerpo del diálogo se abre ya desplazado').toBe(0)
  const box = await dialog.locator('.tx-detail .amount').boundingBox()
  expect(box && box.x + box.width, 'el importe sale del diálogo').toBeLessThanOrEqual(320)
})

test('en los diálogos el orden del DOM de los botones del pie coincide con el visual', async ({ page }) => {
  await importHugeStatement(page)
  await page.goto('./#/movimientos')
  await page.getByRole('row').filter({ hasText: 'COMPRA SUPERMERCADO' }).first().click()
  const footer = page.getByRole('dialog', { name: 'Movimiento' }).locator('.dialog__footer')
  const boxes = await footer.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const { x, y } = button.getBoundingClientRect()
      return { x, y }
    }),
  )
  expect(boxes).toHaveLength(2)
  const [first, second] = boxes as [{ x: number; y: number }, { x: number; y: number }]
  const isBefore = first.y < second.y || (first.y === second.y && first.x < second.x)
  expect(isBefore, 'el primer botón del DOM debe verse antes').toBe(true)
})

for (const width of [360, 768]) {
  test(`a ${width} px los nombres de categoría largos no se solapan con Editar`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('./#/reglas')
    await expect(page.getByRole('heading', { level: 1, name: 'Reglas' })).toBeVisible()
    const overlaps = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.rules-category')).flatMap((item) => {
        const chip = item.querySelector('.chip')?.getBoundingClientRect()
        const actions = item.querySelector('.rules-category__actions')?.getBoundingClientRect()
        if (!chip || !actions) return []
        return chip.right > actions.left + 0.5 ? [`${item.textContent} (${chip.right - actions.left}px)`] : []
      }),
    )
    expect(overlaps).toEqual([])
  })
}
