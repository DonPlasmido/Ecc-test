import { useTranslation } from 'react-i18next';
import type { Category } from '@/domain/category/Category';
import { categoryPaletteSlot } from './categoryColor';

type CategoryChipProps = {
  category: Pick<Category, 'name' | 'nameKey' | 'color'>;
  /** Si se pasa, el chip es un botón conmutable (`aria-pressed`). */
  onToggle?: () => void;
  isPressed?: boolean;
  className?: string;
};

/** Nombre visible: las categorías por defecto se traducen vía `nameKey` hasta que se editan. */
export function useCategoryName(): (category: Pick<Category, 'name' | 'nameKey'>) => string {
  const { t } = useTranslation();
  return (category) => (category.nameKey ? t(category.nameKey, { defaultValue: category.name }) : category.name);
}

/** Chip de categoría: muestra cuadrada de color + texto (nunca solo color, DESIGN.md §3). */
export function CategoryChip({ category, onToggle, isPressed = false, className }: CategoryChipProps) {
  const categoryName = useCategoryName();
  const slot = categoryPaletteSlot(category.color);
  const classes = ['chip', slot === null ? null : `chip--cat-${slot}`, className].filter(Boolean).join(' ');
  const label = <span className="chip__label">{categoryName(category)}</span>;

  if (onToggle) {
    return (
      <button type="button" className={classes} aria-pressed={isPressed} onClick={onToggle}>
        {label}
      </button>
    );
  }
  return <span className={classes}>{label}</span>;
}
