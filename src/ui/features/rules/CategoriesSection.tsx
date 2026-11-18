import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/domain/category/Category';
import { Button } from '@/ui/components/Button';
import { CategoryChip, useCategoryName } from '@/ui/components/CategoryChip';
import { Dialog } from '@/ui/components/Dialog';
import { useNotifications } from '@/ui/components/Toast';
import { useContainer } from '@/ui/hooks/useContainer';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { isFixedCategory, sortCategories } from './categoryModel';
import { CategoryFormDialog } from './CategoryFormDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { upsertById } from './rulesModel';
import { IconPlus } from './rulesIcons';

type CategoriesSectionProps = {
  categories: readonly Category[];
  onCategoriesChange: (update: (categories: readonly Category[]) => readonly Category[]) => void;
};

type Editing = { readonly category: Category | null } | null;

/** Borrado en dos pasos: confirmar y, si está en uso, explicar por qué no y ofrecer archivarla. */
type Deleting =
  | { readonly step: 'confirm'; readonly category: Category; readonly error: string | null }
  | { readonly step: 'inUse'; readonly category: Category; readonly error: string | null }
  | null;

/** Categorías: color y nombre, alta, edición (renombrar, color, archivar) y borrado. */
export function CategoriesSection({ categories, onCategoriesChange }: CategoriesSectionProps) {
  const { t, i18n } = useTranslation('rules');
  const { manageCatalog } = useContainer();
  const { notify } = useNotifications();
  const categoryName = useCategoryName();
  const sorted = sortCategories(categories, categoryName, i18n.language);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const [isBusy, setIsBusy] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const deletingName = deleting ? categoryName(deleting.category) : '';

  const handleSaved = (saved: Category, isNew: boolean) => {
    onCategoriesChange((current) => upsertById(current, saved));
    setEditing(null);
    notify({ tone: 'success', message: t(isNew ? 'categories.created' : 'categories.updated', { name: categoryName(saved) }) });
  };

  const handleDelete = async () => {
    if (deleting === null) return;
    const { category } = deleting;
    setIsBusy(true);
    try {
      const result = await manageCatalog.deleteCategory(category.id);
      if (result.ok) {
        onCategoriesChange((current) => current.filter((c) => c.id !== category.id));
        notify({ tone: 'success', message: t('categories.deleted', { name: deletingName }) });
        setDeleting(null);
        requestAnimationFrame(() => addButtonRef.current?.focus());
      } else if (result.error.code === 'category.inUse') {
        setDeleting({ step: 'inUse', category, error: null });
      } else {
        setDeleting({ ...deleting, error: errorMessage(t, result.error) });
      }
    } catch {
      setDeleting({ ...deleting, error: errorMessage(t, null) });
    } finally {
      setIsBusy(false);
    }
  };

  const handleArchive = async () => {
    if (deleting === null) return;
    const { category } = deleting;
    setIsBusy(true);
    try {
      const result = await manageCatalog.saveCategory({ ...category, archived: true });
      if (!result.ok) {
        setDeleting({ ...deleting, error: errorMessage(t, result.error) });
        return;
      }
      onCategoriesChange((current) => upsertById(current, result.value));
      notify({ tone: 'success', message: t('categories.archivedDone', { name: deletingName }) });
      setDeleting(null);
    } catch {
      setDeleting({ ...deleting, error: errorMessage(t, null) });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="rules-section stack" aria-labelledby="categories-heading">
      <div className="rules-section__header">
        <h2 id="categories-heading" className="rules-section__title">
          {t('categories.heading')}
        </h2>
        <Button ref={addButtonRef} onClick={() => setEditing({ category: null })}>
          <IconPlus />
          {t('categories.add')}
        </Button>
      </div>
      <ul className="rules-categories" aria-label={t('categories.listLabel')}>
        {sorted.map((category) => {
          const name = categoryName(category);
          const isFixed = isFixedCategory(category.id);
          return (
            <li key={category.id} className="rules-category" data-archived={category.archived || undefined}>
              <div className="rules-category__info">
                <CategoryChip category={category} />
                <span className="text-sm text-muted">
                  {t(`kind.${category.kind}`)}
                  {category.archived ? ` · ${t('categories.archived')}` : ''}
                  {isFixed ? ` · ${t('categories.fixed')}` : ''}
                </span>
              </div>
              <div className="rules-category__actions">
                <Button
                  variant="quiet"
                  isSmall
                  aria-label={t('categories.edit', { name })}
                  onClick={() => setEditing({ category })}
                >
                  {t('actions.edit')}
                </Button>
                {isFixed ? null : (
                  <Button
                    variant="quiet"
                    isSmall
                    aria-label={t('categories.delete', { name })}
                    onClick={() => setDeleting({ step: 'confirm', category, error: null })}
                  >
                    {t('actions.delete')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <CategoryFormDialog
        isOpen={editing !== null}
        category={editing?.category ?? null}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
      <ConfirmDialog
        isOpen={deleting?.step === 'confirm'}
        title={t('categories.deleteTitle')}
        description={t('categories.deleteText', { name: deletingName })}
        confirmLabel={t('categories.deleteConfirm')}
        isBusy={isBusy}
        error={deleting?.error ?? null}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
      <Dialog
        isOpen={deleting?.step === 'inUse'}
        onClose={() => setDeleting(null)}
        title={t('categories.inUseTitle', { name: deletingName })}
        description={t('categories.inUseText')}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>{t('actions.cancel')}</Button>
            {deleting?.category.archived ? null : (
              <Button variant="primary" isBusy={isBusy} onClick={() => void handleArchive()}>
                {t('categories.archive')}
              </Button>
            )}
          </>
        }
      >
        {deleting?.error ? (
          <p className="field__error" role="alert">
            {deleting.error}
          </p>
        ) : null}
      </Dialog>
    </section>
  );
}
