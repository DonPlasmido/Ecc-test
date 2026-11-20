import { expect, test, type Locator } from '@playwright/test'
import { BudgetsPage, expectNoA11yViolations } from './fixtures'

// La app usa HashRouter (ADR-0005): la ruta real es `#/presupuestos`.
const BUDGETS_URL = '/#/presupuestos'

/** Espera a que acabe la animación de entrada del diálogo (axe mediría colores a medio fundido). */
async function settled(dialog: Locator): Promise<void> {
  await dialog.evaluate((el) => Promise.allSettled(el.getAnimations({ subtree: true }).map((a) => a.finished)))
}

test.describe('presupuestos', () => {
  test('crea, ve, edita y borra un presupuesto sin violaciones de accesibilidad @a11y', async ({ page }) => {
    const budgets = new BudgetsPage(page)
    await page.goto(BUDGETS_URL)
    await budgets.expectLoaded()
    await expect(page.getByRole('heading', { name: /sin presupuestos en/i })).toBeVisible()
    await expectNoA11yViolations(page)

    // Crear: primero un envío inválido (más de dos decimales), luego uno válido
    await budgets.addButton.click()
    const createDialog = page.getByRole('dialog', { name: 'Nuevo presupuesto' })
    await expect(createDialog).toBeVisible()
    await createDialog.getByRole('combobox', { name: /categoría/i }).selectOption({ label: 'Supermercado' })
    const limit = createDialog.getByRole('textbox', { name: /límite mensual/i })
    await limit.fill('12,345')
    await createDialog.getByRole('button', { name: 'Guardar presupuesto' }).click()
    await expect(limit).toHaveAttribute('aria-invalid', 'true')
    await expect(limit).toBeFocused()
    await settled(createDialog)
    await expectNoA11yViolations(page)
    await limit.fill('300')
    await createDialog.getByRole('button', { name: 'Guardar presupuesto' }).click()
    await expect(createDialog).toBeHidden()

    // Ver
    const item = budgets.budgetItem('Supermercado')
    await expect(item).toBeVisible()
    await expect(item).toContainText('Dentro del presupuesto')
    await expect(item).toContainText(/0,00\s€ de 300,00\s€/)
    await expect(page.getByRole('region', { name: 'Resumen del mes' })).toContainText(/300,00\s€/)
    await expectNoA11yViolations(page)

    // Editar
    await item.getByRole('button', { name: 'Editar presupuesto de Supermercado' }).click()
    const editDialog = page.getByRole('dialog', { name: 'Editar presupuesto de Supermercado' })
    const editLimit = editDialog.getByRole('textbox', { name: /límite mensual/i })
    await expect(editLimit).toBeFocused()
    await expect(editLimit).toHaveValue('300,00')
    await editLimit.fill('450,50')
    await editDialog.getByRole('button', { name: 'Guardar presupuesto' }).click()
    await expect(editDialog).toBeHidden()
    await expect(item).toContainText(/de 450,50\s€/)

    // Recargar: persiste en IndexedDB
    await page.reload()
    await expect(budgets.budgetItem('Supermercado')).toContainText(/de 450,50\s€/)

    // Borrar con confirmación (foco inicial en Cancelar)
    await budgets.budgetItem('Supermercado').getByRole('button', { name: 'Borrar presupuesto de Supermercado' }).click()
    const deleteDialog = page.getByRole('dialog', { name: '¿Borrar el presupuesto de Supermercado?' })
    await expect(deleteDialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()
    await settled(deleteDialog)
    await expectNoA11yViolations(page)
    await deleteDialog.getByRole('button', { name: 'Borrar presupuesto' }).click()
    await expect(deleteDialog).toBeHidden()
    await expect(page.getByRole('heading', { name: /sin presupuestos en/i })).toBeVisible()
    await expect(budgets.budgetItem('Supermercado')).toHaveCount(0)
  })
})
