import { expect, type Locator, type Page } from '@playwright/test'
import { samplePath, type SampleFile } from './samples'

export const ROUTES = {
  dashboard: '/',
  transactions: '/movimientos',
  import: '/importar',
  budgets: '/presupuestos',
  rules: '/reglas',
  settings: '/ajustes',
} as const

export type NavLabel = 'Panel' | 'Movimientos' | 'Importar' | 'Presupuestos' | 'Reglas' | 'Ajustes'

/** Base de todas las pantallas: navegación principal y título. Selectores por rol/label en español. */
export abstract class AppPage {
  abstract readonly path: string
  abstract readonly headingName: string | RegExp

  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: this.headingName })
  }

  get navigation(): Locator {
    return this.page.getByRole('navigation')
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path)
    await this.expectLoaded()
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible()
  }

  async navigateTo(name: NavLabel): Promise<void> {
    await this.navigation.getByRole('link', { name }).click()
  }
}

export class DashboardPage extends AppPage {
  readonly path = ROUTES.dashboard
  readonly headingName = 'Panel'

  get emptyState(): Locator {
    return this.page.getByRole('region', { name: /sin movimientos|vacío/i })
  }
  get importAction(): Locator {
    return this.page.getByRole('link', { name: 'Importar extracto' })
  }
}

export class TransactionsPage extends AppPage {
  readonly path = ROUTES.transactions
  readonly headingName = 'Movimientos'

  get searchBox(): Locator {
    return this.page.getByRole('searchbox', { name: /buscar/i })
  }
  get rows(): Locator {
    return this.page.getByRole('row')
  }
  rowWithText(text: string | RegExp): Locator {
    return this.page.getByRole('row').filter({ hasText: text })
  }
  async search(text: string): Promise<void> {
    await this.searchBox.fill(text)
  }
}

export class ImportPage extends AppPage {
  readonly path = ROUTES.import
  readonly headingName = 'Importar'

  get fileInput(): Locator {
    return this.page.getByLabel(/archivo|extracto/i)
  }
  get preview(): Locator {
    return this.page.getByRole('table', { name: /vista previa/i })
  }
  get confirmButton(): Locator {
    return this.page.getByRole('button', { name: 'Importar', exact: true })
  }
  get summary(): Locator {
    return this.page.getByRole('status')
  }
  get errorAlert(): Locator {
    return this.page.getByRole('alert')
  }
  async chooseFile(sample: SampleFile): Promise<void> {
    await this.fileInput.setInputFiles(samplePath(sample))
  }
}

export class BudgetsPage extends AppPage {
  readonly path = ROUTES.budgets
  readonly headingName = 'Presupuestos'

  get addButton(): Locator {
    return this.page.getByRole('button', { name: /añadir presupuesto|nuevo presupuesto/i })
  }
  budgetItem(category: string | RegExp): Locator {
    return this.page.getByRole('listitem').filter({ hasText: category })
  }
}

export class RulesPage extends AppPage {
  readonly path = ROUTES.rules
  readonly headingName = 'Reglas'

  get addButton(): Locator {
    return this.page.getByRole('button', { name: /añadir regla|nueva regla/i })
  }
  ruleItem(text: string | RegExp): Locator {
    return this.page.getByRole('listitem').filter({ hasText: text })
  }
}

export class SettingsPage extends AppPage {
  readonly path = ROUTES.settings
  readonly headingName = 'Ajustes'

  get languageSelect(): Locator {
    return this.page.getByLabel('Idioma')
  }
  get themeSelect(): Locator {
    return this.page.getByLabel('Tema')
  }
  get exportBackupButton(): Locator {
    return this.page.getByRole('button', { name: /exportar copia/i })
  }
  get restoreBackupInput(): Locator {
    return this.page.getByLabel(/restaurar copia|archivo de copia/i)
  }
  get passwordInput(): Locator {
    return this.page.getByLabel('Contraseña', { exact: true })
  }
}
