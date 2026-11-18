import { useTranslation } from 'react-i18next';
import type { Category, CategoryId } from '@/domain/category/Category';
import { Button } from '@/ui/components/Button';
import { useCategoryName } from '@/ui/components/CategoryChip';
import { EmptyState } from '@/ui/components/EmptyState';
import { formatMoney } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { SUGGESTION_MONTHS, type BudgetSuggestion } from './budgetsModel';

type BudgetsEmptyProps = {
  monthLabel: string;
  suggestions: readonly BudgetSuggestion[];
  categories: readonly Category[];
  onAdd: () => void;
  onAccept: (suggestion: BudgetSuggestion) => void;
};

/** Estado vacío del mes con la acción de alta y, si hay gasto previo, límites sugeridos. */
export function BudgetsEmpty({ monthLabel, suggestions, categories, onAdd, onAccept }: BudgetsEmptyProps) {
  const { t } = useTranslation('budgets');
  const language = useLanguage();
  const categoryName = useCategoryName();
  const byId = new Map<CategoryId, Category>(categories.map((c) => [c.id, c]));

  return (
    <div className="stack">
      <EmptyState
        headingLevel={3}
        title={t('empty.title', { month: monthLabel })}
        text={t('empty.text')}
        action={
          <Button variant="primary" onClick={onAdd}>
            {t('list.add')}
          </Button>
        }
      />
      {suggestions.length > 0 ? (
        <section className="card budgets-suggestions" aria-labelledby="budgets-suggestions-title">
          <h3 className="card__title" id="budgets-suggestions-title">
            {t('suggestions.title')}
          </h3>
          <p className="text-muted text-sm">{t('suggestions.intro', { count: SUGGESTION_MONTHS })}</p>
          <ul className="budgets-suggestions__list">
            {suggestions.map((suggestion) => {
              const category = byId.get(suggestion.categoryId);
              if (!category) return null;
              const name = categoryName(category);
              const amount = formatMoney(suggestion.monthlyLimit.cents, language, false);
              return (
                <li key={suggestion.categoryId} className="budgets-suggestions__item">
                  <span className="budgets-suggestions__name">
                    <span className="truncate">{name}</span>
                    <span className="text-muted text-sm tabular">{t('suggestions.average', { amount })}</span>
                  </span>
                  <Button
                    isSmall
                    aria-label={t('suggestions.createLabel', { category: name, amount })}
                    onClick={() => onAccept(suggestion)}
                  >
                    {t('suggestions.create')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
