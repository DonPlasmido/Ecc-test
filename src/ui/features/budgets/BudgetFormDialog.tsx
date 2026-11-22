import { useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Budget } from '@/domain/budget/Budget';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Money } from '@/domain/money/Money';
import type { DomainError } from '@/domain/shared/DomainError';
import { Button } from '@/ui/components/Button';
import { useCategoryName } from '@/ui/components/CategoryChip';
import { Dialog } from '@/ui/components/Dialog';
import { Field } from '@/ui/components/Field';
import { useContainer } from '@/ui/hooks/useContainer';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { formatMonth } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { limitToInput, parseLimitInput, shiftMonth } from './budgetsModel';

/** Cuántos meses hacia atrás se puede empezar un presupuesto nuevo (para extractos antiguos). */
const START_MONTHS_BACK = 24;

/** Qué se edita: alta (con valores sugeridos opcionales) o edición de un presupuesto existente. */
export type BudgetEditor =
  | { readonly kind: 'create'; readonly categoryId?: CategoryId; readonly limit?: Money }
  | { readonly kind: 'edit'; readonly budget: Budget };

type BudgetFormDialogProps = {
  editor: BudgetEditor | null;
  month: YearMonth;
  /** Categorías elegibles en alta (sin presupuesto que se solape). */
  categories: readonly Category[];
  /** Todas las categorías (para el nombre en edición). */
  allCategories: readonly Category[];
  onClose: () => void;
  onSaved: (budget: Budget) => void;
};

interface FormErrors {
  readonly category: string | null;
  readonly limit: string | null;
  readonly form: string | null;
}

const NO_ERRORS: FormErrors = { category: null, limit: null, form: null };

/** Asigna un `DomainError` del caso de uso al campo que lo provoca. */
function errorsFromDomain(error: DomainError, message: string): FormErrors {
  if (error.code === 'budget.duplicateCategory' || error.code === 'category.notFound') {
    return { ...NO_ERRORS, category: message };
  }
  if (error.code === 'budget.invalidLimit' || error.code.startsWith('money.')) return { ...NO_ERRORS, limit: message };
  return { ...NO_ERRORS, form: message };
}

