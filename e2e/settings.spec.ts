import { expect, test, type Page } from '@playwright/test'
import { SAMPLE_TRANSACTION_COUNT, expectNoA11yViolations } from './fixtures'
import { ImportScreen } from './fixtures/pages/importPage'
import { TransactionsScreen } from './fixtures/pages/transactionsPage'

const PASSWORD = 'caballo bateria grapa correcta'
const SETTINGS_HASH = '/#/ajustes'

async function gotoSettings(page: Page): Promise<void> {
  await page.goto(SETTINGS_HASH)
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
}

async function expectTransactions(page: Page, count: number): Promise<void> {
  const screen = new TransactionsScreen(page)
  await page.goto(`/${TransactionsScreen.hashPath}`)
  await expect(screen.heading).toBeVisible()
  if (count === 0) {
    await expect(screen.emptyState).toBeVisible()
  } else {
    await expect(screen.grid).toHaveAttribute('aria-rowcount', String(count + 1))
  }
}

/** Contenido de IndexedDB, localStorage y sessionStorage como texto (para buscar la contraseña). */
async function storedText(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const dump: unknown[] = [{ ...localStorage }, { ...sessionStorage }]
    for (const info of await indexedDB.databases()) {
      if (!info.name) continue
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(info.name as string)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      for (const store of Array.from(db.objectStoreNames)) {
        const all = await new Promise<unknown[]>((resolve, reject) => {
          const request = db.transaction(store).objectStore(store).getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        dump.push(all)
      }
      db.close()
    }
    return JSON.stringify(dump)
  })
}

test.describe('Ajustes (Pixel 7)', () => {
  test('exporta una copia cifrada, borra los datos y la restaura con la contraseña @a11y', async ({ page }) => {
    test.slow() // PBKDF2 con 600 000 iteraciones al cifrar y al descifrar
    const consoleText: string[] = []
    page.on('console', (message) => consoleText.push(message.text()))

    const importScreen = new ImportScreen(page)
    await importScreen.goto()
    await importScreen.chooseSample('bbva.csv')
    await importScreen.confirm()

    await gotoSettings(page)
    await expect(page.getByText('Todavía no has hecho ninguna copia. Te recomendamos hacer una ahora.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Privacidad' })).toContainText('Todo se guarda solo en este dispositivo')
    await expect(page.getByRole('link', { name: 'Ir a Reglas y categorías' })).toBeVisible()
    await expectNoA11yViolations(page)

    // Exportar
    const exportButton = page.getByRole('button', { name: 'Exportar copia cifrada' })
    await exportButton.click()
    const exportDialog = page.getByRole('dialog', { name: 'Exportar copia cifrada' })
    const password = exportDialog.getByLabel('Contraseña', { exact: true })
    await expect(password).toBeFocused()
    await expect(exportDialog).toContainText('Si olvidas la contraseña no hay forma de recuperar los datos')
    await password.fill(PASSWORD)
    await exportDialog.getByLabel('Repetir contraseña').fill(PASSWORD)
    await expect(exportDialog.getByText('Fortaleza: fuerte')).toBeVisible()
    await expectNoA11yViolations(page)
    const downloadPromise = page.waitForEvent('download')
    await exportDialog.getByRole('button', { name: 'Cifrar y descargar' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^cuentas-claras-\d{4}-\d{2}-\d{2}\.ccbackup$/)
    const backupPath = await download.path()
    await expect(exportDialog).toBeHidden()
    await expect(exportButton).toBeFocused()
    await expect(page.getByText(/^Última copia: /)).toBeVisible()
    expect(await storedText(page)).not.toContain(PASSWORD)

    // Borrar todos los datos
    await page.getByRole('button', { name: 'Borrar todos los datos…' }).click()
    const deleteDialog = page.getByRole('dialog', { name: '¿Borrar todos los datos?' })
    await deleteDialog.getByRole('textbox', { name: /Escribe BORRAR/ }).fill('BORRAR')
    await deleteDialog.getByRole('button', { name: 'Borrar todo' }).click()
    await expect(page.getByText('Se han borrado todos los datos de este dispositivo.')).toBeVisible()
    await expect(page.getByText('Todavía no has hecho ninguna copia. Te recomendamos hacer una ahora.')).toBeVisible()
    await expectTransactions(page, 0)

    // Restaurar la copia
    await gotoSettings(page)
    await page.getByLabel('Archivo de copia (.ccbackup)').setInputFiles(backupPath)
    const confirmDialog = page.getByRole('dialog', { name: '¿Reemplazar todos tus datos?' })
    await expect(confirmDialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()
    await expectNoA11yViolations(page)
    await confirmDialog.getByRole('button', { name: 'Sí, reemplazar mis datos' }).click()
    const restoreDialog = page.getByRole('dialog', { name: 'Restaurar copia' })
    const restorePassword = restoreDialog.getByLabel('Contraseña', { exact: true })
    await expect(restorePassword).toHaveAttribute('autocomplete', 'current-password')
    await restorePassword.fill('una contraseña que no es')
    await restoreDialog.getByRole('button', { name: 'Restaurar copia' }).click()
    // Dentro del diálogo modal viven también las regiones vivas globales (role=alert vacía): se filtra por texto.
    await expect(
      restoreDialog.getByRole('alert').filter({ hasText: 'La contraseña no es correcta o el archivo está dañado.' }),
    ).toBeVisible()
    await restorePassword.fill(PASSWORD)
    await restoreDialog.getByRole('button', { name: 'Restaurar copia' }).click()
    await expect(page.getByText(`Copia restaurada: ${SAMPLE_TRANSACTION_COUNT} movimientos`)).toBeVisible()
    await expect(restoreDialog).toBeHidden()
    await expectTransactions(page, SAMPLE_TRANSACTION_COUNT)

    expect(consoleText.join('\n')).not.toContain(PASSWORD)
    expect(await storedText(page)).not.toContain(PASSWORD)
  })

  test('cambiar a inglés persiste tras recargar con <html lang="en"> (AC-044) @a11y', async ({ page }) => {
    await gotoSettings(page)
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')

    await page.getByLabel('Idioma / Language').selectOption('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.reload()

    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('button', { name: 'Export encrypted backup' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible()
    await expectNoA11yViolations(page)
  })
})
