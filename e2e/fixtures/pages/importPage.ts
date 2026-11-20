import { expect, type Locator, type Page } from '@playwright/test'
import { samplePath, type SampleFile } from '../samples'

/** Pantalla Importar (`#/importar`): selectores por rol y nombre accesible en español. */
export class ImportScreen {
  constructor(readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/#/importar')
    await expect(this.page.getByRole('heading', { level: 1, name: 'Importar extracto' })).toBeVisible()
  }

  get fileInput(): Locator {
    return this.page.getByLabel('Archivo del extracto (CSV o XLSX)')
  }

  get previewTable(): Locator {
    return this.page.getByRole('table', { name: /vista previa de las primeras/i })
  }

  get confirmButton(): Locator {
    return this.page.getByRole('button', { name: 'Importar', exact: true })
  }

  get summary(): Locator {
    return this.page.getByRole('region', { name: 'Importación completada' })
  }

  columnSelect(name: string | RegExp): Locator {
    return this.page.getByRole('combobox', { name })
  }

  /** Cifra del resumen junto a su rótulo (`<dt>` → `<dd>`). */
  summaryFigure(term: string): Locator {
    return this.summary.locator('div', { has: this.page.getByText(term, { exact: true }) }).locator('dd')
  }

  async chooseSample(sample: SampleFile): Promise<void> {
    await this.fileInput.setInputFiles(samplePath(sample))
    await expect(this.previewTable).toBeVisible()
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click()
    await expect(this.summary).toBeVisible()
  }
}
