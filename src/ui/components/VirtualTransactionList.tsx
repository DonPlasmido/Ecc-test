import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import type { TransactionSortKey } from '@/application/ports/inbound/QueryTransactions';
import type { Category, CategoryId } from '@/domain/category/Category';
import type { Transaction } from '@/domain/transaction/Transaction';
import { CategoryChip } from './CategoryChip';
import { DateText } from './DateText';
import { MoneyText } from './MoneyText';
import { Skeleton } from './Skeleton';

/** Altura fija de fila en `rem` (= `--row-height`, ADR-0008): escala con la fuente del sistema. */
export const ROW_HEIGHT_REM = 3.5;
const HEADER_HEIGHT_REM = 2.5;
const OVERSCAN_ROWS = 8;
const DEFAULT_ROOT_FONT_PX = 16;
const COLUMN_COUNT = 4;
const FALLBACK_PAGE_ROWS = 10;

type VirtualTransactionListProps = {
  /** Nombre accesible del grid. */
  label: string;
  /** Total filtrado (conocido por el índice en memoria). */
  total: number;
  /** Fila ya cargada o `undefined` mientras llega su página. */
  getRow: (index: number) => Transaction | undefined;
  categoriesById: ReadonlyMap<CategoryId, Category>;
  /** Rango visible (incluye overscan) para pedir páginas a `QueryTransactions.page`. */
  onRangeChange?: (startIndex: number, endIndex: number) => void;
  /** Enter, Espacio o clic sobre una fila: abre la edición. */
  onActivateRow?: (transaction: Transaction, index: number) => void;
  sortKey?: TransactionSortKey;
};

function rootFontSizePx(): number {
  if (typeof window === 'undefined') return DEFAULT_ROOT_FONT_PX;
  const size = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_ROOT_FONT_PX;
}

function ariaSort(column: 'date' | 'amount', sortKey: TransactionSortKey | undefined) {
  if (!sortKey?.startsWith(column)) return undefined;
  return sortKey.endsWith('Desc') ? 'descending' : 'ascending';
}

function clampIndex(index: number, total: number): number {
  return Math.min(Math.max(index, 0), Math.max(total - 1, 0));
}

type RowProps = {
  index: number;
  transaction: Transaction | undefined;
  category: Category | undefined;
  offsetPx: number;
  isActive: boolean;
};

/** Fila memoizada: solo se repinta si cambia su contenido, posición o foco. */
const TransactionRow = memo(function TransactionRow({ index, transaction, category, offsetPx, isActive }: RowProps) {
  const { t } = useTranslation();
  const rowProps = {
    role: 'row',
    'aria-rowindex': index + 2,
    'data-index': index,
    tabIndex: isActive ? 0 : -1,
    className: 'vgrid__row',
    style: { transform: `translateY(${offsetPx}px)`, height: `${ROW_HEIGHT_REM}rem` },
  } as const;

  if (!transaction) {
    return (
      <div {...rowProps} aria-busy="true">
        <div role="gridcell" aria-colindex={1} className="vgrid__loading">
          <span className="visually-hidden">{t('transactions.grid.loadingRow')}</span>
          <Skeleton variant="text" />
        </div>
      </div>
    );
  }

  return (
    <div {...rowProps}>
      <div role="gridcell" aria-colindex={1} className="vgrid__date">
        <DateText value={transaction.date} />
      </div>
      <div role="gridcell" aria-colindex={2} className="vgrid__desc">
        {transaction.description}
      </div>
      <div role="gridcell" aria-colindex={3} className="vgrid__cat">
        {category ? <CategoryChip category={category} /> : t('categories.uncategorized')}
      </div>
      <div role="gridcell" aria-colindex={4} className="vgrid__amount">
        <MoneyText value={transaction.amount} hasKindLabel />
      </div>
    </div>
  );
});

/**
 * Lista virtualizada de movimientos (ADR-0008, a11y §2): `role="grid"` con `aria-rowcount`
 * (total + cabecera) y `aria-rowindex`, roving tabindex con foco real, filas de altura fija en
 * `rem`, y la fila activa siempre montada para no perder el foco al desplazarse.
 */
