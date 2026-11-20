import { useTranslation } from 'react-i18next';
import type { CategoryTotal } from '@/application/ports/inbound/BuildDashboard';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import { useCategoryName } from '@/ui/components/CategoryChip';
import { BarChart, type BarDatum } from '@/ui/components/charts/BarChart';
import { categoryColorVar } from '@/ui/components/categoryColor';
import { formatMonth } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { foldCategories } from './dashboardModel';

type CategorySpendingProps = {
  month: YearMonth;
  spending: readonly CategoryTotal[];
  categories: ReadonlyMap<CategoryId, Category>;
};

const OTHER_KEY = '__other__';

/** ¿En qué se ha ido? Barras horizontales ordenadas (top 8 + «Otras») con tabla equivalente. */
export function CategorySpending({ month, spending, categories }: CategorySpendingProps) {
  const { t } = useTranslation('dashboard');
  const language = useLanguage();
  const categoryName = useCategoryName();
  const uncategorized = t('categories.uncategorized', { ns: 'common' });

  const data: BarDatum[] = foldCategories(spending).map((slice) => {
    if (slice.categoryId === null) {
      return { key: OTHER_KEY, label: t('categories.other'), value: slice.cents, color: 'var(--color-cat-other)' };
    }
    const category = categories.get(slice.categoryId);
    return {
      key: slice.categoryId,
      label: category ? categoryName(category) : uncategorized,
      value: slice.cents,
      color: category ? categoryColorVar(category.color) : 'var(--color-cat-other)',
    };
  });

  return (
    <section className="dash-section dash-section--categories" aria-labelledby="dash-categories-title">
      <h2 id="dash-categories-title" className="dash-section__title">
        {t('categories.heading')}
      </h2>
      <BarChart
        title={t('categories.chartTitle', { month: formatMonth(month, language, 'long') })}
        data={data}
        labelColumn={t('categories.column')}
        valueColumn={t('categories.valueColumn')}
      />
    </section>
  );
}
