import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Account } from '@/domain/account/Account';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { Transaction } from '@/domain/transaction/Transaction';
import { Button } from '@/ui/components/Button';
import { useCategoryName } from '@/ui/components/CategoryChip';
import { DateText } from '@/ui/components/DateText';
import { Dialog } from '@/ui/components/Dialog';
import { Field } from '@/ui/components/Field';
import { MoneyText } from '@/ui/components/MoneyText';
import { Select } from '@/ui/components/Select';

/** Cambios pedidos desde el diálogo (solo los campos que cambian). */
export interface TransactionChanges {
  readonly categoryId?: CategoryId;
  readonly description?: string;
  readonly note?: string;
}

type TransactionDetailDialogProps = {
  transaction: Transaction;
  categories: readonly Category[];
  accounts: readonly Account[];
  onClose: () => void;
  /** Guarda; devuelve un mensaje de error ya traducido o `null` si todo fue bien. */
  onSave: (changes: TransactionChanges) => Promise<string | null>;
};

function diff(transaction: Transaction, form: Required<TransactionChanges>): TransactionChanges {
  return {
    ...(form.categoryId !== transaction.categoryId ? { categoryId: form.categoryId } : {}),
    ...(form.description.trim() !== transaction.description ? { description: form.description.trim() } : {}),
    ...(form.note !== transaction.note ? { note: form.note } : {}),
  };
}

/**
 * Detalle y edición de un movimiento (a11y §3): concepto completo, fecha e importe de solo lectura,
 * categoría con `<select>` nativo, concepto visible y nota. El foco inicial va a la categoría.
 */
export function TransactionDetailDialog({ transaction, categories, accounts, onClose, onSave }: TransactionDetailDialogProps) {
  const { t } = useTranslation('transactions');
  const categoryName = useCategoryName();
  const formId = useId();
  const categoryRef = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState<Required<TransactionChanges>>({
    categoryId: transaction.categoryId,
    description: transaction.description,
    note: transaction.note,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const account = accounts.find((a) => a.id === transaction.accountId);
  const options = categories
    .filter((c) => !c.archived || c.id === transaction.categoryId)
    .map((c) => ({ value: c.id, label: categoryName(c) }));
  const categoryFieldId = `${formId}-category`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const changes = diff(transaction, form);
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    if (changes.description === '') {
      setError(t('detail.descriptionRequired'));
      return;
    }
    setIsSaving(true);
    const failure = await onSave(changes);
    setIsSaving(false);
    setError(failure);
  };

  const footer = (
    <>
      <Button variant="quiet" onClick={onClose}>
        {t('detail.cancel')}
      </Button>
      <Button variant="primary" type="submit" form={formId} isBusy={isSaving}>
        {t('detail.save')}
      </Button>
    </>
  );

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={t('detail.title')}
      footer={footer}
      initialFocusRef={categoryRef}
    >
      <dl className="tx-detail">
        <div>
          <dt>{t('detail.original')}</dt>
          <dd className="tx-detail__concept">{transaction.rawDescription}</dd>
        </div>
        <div>
          <dt>{t('detail.date')}</dt>
          <dd><DateText value={transaction.date} dateStyle="long" /></dd>
        </div>
        <div>
          <dt>{t('detail.amount')}</dt>
          <dd><MoneyText value={transaction.amount} hasKindLabel isFigure /></dd>
        </div>
        {account ? (
          <div>
            <dt>{t('detail.account')}</dt>
            <dd>{account.name}</dd>
          </div>
        ) : null}
      </dl>
      <p className="field__hint">{t('detail.readOnly')}</p>
      <form id={formId} className="stack" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <CategorySelect
          id={categoryFieldId}
          label={t('detail.category')}
          value={form.categoryId}
          options={options}
          onChange={(categoryId) => setForm({ ...form, categoryId })}
          onMount={(element) => {
            categoryRef.current = element;
          }}
        />
        <Field label={t('detail.description')} hint={t('detail.descriptionHint')}>
          {(control) => (
            <input
              {...control}
              className="input"
              type="text"
              autoComplete="off"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          )}
        </Field>
        <Field label={t('detail.note')}>
          {(control) => (
            <textarea
              {...control}
              className="textarea"
              rows={3}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          )}
        </Field>
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

type CategorySelectProps = {
  id: string;
  label: string;
  value: CategoryId;
  options: readonly { value: CategoryId; label: string }[];
  onChange: (value: CategoryId) => void;
  onMount: (element: HTMLElement | null) => void;
};

/** `Select` compartido no expone `ref`: se localiza su `<select>` para el foco inicial. */
function CategorySelect({ id, label, value, options, onChange, onMount }: CategorySelectProps) {
  return (
    <div
      ref={(node) => {
        onMount(node?.querySelector<HTMLElement>('select') ?? null);
      }}
    >
      <Select id={id} label={label} value={value} options={options} onChange={onChange} />
    </div>
  );
}
