import { useEffect, useId, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { TransactionSortKey } from '@/application/ports/inbound/QueryTransactions';
import type { Account } from '@/domain/account/Account';
import type { Category } from '@/domain/category/Category';
import type { AmountSign } from '@/domain/rule/Rule';
import { Button } from '@/ui/components/Button';
import { CategoryChip, useCategoryName } from '@/ui/components/CategoryChip';
import { Field } from '@/ui/components/Field';
import { IconClose } from '@/ui/components/icons';
import { Select } from '@/ui/components/Select';
import { formatDate } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { countActiveFilters, parseEuros, SIGNS, SORT_KEYS, type FilterParams } from './filterParams';
import { useDebouncedValue } from './useTransactionFilters';

/** Retraso de la búsqueda y de los importes: filtra al dejar de escribir, no en cada tecla. */
export const SEARCH_DEBOUNCE_MS = 250;

/** Texto, importes y su versión retrasada: se aplican a la URL al dejar de escribir. */
export interface FilterDrafts {
  readonly q: string;
  readonly min: string;
  readonly max: string;
}

type TransactionFiltersProps = {
  params: FilterParams;
  drafts: FilterDrafts;
  onDraftsChange: (drafts: FilterDrafts) => void;
  onChange: (patch: Partial<FilterParams>) => void;
  onClear: () => void;
  categories: readonly Category[];
  accounts: readonly Account[];
  searchRef: RefObject<HTMLInputElement | null>;
};

/** Sincroniza los borradores (texto, importes) con la URL tras `SEARCH_DEBOUNCE_MS`. */
export function useDraftSync(drafts: FilterDrafts, params: FilterParams, onChange: (patch: Partial<FilterParams>) => void) {
  const debounced = useDebouncedValue(drafts, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    const patch: Partial<FilterParams> = {
      ...(debounced.q !== params.q ? { q: debounced.q } : {}),
      ...(debounced.min !== params.min && parseEuros(debounced.min) !== undefined ? { min: debounced.min } : {}),
      ...(debounced.max !== params.max && parseEuros(debounced.max) !== undefined ? { max: debounced.max } : {}),
    };
    if (Object.keys(patch).length > 0) onChange(patch);
    // Solo reacciona al borrador retrasado; `params` se lee en el momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
}

function toggle(list: readonly string[], value: string): readonly string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function accountLabel(account: Account): string {
  return account.ibanLast4 ? `${account.name} ···${account.ibanLast4}` : account.name;
}

interface ActiveChip {
  readonly key: string;
  readonly label: string;
  readonly patch: Partial<FilterParams>;
  readonly draftPatch?: Partial<FilterDrafts>;
}

function useActiveChips(params: FilterParams, categories: readonly Category[], accounts: readonly Account[]): ActiveChip[] {
  const { t } = useTranslation('transactions');
  const language = useLanguage();
  const categoryName = useCategoryName();
  const chips: ActiveChip[] = [];
  const q = params.q.trim();
  if (q) chips.push({ key: 'q', label: t('chips.text', { value: q }), patch: { q: '' }, draftPatch: { q: '' } });
  if (params.from) chips.push({ key: 'from', label: t('chips.from', { value: formatDate(params.from, language) }), patch: { from: '' } });
  if (params.to) chips.push({ key: 'to', label: t('chips.to', { value: formatDate(params.to, language) }), patch: { to: '' } });
  if (params.sign !== 'any') chips.push({ key: 'sign', label: t(`sign.${params.sign}`), patch: { sign: 'any' } });
  for (const id of params.categoryIds) {
    const category = categories.find((c) => c.id === id);
    const name = category ? categoryName(category) : id;
    chips.push({ key: `cat-${id}`, label: name, patch: { categoryIds: params.categoryIds.filter((c) => c !== id) } });
  }
  for (const id of params.accountIds) {
    const account = accounts.find((a) => a.id === id);
    chips.push({
      key: `acc-${id}`,
      label: account ? accountLabel(account) : id,
      patch: { accountIds: params.accountIds.filter((a) => a !== id) },
    });
  }
  if (params.min.trim()) chips.push({ key: 'min', label: t('chips.min', { value: params.min }), patch: { min: '' }, draftPatch: { min: '' } });
  if (params.max.trim()) chips.push({ key: 'max', label: t('chips.max', { value: params.max }), patch: { max: '' }, draftPatch: { max: '' } });
  return chips;
}

type AmountFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function AmountField({ label, value, onChange }: AmountFieldProps) {
  const { t } = useTranslation('transactions');
  const isInvalid = parseEuros(value) === undefined;
  return (
    <Field label={label} error={isInvalid ? t('filters.amountInvalid') : null}>
      {(control) => (
        <input
          {...control}
          className="input input--amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

/**
 * Búsqueda, panel de filtros plegable y chips de filtros activos (a11y §2.5). Los cambios no mueven el foco;
 * «Limpiar filtros» lo devuelve a la búsqueda.
 */
export function TransactionFilters({
  params,
  drafts,
  onDraftsChange,
  onChange,
  onClear,
  categories,
  accounts,
  searchRef,
}: TransactionFiltersProps) {
  const { t } = useTranslation('transactions');
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const activeCount = countActiveFilters(params);
  const chips = useActiveChips(params, categories, accounts);
  const filterableCategories = categories.filter((c) => !c.archived || params.categoryIds.includes(c.id));
  const sortOptions = SORT_KEYS.map((key: TransactionSortKey) => ({ value: key, label: t(`sort.${key}`) }));

  return (
    <section className="tx-filters stack stack--tight" aria-label={t('filters.region')}>
      <div className="tx-filters__bar">
        <Field label={t('search.label')} hint={t('search.hint')} className="tx-filters__search">
          {(control) => (
            <input
              {...control}
              ref={searchRef}
              className="input"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={drafts.q}
              onChange={(event) => onDraftsChange({ ...drafts, q: event.target.value })}
            />
          )}
        </Field>
        <Button
          className="tx-filters__toggle"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((open) => !open)}
        >
          {activeCount > 0 ? t('filters.toggleCount', { count: activeCount }) : t('filters.toggle')}
        </Button>
      </div>

      <div id={panelId} className="tx-filters__panel stack" hidden={!isOpen}>
        <fieldset className="tx-fieldset">
          <legend>{t('filters.dates')}</legend>
          <div className="tx-fieldset__pair">
            <Field label={t('filters.from')}>
              {(control) => (
                <input {...control} className="input" type="date" value={params.from} max={params.to || undefined}
                  onChange={(event) => onChange({ from: event.target.value })} />
              )}
            </Field>
            <Field label={t('filters.to')}>
              {(control) => (
                <input {...control} className="input" type="date" value={params.to} min={params.from || undefined}
                  onChange={(event) => onChange({ to: event.target.value })} />
              )}
            </Field>
          </div>
        </fieldset>

        <fieldset className="tx-fieldset">
          <legend>{t('filters.type')}</legend>
          <div className="cluster">
            {SIGNS.map((sign: AmountSign) => (
              <label key={sign} className="check">
                <input type="radio" name={`${panelId}-sign`} value={sign} checked={params.sign === sign}
                  onChange={() => onChange({ sign })} />
                {t(`sign.${sign}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="tx-fieldset">
          <legend>{t('filters.categories')}</legend>
          <div className="cluster tx-fieldset__chips">
            {filterableCategories.map((category) => (
              <CategoryChip
                key={category.id}
                category={category}
                isPressed={params.categoryIds.includes(category.id)}
                onToggle={() => onChange({ categoryIds: toggle(params.categoryIds, category.id) })}
              />
            ))}
          </div>
        </fieldset>

        {accounts.length > 1 ? (
          <fieldset className="tx-fieldset">
            <legend>{t('filters.accounts')}</legend>
            <div className="cluster">
              {accounts.map((account) => (
                <label key={account.id} className="check">
                  <input type="checkbox" checked={params.accountIds.includes(account.id)}
                    onChange={() => onChange({ accountIds: toggle(params.accountIds, account.id) })} />
                  {accountLabel(account)}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="tx-fieldset">
          <legend>{t('filters.amount')}</legend>
          <div className="tx-fieldset__pair">
            <AmountField label={t('filters.min')} value={drafts.min} onChange={(min) => onDraftsChange({ ...drafts, min })} />
            <AmountField label={t('filters.max')} value={drafts.max} onChange={(max) => onDraftsChange({ ...drafts, max })} />
          </div>
        </fieldset>
      </div>

      <div className="tx-filters__meta">
        {chips.length > 0 ? (
          <ul className="tx-active cluster" aria-label={t('filters.active')}>
            {chips.map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  className="tx-active__chip"
                  aria-label={t('filters.remove', { name: chip.key.startsWith('cat-') ? t('chips.category', { value: chip.label }) : chip.label })}
                  onClick={() => {
                    onChange(chip.patch);
                    if (chip.draftPatch) onDraftsChange({ ...drafts, ...chip.draftPatch });
                  }}
                >
                  <span>{chip.label}</span>
                  <IconClose />
                </button>
              </li>
            ))}
            <li>
              <Button variant="quiet" isSmall onClick={onClear}>
                {t('filters.clear')}
              </Button>
            </li>
          </ul>
        ) : null}
        <div className="tx-filters__sort">
          <Select label={t('sort.label')} value={params.sort} options={sortOptions} onChange={(sort) => onChange({ sort })} />
        </div>
      </div>
    </section>
  );
}
