import { UNCATEGORIZED, type Category, type CategoryId } from '@/domain/category/Category';
import { categoryPaletteSlot } from '@/ui/components/categoryColor';

/** Tokens de color que se ofrecen al crear o editar (paleta `--color-cat-1…8` y gris). */
export const COLOR_TOKENS = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8', 'neutral'] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

/** Token de la paleta equivalente al guardado (`chart-11` → `cat-3`, `income-1` → `cat-3`, otro → gris). */
export function toColorToken(stored: string): ColorToken {
  const slot = categoryPaletteSlot(stored);
  return slot === null ? 'neutral' : (`cat-${slot}` as ColorToken);
}

/** «Sin categoría» es fija: ni se borra ni puede ser destino de una regla. */
export function isFixedCategory(id: CategoryId): boolean {
  return id === UNCATEGORIZED;
}

/** Categorías que puede elegir una regla: no archivadas (salvo la actual) y nunca «Sin categoría». */
export function ruleTargetCategories(categories: readonly Category[], current: CategoryId | null): readonly Category[] {
  return categories.filter((c) => !isFixedCategory(c.id) && (!c.archived || c.id === current));
}

/** Siguiente color libre (o el menos usado) para una categoría nueva. */
export function suggestColor(categories: readonly Category[]): ColorToken {
  const palette = COLOR_TOKENS.filter((token) => token !== 'neutral');
  const uses = (token: ColorToken) => categories.filter((c) => toColorToken(c.color) === token).length;
  return palette.reduce((best, token) => (uses(token) < uses(best) ? token : best), palette[0] ?? 'cat-1');
}

/** «Sin categoría» primero; el resto por nombre visible, según el idioma (sin mutar la entrada). */
export function sortCategories(
  categories: readonly Category[],
  nameOf: (category: Category) => string,
  locale: string,
): readonly Category[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  return [...categories].sort((a, b) => {
    if (isFixedCategory(a.id) !== isFixedCategory(b.id)) return isFixedCategory(a.id) ? -1 : 1;
    return collator.compare(nameOf(a), nameOf(b));
  });
}
