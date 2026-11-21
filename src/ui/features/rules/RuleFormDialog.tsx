import { useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { AmountSign, Rule, RuleOperator } from '@/domain/rule/Rule';
import type { DomainError } from '@/domain/shared/DomainError';
import { normalizeText } from '@/domain/shared/normalizeText';
import { Button } from '@/ui/components/Button';
import { useCategoryName } from '@/ui/components/CategoryChip';
import { Dialog } from '@/ui/components/Dialog';
import { Field } from '@/ui/components/Field';
import { Select } from '@/ui/components/Select';
import { useContainer } from '@/ui/hooks/useContainer';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { ruleTargetCategories, sortCategories } from './categoryModel';
import { PatternPreviewText } from './PatternPreviewText';
import { MIN_PATTERN_LENGTH } from './ruleMatches';

const OPERATORS: readonly RuleOperator[] = ['contains', 'startsWith', 'equals'];
const SIGNS: readonly AmountSign[] = ['any', 'expense', 'income'];
const NO_CATEGORY = '';

type RuleFormDialogProps = {
  isOpen: boolean;
  /** `null` = regla nueva. */
  rule: Rule | null;
  categories: readonly Category[];
  onClose: () => void;
  onSaved: (rule: Rule, isNew: boolean) => void;
};

/** Alta y edición de reglas en un `<dialog>` modal (a11y §4). */
export function RuleFormDialog({ isOpen, rule, categories, onClose, onSaved }: RuleFormDialogProps) {
  const { t } = useTranslation('rules');
  const patternRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const [isSaving, setIsSaving] = useState(false);
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={rule === null ? t('ruleForm.createTitle') : t('ruleForm.editTitle')}
      initialFocusRef={patternRef}
      footer={
        <>
          <Button onClick={onClose}>{t('actions.cancel')}</Button>
          <Button variant="primary" type="submit" form={formId} isBusy={isSaving}>
            {t('ruleForm.submit')}
          </Button>
        </>
      }
    >
      <RuleForm
        formId={formId}
        rule={rule}
        categories={categories}
        patternRef={patternRef}
        onSavingChange={setIsSaving}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

type FieldErrors = {
  readonly pattern?: string;
  readonly category?: string;
  readonly form?: string;
};

type RuleFormProps = {
  formId: string;
  rule: Rule | null;
  categories: readonly Category[];
  patternRef: RefObject<HTMLInputElement | null>;
  onSavingChange: (isSaving: boolean) => void;
  onSaved: (rule: Rule, isNew: boolean) => void;
};

function RuleForm({ formId, rule, categories, patternRef, onSavingChange, onSaved }: RuleFormProps) {
  const { t, i18n } = useTranslation('rules');
  const { manageCatalog } = useContainer();
  const categoryName = useCategoryName();
  const categoryRef = useRef<HTMLSelectElement>(null);
  const isSubmittingRef = useRef(false);
  const [pattern, setPattern] = useState(rule?.pattern ?? '');
  const [operator, setOperator] = useState<RuleOperator>(rule?.operator ?? 'contains');
  const [amountSign, setAmountSign] = useState<AmountSign>(rule?.amountSign ?? 'any');
  const [categoryId, setCategoryId] = useState<string>(rule?.categoryId ?? NO_CATEGORY);
  const [isEnabled, setIsEnabled] = useState(rule?.enabled ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const accountId = rule?.accountId ?? null;

  const targets = sortCategories(ruleTargetCategories(categories, rule?.categoryId ?? null), categoryName, i18n.language);
  const categoryOptions: readonly { value: string; label: string; isDisabled: boolean }[] = [
    { value: NO_CATEGORY, label: t('ruleForm.categoryPlaceholder'), isDisabled: true },
    ...targets.map((c) => ({ value: c.id as string, label: categoryName(c), isDisabled: false })),
  ];

  const validate = (): FieldErrors => ({
    ...(normalizeText(pattern).length < MIN_PATTERN_LENGTH ? { pattern: t('ruleForm.patternTooShort') } : {}),
    ...(categoryId === NO_CATEGORY ? { category: t('ruleForm.categoryRequired') } : {}),
  });

  const showErrors = (next: FieldErrors) => {
    setErrors(next);
    if (next.pattern) patternRef.current?.focus();
    else if (next.category) categoryRef.current?.focus();
  };

  const fromDomain = (error: DomainError): FieldErrors => {
    if (error.code === 'rule.invalidPattern') return { pattern: t('ruleForm.patternTooShort') };
    if (error.code === 'category.notFound') return { category: errorMessage(t, error) };
    return { form: errorMessage(t, error) };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmittingRef.current) return;
    const invalid = validate();
    if (invalid.pattern || invalid.category) {
      showErrors(invalid);
      return;
    }
    isSubmittingRef.current = true;
    onSavingChange(true);
    try {
      const result = await manageCatalog.saveRule({
        ...(rule === null ? {} : { id: rule.id }),
        pattern,
        operator,
        amountSign,
        accountId,
        categoryId: categoryId as CategoryId,
        enabled: isEnabled,
      });
      if (result.ok) onSaved(result.value, rule === null);
      else showErrors(fromDomain(result.error));
    } catch {
      setErrors({ form: errorMessage(t, null) });
    } finally {
      isSubmittingRef.current = false;
      onSavingChange(false);
    }
  };

  return (
    <form id={formId} className="rules-form stack" noValidate onSubmit={handleSubmit}>
      {errors.form ? (
        <p className="field__error" role="alert">
          {errors.form}
        </p>
      ) : null}
      <Field label={t('ruleForm.pattern')} hint={t('ruleForm.patternHint')} error={errors.pattern} isRequired>
        {(control) => (
          <input
            {...control}
            ref={patternRef}
            className="input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
          />
        )}
      </Field>
      <PatternPreviewText criteria={{ pattern, operator, amountSign, accountId }} />
      <Select
        label={t('ruleForm.operator')}
        value={operator}
        options={OPERATORS.map((value) => ({ value, label: t(`operator.${value}`) }))}
        onChange={setOperator}
      />
      <Field label={t('ruleForm.category')} error={errors.category} isRequired>
        {(control) => (
          <select
            {...control}
            ref={categoryRef}
            className="select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value} disabled={option.isDisabled}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Select
        label={t('ruleForm.sign')}
        value={amountSign}
        options={SIGNS.map((value) => ({ value, label: t(`sign.${value}`) }))}
        onChange={setAmountSign}
      />
      <label className="check">
        <input type="checkbox" checked={isEnabled} onChange={(event) => setIsEnabled(event.target.checked)} />
        {t('ruleForm.enabled')}
      </label>
    </form>
  );
}
