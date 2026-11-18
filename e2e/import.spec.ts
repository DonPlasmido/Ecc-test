import { expect, test } from '@playwright/test'
import { SAMPLE_TRANSACTION_COUNT, expectNoA11yViolations } from './fixtures'
import { ImportScreen } from './fixtures/pages/importPage'

test.describe('Importar extracto (F1)', () => {
  test('importa el CSV de CaixaBank (Debe/Haber, Windows-1252) y reimportarlo no duplica @a11y', async ({ page }) => {
    const screen = new ImportScreen(page)
    await screen.goto()
    await expectNoA11yViolations(page)

    await screen.chooseSample('caixabank.csv')
    await expect(screen.columnSelect('Cómo vienen los importes')).toHaveValue('debitCredit')
    await expect(screen.columnSelect('Columna 5 (Debe): usar como')).toHaveValue('debit')
    await expect(screen.previewTable.getByRole('row').nth(1)).toContainText('TRANSFERENCIA ALQUILER PISO')
    await expect(screen.previewTable.getByRole('row').nth(1)).toContainText('-750,00')
    await expectNoA11yViolations(page)

    await screen.confirm()
    await expect(screen.summary.getByRole('heading', { name: 'Importación completada' })).toBeFocused()
    await expect(screen.summaryFigure('Movimientos importados')).toHaveText(String(SAMPLE_TRANSACTION_COUNT))
    await expect(screen.summaryFigure('Duplicados omitidos')).toHaveText('0')
    await expectNoA11yViolations(page)

    await page.getByRole('button', { name: 'Importar otro extracto' }).click()
    await screen.chooseSample('caixabank.csv')
    await screen.confirm()
    await expect(screen.summaryFigure('Movimientos importados')).toHaveText('0')
    await expect(screen.summaryFigure('Duplicados omitidos')).toHaveText(String(SAMPLE_TRANSACTION_COUNT))
  })

  test('importa el XLSX de BBVA de punta a punta y enlaza a Movimientos @a11y', async ({ page }) => {
    const screen = new ImportScreen(page)
    await screen.goto()

    await screen.chooseSample('bbva.xlsx')
    await expect(page.getByText(/Cabecera en la fila \d+ del archivo/)).toBeVisible()
    await expect(screen.previewTable.getByRole('row').nth(1)).toContainText('TRANSFERENCIA A CUENTA AHORRO')
    await expect(page.getByRole('textbox', { name: /Nombre de la nueva cuenta/ })).toHaveValue('Cuenta principal')
    await expectNoA11yViolations(page)

    await screen.confirm()
    await expect(screen.summaryFigure('Movimientos importados')).toHaveText(String(SAMPLE_TRANSACTION_COUNT))
    await expectNoA11yViolations(page)

    await screen.summary.getByRole('link', { name: 'Ver movimientos' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Movimientos' })).toBeVisible()
  })

  test('cancelar la vista previa no guarda nada y devuelve el foco al selector', async ({ page }) => {
    const screen = new ImportScreen(page)
    await screen.goto()

    await screen.chooseSample('bbva.csv')
    await screen.columnSelect(/Columna 5 \(Importe\)/).selectOption('ignore')
    await expect(screen.confirmButton).toBeDisabled()
    await page.getByRole('button', { name: 'Cancelar' }).click()

    await expect(screen.previewTable).toBeHidden()
    await expect(screen.fileInput).toBeFocused()
  })

  test('el enlace del Panel (?ejemplo=1) abre la vista previa del extracto de ejemplo', async ({ page }) => {
    const screen = new ImportScreen(page)
    await page.goto('/#/importar?ejemplo=1')

    await expect(screen.previewTable).toBeVisible()
    await expect(page.getByText('Archivo: bbva.csv')).toBeVisible()
    await expect(page).toHaveURL(/#\/importar$/)
    await expectNoA11yViolations(page)
  })
})
