import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { BudgetEvaluation } from '@/application/ports/inbound/EvaluateBudgets';
import type { Budget } from '@/domain/budget/Budget';
import type { CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import { Button } from '@/ui/components/Button';
import { useCategoryName } from '@/ui/components/CategoryChip';
import { Skeleton } from '@/ui/components/Skeleton';
import { useNotifications } from '@/ui/components/Toast';
import { useContainer } from '@/ui/hooks/useContainer';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { formatMonth } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { Page } from '@/ui/layout/Page';
import { BudgetCard } from './BudgetCard';
import { BudgetFormDialog, type BudgetEditor } from './BudgetFormDialog';
import { BudgetsEmpty } from './BudgetsEmpty';
import { BudgetSummary } from './BudgetSummary';
import { availableCategories, parseMonthParam, sortByRisk, summarize, yearMonthOf } from './budgetsModel';
import { DeleteBudgetDialog } from './DeleteBudgetDialog';
import { MonthSwitcher } from './MonthSwitcher';
import { useBudgetsData, type BudgetsData } from './useBudgetsData';
import './budgets.css';

/** Parámetro de la URL con el mes visible (estado compartible, `#/presupuestos?mes=2026-03`). */
const MONTH_PARAM = 'mes';
const SKELETON_ROWS = 3;

interface ShownData {
  readonly month: YearMonth;
  readonly data: BudgetsData;
}

/** Presupuestos del mes: resumen, lista por riesgo, alta/edición/borrado y estado vacío con sugerencias. */
export function BudgetsPage() {
  const { t } = useTranslation('budgets');
  const { t: tCommon } = useTranslation();
  const { t: tErrors } = useTranslation('errors');
  const language = useLanguage();
  const categoryName = useCategoryName();
  const { manageCatalog, onExternalChange } = useContainer();
  const { notify } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentMonth = yearMonthOf(new Date());
  const month = parseMonthParam(searchParams.get(MONTH_PARAM)) ?? currentMonth;
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<BudgetEditor | null>(null);
  const [toDelete, setToDelete] = useState<BudgetEvaluation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  /** Categoría recién guardada: al recargar, se avisa si su presupuesto queda superado (a11y §5, 4.1.3). */
  const watchedCategoryRef = useRef<CategoryId | null>(null);
  /** Tras borrar, el foco va al encabezado de la lista (el botón que abrió el diálogo desaparece). */
  const shouldFocusListRef = useRef(false);
  const [shown, setShown] = useState<ShownData | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const result = useBudgetsData(month, revision);

  // Otra pestaña cambió datos: se recargan presupuestos y gasto.
  useEffect(() => onExternalChange(() => setRevision((n) => n + 1)), [onExternalChange]);

  // Stale-while-revalidate: se mantiene lo último mostrado del mismo mes mientras recarga (sin saltos ni foco perdido).
  if (result.status === 'success' && shown?.data !== result.data) setShown({ month, data: result.data });
  const isFresh = result.status === 'success';
  const data = isFresh ? result.data : shown?.month === month ? shown.data : null;

  const nameOfId = (id: CategoryId): string => {
    const category = data?.categories.find((c) => c.id === id);
    return category ? categoryName(category) : id;
  };

  const freshData = result.status === 'success' ? result.data : null;
  useEffect(() => {
    if (freshData === null) return;
    if (shouldFocusListRef.current) {
      shouldFocusListRef.current = false;
      // Solo si el botón que abrió el diálogo desapareció con la recarga (p. ej. el del estado vacío).
      const active = document.activeElement;
      if (!active || active === document.body || !active.isConnected) listHeadingRef.current?.focus();
    }
    const watched = watchedCategoryRef.current;
    if (watched === null) return;
    watchedCategoryRef.current = null;
    if (freshData.evaluations.find((e) => e.categoryId === watched)?.status === 'over') {
      const category = freshData.categories.find((c) => c.id === watched);
      notify({ tone: 'warning', message: t('toast.over', { category: category ? categoryName(category) : '' }) });
    }
    // `categoryName` cambia de identidad en cada render; solo importa cuando llegan datos nuevos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshData, notify, t]);

  const changeMonth = (next: YearMonth) => {
    setSearchParams(next === currentMonth ? {} : { [MONTH_PARAM]: next }, { replace: true });
  };

  const handleSaved = (budget: Budget) => {
    setEditor(null);
    setRevision((n) => n + 1);
    shouldFocusListRef.current = true;
    watchedCategoryRef.current = budget.categoryId;
    notify({ tone: 'success', message: t('toast.saved', { category: nameOfId(budget.categoryId) }) });
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      const deleted = await manageCatalog.deleteBudget(toDelete.budgetId);
      if (deleted.ok) {
        notify({ tone: 'success', message: t('toast.deleted', { category: nameOfId(toDelete.categoryId) }) });
        shouldFocusListRef.current = true;
      } else {
        notify({ tone: 'error', message: errorMessage(tErrors, deleted.error) });
      }
    } catch {
      notify({ tone: 'error', message: errorMessage(tErrors, null) });
    } finally {
      setIsDeleting(false);
      setToDelete(null);
      setRevision((n) => n + 1);
    }
  };

  const monthLabel = formatMonth(month, language, 'long');
  const editingId = editor?.kind === 'edit' ? editor.budget.id : null;
  const eligible = data ? availableCategories(data.categories, data.budgets, month, editingId) : [];
  const canAdd = data !== null && availableCategories(data.categories, data.budgets, month, null).length > 0;
  const sorted = data ? sortByRisk(data.evaluations, nameOfId) : [];
  const editBudget = (evaluation: BudgetEvaluation) => {
    const budget = data?.budgets.find((b) => b.id === evaluation.budgetId);
    if (budget) setEditor({ kind: 'edit', budget });
  };

  return (
    <Page title={tCommon('pages.budgets.title')} intro={tCommon('pages.budgets.intro')}>
      <MonthSwitcher month={month} currentMonth={currentMonth} onChange={changeMonth} />

      {result.status === 'error' && data === null ? (
        <div className="budgets-error" role="alert">
          <p>{t('loadError')}</p>
          <Button onClick={result.reload}>{tCommon('actions.retry')}</Button>
        </div>
      ) : null}

      {data === null && result.status === 'loading' ? (
        <div className="stack" aria-busy="true">
          <Skeleton variant="figure" hasLabel />
          <Skeleton variant="row" count={SKELETON_ROWS} />
        </div>
      ) : null}

      {data && data.evaluations.length > 0 ? <BudgetSummary totals={summarize(data.evaluations)} /> : null}

      {data ? (
        <section className="stack" aria-labelledby="budgets-list-title">
          <div className="budgets-list__header">
            <h2 className="budgets-list__title" id="budgets-list-title" ref={listHeadingRef} tabIndex={-1}>
              {t('list.title')}
            </h2>
            {data.evaluations.length > 0 && canAdd ? (
              <Button variant="primary" isSmall onClick={() => setEditor({ kind: 'create' })}>
                {t('list.add')}
              </Button>
            ) : null}
          </div>
          {data.evaluations.length === 0 ? (
            <BudgetsEmpty
              monthLabel={monthLabel}
              suggestions={data.suggestions}
              categories={data.categories}
              onAdd={() => setEditor({ kind: 'create' })}
              onAccept={(s) => setEditor({ kind: 'create', categoryId: s.categoryId, limit: s.monthlyLimit })}
            />
          ) : (
            <ul className="budgets-list" aria-label={t('list.label', { month: monthLabel })}>
              {sorted.map((evaluation) => (
                <BudgetCard
                  key={evaluation.budgetId}
                  evaluation={evaluation}
                  categoryName={nameOfId(evaluation.categoryId)}
                  onEdit={editBudget}
                  onDelete={setToDelete}
                />
              ))}
            </ul>
          )}
          {data.evaluations.length > 0 && !canAdd ? <p className="text-muted text-sm">{t('list.allBudgeted')}</p> : null}
        </section>
      ) : null}

      <BudgetFormDialog
        editor={editor}
        month={month}
        categories={eligible}
        allCategories={data?.categories ?? []}
        onClose={() => setEditor(null)}
        onSaved={handleSaved}
      />
      <DeleteBudgetDialog
        categoryName={toDelete ? nameOfId(toDelete.categoryId) : null}
        isDeleting={isDeleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </Page>
  );
}
