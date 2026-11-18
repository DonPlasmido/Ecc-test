import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { Transaction } from '@/domain/transaction/Transaction';
import { Button } from '@/ui/components/Button';
import { useCategoryName } from '@/ui/components/CategoryChip';
import { EmptyState } from '@/ui/components/EmptyState';
import { MoneyText } from '@/ui/components/MoneyText';
import { Skeleton } from '@/ui/components/Skeleton';
import { useNotifications } from '@/ui/components/Toast';
import { VirtualTransactionList } from '@/ui/components/VirtualTransactionList';
import { useAsync } from '@/ui/hooks/useAsync';
import { useContainer } from '@/ui/hooks/useContainer';
import { useTransactionIndex } from '@/ui/hooks/useTransactionIndex';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { formatInteger } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { ROUTES } from '@/ui/routes';
import { Page } from '@/ui/layout/Page';
import { countActiveFilters, filterKey, toTransactionFilter } from './filterParams';
import { RuleSuggestionDialog, type RuleProposal } from './RuleSuggestionDialog';
import { TransactionDetailDialog, type TransactionChanges } from './TransactionDetailDialog';
import { TransactionFilters, useDraftSync, type FilterDrafts } from './TransactionFilters';
import { useTransactionFilters } from './useTransactionFilters';
import { useTransactionResults } from './useTransactionResults';
import './transactions.css';

/** Pausa antes de anunciar el recuento (a11y §2.5: un solo anuncio por ráfaga de cambios). */
export const ANNOUNCE_DELAY_MS = 600;

function useCatalog() {
  const { manageCatalog } = useContainer();
  const loadCatalog = useCallback(
    // `async`: un fallo síncrono del puerto se convierte en rechazo (estado de error, no excepción de render).
    async () => Promise.all([manageCatalog.listCategories(), manageCatalog.listAccounts()]),
    [manageCatalog],
  );
  const catalog = useAsync(loadCatalog);
  const [categories, accounts] = catalog.status === 'success' ? catalog.data : [[], []];
  const categoriesById = useMemo(
    () => new Map<CategoryId, Category>(categories.map((c) => [c.id, c])),
    [categories],
  );
  return { categories, accounts, categoriesById };
}

