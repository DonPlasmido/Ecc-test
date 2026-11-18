import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './fixtures'

/** Pantalla Reglas y categorías (`#/reglas`, hash router): selectores por rol y nombre accesible en español. */
async function openRules(page: Page): Promise<void> {
  await page.goto('/#/reglas')
  await expect(page.getByRole('heading', { level: 1, name: 'Reglas y categorías' })).toBeVisible()
}

/** Espera a que terminen las animaciones de entrada (diálogo, toasts): axe mide colores con opacidad parcial. */
async function checkA11y(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    ),
  )
  await expectNoA11yViolations(page)
}

const rulesList = (page: Page) => page.getByRole('list', { name: 'Reglas por prioridad' })

async function createRule(page: Page, pattern: string, category: string): Promise<void> {
  await page.getByRole('button', { name: 'Nueva regla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nueva regla' })
  await expect(dialog.getByRole('textbox', { name: /Texto del concepto/ })).toBeFocused()
  await dialog.getByRole('textbox', { name: /Texto del concepto/ }).fill(pattern)
  await dialog.getByRole('combobox', { name: /Categoría que asigna/ }).selectOption({ label: category })
  await dialog.getByRole('button', { name: 'Guardar regla' }).click()
  await expect(dialog).toBeHidden()
  await expect(rulesList(page).getByRole('listitem').filter({ hasText: pattern.toUpperCase() })).toBeVisible()
}

test.describe('Reglas y categorías (F2)', () => {
  test('crea una categoría y dos reglas, las reordena y borra una, sin violaciones de accesibilidad @a11y', async ({ page }) => {
    await openRules(page)
    await expect(page.getByRole('heading', { name: 'Aún no tienes reglas' })).toBeVisible()
    await checkA11y(page)

    // Crear categoría
    await page.getByRole('button', { name: 'Nueva categoría' }).click()
    const categoryDialog = page.getByRole('dialog', { name: 'Nueva categoría' })
    await categoryDialog.getByRole('textbox', { name: /Nombre/ }).fill('Mascotas')
    await categoryDialog.getByRole('radio', { name: 'Ciruela' }).check()
    await checkA11y(page)
    await categoryDialog.getByRole('button', { name: 'Guardar categoría' }).click()
    await expect(categoryDialog).toBeHidden()
    await expect(page.getByRole('button', { name: 'Editar categoría «Mascotas»' })).toBeVisible()

    // Crear reglas (la segunda usa la categoría nueva) y vista previa en el diálogo
    await createRule(page, 'mercadona', 'Supermercado')
    await page.getByRole('button', { name: 'Nueva regla' }).click()
    const ruleDialog = page.getByRole('dialog', { name: 'Nueva regla' })
    await ruleDialog.getByRole('textbox', { name: /Texto del concepto/ }).fill('tiendanimal')
    await expect(ruleDialog.getByText('Coincide con 0 movimientos')).toBeVisible()
    await checkA11y(page)
    await ruleDialog.getByRole('combobox', { name: /Categoría que asigna/ }).selectOption({ label: 'Mascotas' })
    await ruleDialog.getByRole('button', { name: 'Guardar regla' }).click()
    await expect(ruleDialog).toBeHidden()

    const items = rulesList(page).getByRole('listitem')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('MERCADONA')
    await expect(items.nth(1)).toContainText('TIENDANIMAL')
    await expect(items.nth(1)).toContainText('Mascotas')
    await checkA11y(page)

    // Reordenar con botones (sin arrastrar) y con teclado: el foco sigue a la regla movida
    const moveUp = page.getByRole('button', { name: 'Subir prioridad de «TIENDANIMAL»' })
    await moveUp.focus()
    await page.keyboard.press('Enter')
    await expect(items.nth(0)).toContainText('TIENDANIMAL')
    await expect(items.nth(1)).toContainText('MERCADONA')
    await expect(page.getByRole('button', { name: 'Bajar prioridad de «TIENDANIMAL»' })).toBeFocused()

    // El orden se guarda: sobrevive a recargar
    await page.reload()
    await expect(rulesList(page).getByRole('listitem').nth(0)).toContainText('TIENDANIMAL')

    // Aplicar reglas ahora
    await page.getByRole('button', { name: 'Aplicar reglas ahora' }).click()
    await expect(page.getByText(/Hecho: 0 movimientos han cambiado de categoría/)).toBeVisible()

    // Borrar una regla con confirmación
    await page.getByRole('button', { name: 'Borrar regla «MERCADONA»' }).click()
    const confirm = page.getByRole('dialog', { name: '¿Borrar la regla?' })
    await expect(confirm.getByRole('button', { name: 'Cancelar' })).toBeFocused()
    await checkA11y(page)
    await confirm.getByRole('button', { name: 'Borrar regla' }).click()
    await expect(confirm).toBeHidden()
    await expect(rulesList(page).getByRole('listitem')).toHaveCount(1)
    await expect(rulesList(page)).not.toContainText('MERCADONA')

    // «Mascotas» la usa una regla: no se borra, se ofrece archivarla
    await page.getByRole('button', { name: 'Borrar categoría «Mascotas»' }).click()
    await page.getByRole('dialog', { name: '¿Borrar la categoría?' }).getByRole('button', { name: 'Borrar categoría' }).click()
    const inUse = page.getByRole('dialog', { name: '«Mascotas» está en uso' })
    await expect(inUse).toBeVisible()
    await checkA11y(page)
    await inUse.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('button', { name: 'Editar categoría «Mascotas»' })).toBeVisible()
    await checkA11y(page)
  })

  test('cuenta las coincidencias de una regla con los movimientos importados', async ({ page }) => {
    await page.goto('/#/importar?ejemplo=1')
    await expect(page.getByRole('table', { name: /vista previa/i })).toBeVisible()
    await page.getByRole('button', { name: 'Importar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Importación completada' })).toBeVisible()

    await openRules(page)
    await createRule(page, 'mercadona', 'Supermercado')
    await expect(rulesList(page).getByRole('listitem').first()).toContainText(/\d+ movimientos? coincid/)
    await expect(rulesList(page).getByRole('listitem').first()).not.toContainText('0 movimientos coinciden')
  })
})
