import { UNCATEGORIZED, type Category, type CategoryId, type CategoryKind } from '@/domain/category/Category'

function category(slug: string, name: string, kind: CategoryKind, color: string): Category {
  return {
    id: `cat-${slug}` as CategoryId,
    name,
    nameKey: `categories.${slug}`,
    kind,
    color,
    archived: false,
  }
}

/** Categorías por defecto (ids estables; los nombres visibles salen de i18n vía `nameKey`). */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  { ...category('uncategorized', 'Sin categoría', 'expense', 'neutral'), id: UNCATEGORIZED },
  category('groceries', 'Supermercado', 'expense', 'chart-1'),
  category('restaurants', 'Restaurantes y cafés', 'expense', 'chart-2'),
  category('transport', 'Transporte', 'expense', 'chart-3'),
  category('housing', 'Vivienda', 'expense', 'chart-4'),
  category('utilities', 'Suministros', 'expense', 'chart-5'),
  category('health', 'Salud', 'expense', 'chart-6'),
  category('leisure', 'Ocio', 'expense', 'chart-7'),
  category('shopping', 'Compras', 'expense', 'chart-8'),
  category('subscriptions', 'Suscripciones', 'expense', 'chart-9'),
  category('education', 'Educación', 'expense', 'chart-10'),
  category('travel', 'Viajes', 'expense', 'chart-11'),
  category('taxes-fees', 'Impuestos y comisiones', 'expense', 'chart-12'),
  category('gifts', 'Regalos', 'expense', 'chart-13'),
  category('salary', 'Nómina', 'income', 'income-1'),
  category('other-income', 'Otros ingresos', 'income', 'income-2'),
  category('transfers', 'Transferencias', 'transfer', 'transfer'),
]
