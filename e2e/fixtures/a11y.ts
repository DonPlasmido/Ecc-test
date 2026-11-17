import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

const BLOCKING_IMPACTS = ['serious', 'critical']

/** Falla si axe (WCAG 2.2 A/AA) encuentra violaciones serious o critical en la página actual. */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const blocking = results.violations
    .filter((v) => v.impact && BLOCKING_IMPACTS.includes(v.impact))
    .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) }))
  expect(blocking, `Violaciones de accesibilidad:\n${JSON.stringify(blocking, null, 2)}`).toEqual([])
}