export function VirtualTransactionList({
  label,
  total,
  getRow,
  categoriesById,
  onRangeChange,
  onActivateRow,
  sortKey,
}: VirtualTransactionListProps) {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocusActive = useRef(false);
  const [rowPx] = useState(() => ROW_HEIGHT_REM * rootFontSizePx());
  const [headerPx] = useState(() => HEADER_HEIGHT_REM * rootFontSizePx());
  const [activeIndexState, setActiveIndex] = useState(0);
  const activeIndex = clampIndex(activeIndexState, total);

  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      if (total === 0 || indexes.includes(activeIndex)) return indexes;
      return [...indexes, activeIndex].sort((a, b) => a - b);
    },
    [activeIndex, total],
  );

  // El virtualizador es mutable por diseño (ADR-0008); su uso queda confinado a este componente.
  // eslint-disable-next-line react-hooks/incompatible-library -- sin React Compiler activo (ADR-0008, riesgos)
  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => gridRef.current,
    estimateSize: () => rowPx,
    overscan: OVERSCAN_ROWS,
    scrollMargin: headerPx,
    scrollPaddingStart: headerPx,
    rangeExtractor,
  });
  const items = virtualizer.getVirtualItems();
  const firstIndex = items[0]?.index ?? 0;
  const lastIndex = items.at(-1)?.index ?? -1;

  useEffect(() => {
    if (lastIndex >= 0) onRangeChange?.(firstIndex, lastIndex);
  }, [firstIndex, lastIndex, onRangeChange]);

  useLayoutEffect(() => {
    if (!shouldFocusActive.current) return;
    shouldFocusActive.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.focus({ preventScroll: true });
  }, [activeIndex]);

  const moveTo = (index: number) => {
    const next = clampIndex(index, total);
    shouldFocusActive.current = true;
    setActiveIndex(next);
    virtualizer.scrollToIndex(next, { align: 'auto' });
  };

  const activate = (index: number) => {
    const transaction = getRow(index);
    if (transaction) onActivateRow?.(transaction, index);
  };

  const pageRows = () => {
    const viewport = virtualizer.scrollRect?.height ?? 0;
    const rows = Math.floor((viewport - headerPx) / rowPx);
    return rows > 0 ? rows : FALLBACK_PAGE_ROWS;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (total === 0) return;
    const keyActions: Record<string, (() => void) | undefined> = {
      ArrowDown: () => moveTo(activeIndex + 1),
      ArrowUp: () => moveTo(activeIndex - 1),
      PageDown: () => moveTo(activeIndex + pageRows()),
      PageUp: () => moveTo(activeIndex - pageRows()),
      Home: event.ctrlKey ? () => moveTo(0) : undefined,
      End: event.ctrlKey ? () => moveTo(total - 1) : undefined,
      Enter: () => activate(activeIndex),
      ' ': () => activate(activeIndex),
    };
    const action = keyActions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const rowIndexOf = (target: EventTarget): number | null => {
    const row = target instanceof Element ? target.closest<HTMLElement>('[data-index]') : null;
    const index = row ? Number(row.dataset.index) : Number.NaN;
    return Number.isInteger(index) ? index : null;
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    const index = rowIndexOf(event.target);
    if (index !== null && index !== activeIndex) setActiveIndex(index);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const index = rowIndexOf(event.target);
    if (index === null) return;
    setActiveIndex(index);
    activate(index);
  };

  return (
    <div
      ref={gridRef}
      className="vgrid"
      role="grid"
      aria-label={label}
      aria-rowcount={total + 1}
      aria-colcount={COLUMN_COUNT}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onClick={handleClick}
    >
      <div role="rowgroup" className="vgrid__head" style={{ height: `${HEADER_HEIGHT_REM}rem` }}>
        <div role="row" aria-rowindex={1} className="vgrid__head-row">
          <div role="columnheader" aria-colindex={1} aria-sort={ariaSort('date', sortKey)}>
            {t('transactions.grid.date')}
          </div>
          <div role="columnheader" aria-colindex={2}>
            {t('transactions.grid.description')}
          </div>
          <div role="columnheader" aria-colindex={3}>
            {t('transactions.grid.category')}
          </div>
          <div role="columnheader" aria-colindex={4} aria-sort={ariaSort('amount', sortKey)}>
            {t('transactions.grid.amount')}
          </div>
        </div>
      </div>
      <div role="rowgroup" className="vgrid__body" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((item) => {
          const transaction = getRow(item.index);
          return (
            <TransactionRow
              key={item.key}
              index={item.index}
              transaction={transaction}
              category={transaction ? categoriesById.get(transaction.categoryId) : undefined}
              offsetPx={item.start - headerPx}
              isActive={item.index === activeIndex}
            />
          );
        })}
      </div>
    </div>
  );
}