/** Diálogo con el formulario de presupuesto (validación al enviar, foco al primer error, a11y §14). */
export function BudgetFormDialog({ editor, month, categories, allCategories, onClose, onSaved }: BudgetFormDialogProps) {
  const { t } = useTranslation('budgets');
  const categoryName = useCategoryName();
  const firstFieldRef = useRef<HTMLElement | null>(null);
  const formId = useId();
  const [isSaving, setIsSaving] = useState(false);

  const editedCategory =
    editor?.kind === 'edit' ? allCategories.find((c) => c.id === editor.budget.categoryId) ?? null : null;
  const title =
    editor?.kind === 'edit'
      ? t('form.editTitle', { category: editedCategory ? categoryName(editedCategory) : '' })
      : t('form.createTitle');

  return (
    <Dialog
      isOpen={editor !== null}
      onClose={onClose}
      title={title}
      initialFocusRef={firstFieldRef}
      footer={
        <>
          <Button onClick={onClose}>{t('form.cancel')}</Button>
          <Button type="submit" form={formId} variant="primary" isBusy={isSaving}>
            {isSaving ? t('form.saving') : t('form.save')}
          </Button>
        </>
      }
    >
      {editor ? (
        <BudgetForm
          formId={formId}
          editor={editor}
          month={month}
          categories={categories}
          firstFieldRef={firstFieldRef}
          onSavingChange={setIsSaving}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

type BudgetFormProps = {
  formId: string;
  editor: BudgetEditor;
  month: YearMonth;
  categories: readonly Category[];
  firstFieldRef: RefObject<HTMLElement | null>;
  onSavingChange: (isSaving: boolean) => void;
  onSaved: (budget: Budget) => void;
};

function BudgetForm({ formId, editor, month, categories, firstFieldRef, onSavingChange, onSaved }: BudgetFormProps) {
  const { t } = useTranslation('budgets');
  const { t: tErrors } = useTranslation('errors');
  const language = useLanguage();
  const categoryName = useCategoryName();
  const { manageCatalog } = useContainer();
  const isEdit = editor.kind === 'edit';
  const initialCategory = editor.kind === 'edit' ? editor.budget.categoryId : (editor.categoryId ?? '');
  const initialLimit = editor.kind === 'edit' ? editor.budget.monthlyLimit : editor.limit;
  const [categoryId, setCategoryId] = useState<string>(initialCategory);
  const [limitText, setLimitText] = useState(initialLimit ? limitToInput(initialLimit) : '');
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS);
  const categoryRef = useRef<HTMLSelectElement | null>(null);
  const limitRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = useRef(false);
  const [chosenStart, setChosenStart] = useState<YearMonth>(month);
  const startMonth = editor.kind === 'edit' ? editor.budget.startMonth : chosenStart;
  const startOptions = Array.from({ length: START_MONTHS_BACK + 1 }, (_, i) => shiftMonth(month, -i));
  const focusLimitFirst = isEdit || initialCategory !== '';
  const sortedCategories = [...categories].sort((a, b) => categoryName(a).localeCompare(categoryName(b), language));

  const setFieldRef = (field: 'category' | 'limit') => (node: HTMLSelectElement | HTMLInputElement | null) => {
    if (field === 'category') categoryRef.current = node as HTMLSelectElement | null;
    else limitRef.current = node as HTMLInputElement | null;
    if ((field === 'limit') === focusLimitFirst) firstFieldRef.current = node;
  };

  const focusFirstError = (next: FormErrors) => {
    if (next.category) categoryRef.current?.focus();
    else if (next.limit) limitRef.current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmittingRef.current) return;
    const limit = parseLimitInput(limitText);
    const validation: FormErrors = {
      category: !isEdit && categoryId === '' ? t('form.errors.categoryRequired') : null,
      limit: limit.ok ? null : t(`form.errors.${limit.error}`),
      form: null,
    };
    if (validation.category || !limit.ok) {
      setErrors(validation);
      focusFirstError(validation);
      return;
    }
    isSubmittingRef.current = true;
    onSavingChange(true);
    try {
      const result = await manageCatalog.saveBudget({
        id: editor.kind === 'edit' ? editor.budget.id : undefined,
        categoryId: categoryId as CategoryId,
        monthlyLimit: limit.value,
        startMonth,
        endMonth: editor.kind === 'edit' ? editor.budget.endMonth : null,
      });
      if (result.ok) {
        onSaved(result.value);
        return;
      }
      const next = errorsFromDomain(result.error, errorMessage(tErrors, result.error));
      setErrors(next);
      focusFirstError(next);
    } catch {
      setErrors({ ...NO_ERRORS, form: errorMessage(tErrors, null) });
    } finally {
      isSubmittingRef.current = false;
      onSavingChange(false);
    }
  };

  return (
    <form id={formId} className="stack" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <p className="text-muted">{t('form.description', { month: formatMonth(startMonth, language, 'long') })}</p>
      {errors.form ? (
        <p className="field__error" role="alert">
          {errors.form}
        </p>
      ) : null}
      {isEdit ? null : (
        <Field label={t('form.startMonth')}>
          {(control) => (
            <select
              {...control}
              name="startMonth"
              className="select"
              value={chosenStart}
              onChange={(event) => setChosenStart(event.target.value as YearMonth)}
            >
              {startOptions.map((option) => (
                <option key={option} value={option}>
                  {formatMonth(option, language, 'long')}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {isEdit ? null : (
        <Field label={t('form.category')} hint={t('form.categoryHint')} error={errors.category} isRequired>
          {(control) => (
            <select
              {...control}
              ref={setFieldRef('category')}
              name="categoryId"
              className="select"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">{t('form.categoryPlaceholder')}</option>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryName(category)}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      <Field label={t('form.limit')} hint={t('form.limitHint')} error={errors.limit} isRequired>
        {(control) => (
          <input
            {...control}
            ref={setFieldRef('limit')}
            name="monthlyLimit"
            className="input input--amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={limitText}
            onChange={(event) => setLimitText(event.target.value)}
          />
        )}
      </Field>
    </form>
  );
}
