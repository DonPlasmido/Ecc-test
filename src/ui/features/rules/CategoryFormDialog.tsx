import { useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category, CategoryKind } from '@/domain/category/Category';
import { Button } from '@/ui/components/Button';
import { useCategoryName } from '@/ui/components/CategoryChip';
import { Dialog } from '@/ui/components/Dialog';
import { Field } from '@/ui/components/Field';
import { Select } from '@/ui/components/Select';
import { useContainer } from '@/ui/hooks/useContainer';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { COLOR_TOKENS, isFixedCategory, suggestColor, toColorToken, type ColorToken } from './categoryModel';

const KINDS: readonly CategoryKind[] = ['expense', 'income', 'transfer'];

type CategoryFormDialogProps = {
  isOpen: boolean;
  /** `null` = categoría nueva. */
  category: Category | null;
  categories: readonly Category[];
  onClose: () => void;
  onSaved: (category: Category, isNew: boolean) => void;
};

/** Alta, renombrado y archivado de categorías. */
export function CategoryFormDialog({ isOpen, category, categories, onClose, onSaved }: CategoryFormDialogProps) {
  const { t } = useTranslation('rules');
  const nameRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const [isSaving, setIsSaving] = useState(false);
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={category === null ? t('categoryForm.createTitle') : t('categoryForm.editTitle')}
      initialFocusRef={nameRef}
      footer={
        <>
          <Button onClick={onClose}>{t('actions.cancel')}</Button>
          <Button variant="primary" type="submit" form={formId} isBusy={isSaving}>
            {t('categoryForm.submit')}
          </Button>
        </>
      }
    >
      <CategoryForm
        formId={formId}
        category={category}
        categories={categories}
        nameRef={nameRef}
        onSavingChange={setIsSaving}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

type CategoryFormProps = {
  formId: string;
  category: Category | null;
  categories: readonly Category[];
  nameRef: RefObject<HTMLInputElement | null>;
  onSavingChange: (isSaving: boolean) => void;
  onSaved: (category: Category, isNew: boolean) => void;
};

function CategoryForm({ formId, category, categories, nameRef, onSavingChange, onSaved }: CategoryFormProps) {
  const { t } = useTranslation('rules');
  const { manageCatalog } = useContainer();
  const categoryName = useCategoryName();
  const shownName = category === null ? '' : categoryName(category);
  const [name, setName] = useState(shownName);
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'expense');
  const [color, setColor] = useState<ColorToken>(category ? toColorToken(category.color) : suggestColor(categories));
  const [isArchived, setIsArchived] = useState(category?.archived ?? false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const isFixed = category !== null && isFixedCategory(category.id);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmittingRef.current) return;
    if (name.trim() === '') {
      setNameError(t('categoryForm.nameRequired'));
      nameRef.current?.focus();
      return;
    }
    isSubmittingRef.current = true;
    onSavingChange(true);
    try {
      // Sin cambios en el nombre traducido se envía el guardado: la categoría por defecto sigue traduciéndose.
      const sentName = category !== null && name === shownName ? category.name : name;
      // Si el color no cambia se conserva el token original (`chart-11`, `income-1`…).
      const sentColor = category !== null && color === toColorToken(category.color) ? category.color : color;
      const result = await manageCatalog.saveCategory({
        ...(category === null ? {} : { id: category.id }),
        name: sentName,
        kind,
        color: sentColor,
        archived: isArchived,
      });
      if (result.ok) {
        onSaved(result.value, category === null);
      } else if (result.error.code === 'category.invalidName') {
        setNameError(errorMessage(t, result.error));
        nameRef.current?.focus();
      } else {
        setFormError(errorMessage(t, result.error));
      }
    } catch {
      setFormError(errorMessage(t, null));
    } finally {
      isSubmittingRef.current = false;
      onSavingChange(false);
    }
  };

  return (
    <form id={formId} className="rules-form stack" noValidate onSubmit={handleSubmit}>
      {formError ? (
        <p className="field__error" role="alert">
          {formError}
        </p>
      ) : null}
      <Field label={t('categoryForm.name')} error={nameError} isRequired>
        {(control) => (
          <input
            {...control}
            ref={nameRef}
            className="input"
            type="text"
            autoComplete="off"
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>
      <Select
        label={t('categoryForm.kind')}
        value={kind}
        options={KINDS.map((value) => ({ value, label: t(`kind.${value}`) }))}
        onChange={setKind}
      />
      <fieldset className="rules-colors">
        <legend className="field__label">{t('categoryForm.color')}</legend>
        <div className="rules-colors__grid">
          {COLOR_TOKENS.map((token) => (
            <label key={token} className="rules-swatch" data-color={token}>
              <input
                type="radio"
                name={`${formId}-color`}
                value={token}
                checked={color === token}
                onChange={() => setColor(token)}
              />
              <span className="rules-swatch__mark" aria-hidden="true" />
              <span className="rules-swatch__label">{t(`color.${token}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {category !== null && !isFixed ? (
        <label className="check">
          <input type="checkbox" checked={isArchived} onChange={(event) => setIsArchived(event.target.checked)} />
          {t('categoryForm.archived')}
        </label>
      ) : null}
    </form>
  );
}
