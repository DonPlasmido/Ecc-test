import { useTranslation } from 'react-i18next';
import type { Account, AccountId } from '@/domain/account/Account';
import { Field } from '@/ui/components/Field';
import { Select, type SelectOption } from '@/ui/components/Select';
import type { AccountChoice } from './useImportFlow';

/** Valor del `<select>` para «Nueva cuenta…» (los ids reales nunca empiezan por `__`). */
const NEW_ACCOUNT = '__new__';

type AccountPickerProps = {
  accounts: readonly Account[];
  value: AccountChoice;
  defaultNewName: string;
  isDisabled: boolean;
  onChange: (choice: AccountChoice) => void;
};

/** Cuenta destino: una existente o una nueva con nombre editable (se crea al confirmar). */
export function AccountPicker({ accounts, value, defaultNewName, isDisabled, onChange }: AccountPickerProps) {
  const { t } = useTranslation('import');
  const options: readonly SelectOption<string>[] = [
    ...accounts.map((account) => ({ value: account.id as string, label: account.name })),
    { value: NEW_ACCOUNT, label: t('account.new') },
  ];

  const handleSelect = (selected: string) => {
    if (selected === NEW_ACCOUNT) onChange({ kind: 'new', name: defaultNewName });
    else onChange({ kind: 'existing', id: selected as AccountId });
  };

  return (
    <div className="stack">
      <Select
        label={t('account.label')}
        value={value.kind === 'new' ? NEW_ACCOUNT : value.id}
        options={options}
        isDisabled={isDisabled}
        onChange={handleSelect}
      />
      {value.kind === 'new' ? (
        <Field label={t('account.newName')} isRequired>
          {(control) => (
            <input
              {...control}
              className="input"
              type="text"
              autoComplete="off"
              maxLength={80}
              value={value.name}
              disabled={isDisabled}
              onChange={(event) => onChange({ kind: 'new', name: event.target.value })}
            />
          )}
        </Field>
      ) : null}
    </div>
  );
}