/** Movimientos: búsqueda y filtros en la URL, lista virtualizada, edición y propuesta de regla (F5, AC-019). */
export function TransactionsPage() {
  const { t } = useTranslation('transactions');
  const { t: tc } = useTranslation();
  const language = useLanguage();
  const categoryName = useCategoryName();
  const { queryTransactions, learnRuleFromCorrection } = useContainer();
  const { announce } = useNotifications();
  const snapshot = useTransactionIndex();
  const { categories, accounts, categoriesById } = useCatalog();
  const { params, update, clear } = useTransactionFilters();
  const [drafts, setDrafts] = useState<FilterDrafts>({ q: params.q, min: params.min, max: params.max });
  const searchRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [proposal, setProposal] = useState<RuleProposal | null>(null);
  useDraftSync(drafts, params, update);

  const filter = useMemo(() => toTransactionFilter(params), [params]);
  const results = useTransactionResults(filter, params.sort, snapshot.version);
  const { summary } = results;
  const key = filterKey(params);
  const isFiltered = countActiveFilters(params) > 0;
  const isHydrating = snapshot.hydration.status === 'idle' || snapshot.hydration.status === 'hydrating';

  useResultAnnouncement(summary?.total ?? null, results.isSearching ? null : key, isFiltered);

  const handleClear = () => {
    clear();
    setDrafts({ q: '', min: '', max: '' });
    searchRef.current?.focus();
  };

  const handleSave = async (transaction: Transaction, changes: TransactionChanges): Promise<string | null> => {
    if (changes.description !== undefined || changes.note !== undefined) {
      const patch = { description: changes.description, note: changes.note };
      const updated = await queryTransactions.update({ id: transaction.id, patch });
      if (!updated.ok) return errorMessage(tc, updated.error);
    }
    if (changes.categoryId === undefined) {
      setEditing(null);
      announce(t('detail.saved'));
      return null;
    }
    const corrected = await learnRuleFromCorrection.correct({ transactionId: transaction.id, categoryId: changes.categoryId });
    if (!corrected.ok) return errorMessage(tc, corrected.error);
    const category = categoriesById.get(changes.categoryId);
    setEditing(null);
    announce(t('detail.categoryChanged', { category: category ? categoryName(category) : '' }));
    const { suggestion, affectedCount } = corrected.value;
    if (suggestion) setProposal({ suggestion, affectedCount });
    return null;
  };

  const handleAcceptRule = async (pattern: string, applyToExisting: boolean): Promise<string | null> => {
    if (!proposal) return null;
    const accepted = await learnRuleFromCorrection.accept({ suggestion: { ...proposal.suggestion, pattern }, applyToExisting });
    if (!accepted.ok) return errorMessage(tc, accepted.error);
    setProposal(null);
    const count = accepted.value.recategorized;
    announce(t('rule.created', { count, formatted: formatInteger(count, language) }));
    return null;
  };

  const countContaining = useCallback(
    async (pattern: string) => (await queryTransactions.search({ filter: { text: pattern }, sort: 'dateDesc' })).total,
    [queryTransactions],
  );

  const renderResults = () => {
    if (isHydrating || (summary === null && results.error === null)) {
      return (
        <div className="stack" aria-busy="true">
          <span className="visually-hidden">{t('loading')}</span>
          <Skeleton variant="row" count={6} />
        </div>
      );
    }
    if (results.error !== null) {
      return (
        <EmptyState title={t('error.title')} text={t('error.text')} />
      );
    }
    if (snapshot.size === 0) {
      return (
        <EmptyState
          title={t('empty.title')}
          text={t('empty.text')}
          action={
            <Link className="btn btn--primary" to={ROUTES.import}>
              {t('empty.action')}
            </Link>
          }
        />
      );
    }
    if (summary?.total === 0) {
      return (
        <EmptyState
          title={t('noResults.title')}
          text={t('noResults.text')}
          action={<Button onClick={handleClear}>{t('filters.clear')}</Button>}
        />
      );
    }
    return (
      <VirtualTransactionList
        key={key}
        label={t('list.label')}
        total={summary?.total ?? 0}
        getRow={results.getRow}
        categoriesById={categoriesById}
        onRangeChange={results.requestRange}
        onActivateRow={setEditing}
        sortKey={params.sort}
      />
    );
  };

  return (
    <Page title={tc('pages.transactions.title')} intro={tc('pages.transactions.intro')}>
      <div className="tx-page stack">
        <TransactionFilters
          params={params}
          drafts={drafts}
          onDraftsChange={setDrafts}
          onChange={update}
          onClear={handleClear}
          categories={categories}
          accounts={accounts}
          searchRef={searchRef}
        />
        {summary !== null && snapshot.size > 0 ? (
          <p className="tx-summary" aria-busy={results.isSearching || undefined}>
            <span className="tx-summary__count tabular">
              {t('summary.count', { count: summary.total, formatted: formatInteger(summary.total, language) })}
            </span>
            <span className="tx-summary__sum">
              {t('summary.sum')} <MoneyText value={summary.sum} isFigure />
            </span>
          </p>
        ) : null}
        {renderResults()}
      </div>
      {editing ? (
        <TransactionDetailDialog
          key={editing.id}
          transaction={editing}
          categories={categories}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSave={(changes) => handleSave(editing, changes)}
        />
      ) : null}
      {proposal ? (
        <RuleSuggestionDialog
          proposal={proposal}
          categoryLabel={(() => {
            const category = categoriesById.get(proposal.suggestion.categoryId);
            return category ? categoryName(category) : '';
          })()}
          onClose={() => setProposal(null)}
          onAccept={handleAcceptRule}
          countContaining={countContaining}
        />
      ) : null}
    </Page>
  );
}

/**
 * Anuncia el recuento en la región `status` global (no en la lista, a11y §2.5) cuando cambia el filtro,
 * con retraso para que una ráfaga de cambios produzca un único anuncio. `settledKey` es `null` mientras busca.
 */
function useResultAnnouncement(total: number | null, settledKey: string | null, isFiltered: boolean) {
  const { t } = useTranslation('transactions');
  const language = useLanguage();
  const { announce } = useNotifications();
  const lastAnnounced = useRef<string | null>(null);

  useEffect(() => {
    if (total === null || settledKey === null) return undefined;
    if (lastAnnounced.current === null) {
      lastAnnounced.current = settledKey; // carga inicial: el recuento ya es visible, no se anuncia
      return undefined;
    }
    if (lastAnnounced.current === settledKey) return undefined;
    const timer = window.setTimeout(() => {
      lastAnnounced.current = settledKey;
      const formatted = formatInteger(total, language);
      if (total === 0) announce(t('announce.none'));
      else announce(isFiltered ? t('announce.found', { count: total, formatted }) : t('announce.all', { count: total, formatted }));
    }, ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [total, settledKey, isFiltered, announce, t, language]);
}
