/** Tonos de categoría disponibles en `tokens.css` (`--color-cat-1…8`). */
export const CATEGORY_PALETTE_SIZE = 8;

const NUMBERED_TOKEN = /^(?:cat|chart)-(\d+)$/;
const INCOME_TOKEN = /^income-\d+$/;
/** Las categorías de ingreso usan el verde de la paleta. */
const INCOME_SLOT = 3;

/**
 * Traduce el token guardado en el dominio (`cat-3`, `chart-11`, `income-1`, `neutral`…)
 * a una posición 1…8 de la paleta, o `null` para el gris «Otras / sin categoría».
 */
export function categoryPaletteSlot(colorToken: string): number | null {
  const numbered = NUMBERED_TOKEN.exec(colorToken);
  if (numbered) {
    const n = Number(numbered[1]);
    return n >= 1 ? ((n - 1) % CATEGORY_PALETTE_SIZE) + 1 : null;
  }
  return INCOME_TOKEN.test(colorToken) ? INCOME_SLOT : null;
}

/** Variable CSS del color (para barras y series de gráficos). */
export function categoryColorVar(colorToken: string): string {
  const slot = categoryPaletteSlot(colorToken);
  return slot === null ? 'var(--color-cat-other)' : `var(--color-cat-${slot})`;
}
