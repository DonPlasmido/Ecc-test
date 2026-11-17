import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, CategoryId } from '@/domain/category/Category';
import { VirtualTransactionList } from '@/ui/components/VirtualTransactionList';
import { groceries, makeTransaction } from './fixtures';
import { renderWithProviders, setupI18n } from './renderWithProviders';

const TOTAL = 10_000;
const VIEWPORT = { width: 400, height: 600 };
/** 3.5 rem × 16 px. */
const ROW_PX = 56;

const categoriesById: ReadonlyMap<CategoryId, Category> = new Map([[groceries.id, groceries]]);
const rows = Array.from({ length: TOTAL }, (_, index) => makeTransaction(index));
const getRow = (index: number) => rows[index];

// jsdom no tiene layout: se da tamaño al contenedor y se simula el scroll del navegador.
const clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const scrollTopDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight');
const originalScrollTo = Element.prototype.scrollTo;
const scrollTops = new WeakMap<Element, number>();

beforeAll(() => {
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get(this: Element) {
      return scrollTops.get(this) ?? 0;
    },
    set(this: Element, value: number) {
      scrollTops.set(this, value);
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('vgrid') ? VIEWPORT.height : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('vgrid') ? VIEWPORT.width : 0;
    },
  });
  Object.defineProperty(Element.prototype, 'scrollHeight', {
    configurable: true,
    get(this: Element) {
      return this.classList.contains('vgrid') ? (TOTAL + 1) * ROW_PX : 0;
    },
  });
  Element.prototype.scrollTo = function scrollTo(this: Element, options?: ScrollToOptions | number) {
    const top = typeof options === 'object' ? (options.top ?? 0) : 0;
    this.scrollTop = top;
    this.dispatchEvent(new Event('scroll'));
  } as Element['scrollTo'];
});

afterAll(() => {
  if (clientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight);
  if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
  if (scrollTopDescriptor) Object.defineProperty(Element.prototype, 'scrollTop', scrollTopDescriptor);
  if (scrollHeightDescriptor) Object.defineProperty(Element.prototype, 'scrollHeight', scrollHeightDescriptor);
  Element.prototype.scrollTo = originalScrollTo;
});

beforeEach(async () => {
  await setupI18n('es');
});

function renderList(overrides: Partial<Parameters<typeof VirtualTransactionList>[0]> = {}) {
  return renderWithProviders(
    <VirtualTransactionList
      label="Movimientos"
      total={TOTAL}
      getRow={getRow}
      categoriesById={categoriesById}
      sortKey="dateDesc"
      {...overrides}
    />,
  );
}

function dataRows(grid: HTMLElement): HTMLElement[] {
  return within(grid)
    .getAllByRole('row')
    .filter((row) => row.getAttribute('aria-rowindex') !== '1');
}

describe('VirtualTransactionList', () => {
  it('renders only a window of rows out of 10.000 with the full aria-rowcount', () => {
    renderList();

    const grid = screen.getByRole('grid', { name: 'Movimientos' });
    expect(grid).toHaveAttribute('aria-rowcount', String(TOTAL + 1));
    expect(grid).toHaveAttribute('aria-colcount', '4');
    const rendered = dataRows(grid);
    expect(rendered.length).toBeGreaterThan(5);
    expect(rendered.length).toBeLessThan(40);
    expect(rendered.map((row) => Number(row.getAttribute('aria-rowindex')))).toEqual(
      rendered.map((_, index) => index + 2),
    );
  });

  it('exposes header cells with aria-sort and readable rows', () => {
    renderList();

    expect(screen.getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByRole('columnheader', { name: 'Importe' })).not.toHaveAttribute('aria-sort');
    const firstRow = dataRows(screen.getByRole('grid'))[0];
    if (!firstRow) throw new Error('no rows');
    const cells = within(firstRow).getAllByRole('gridcell');
    expect(cells.map((cell) => cell.getAttribute('aria-colindex'))).toEqual(['1', '2', '3', '4']);
    expect(firstRow).toHaveTextContent('01/03/2026');
    expect(firstRow).toHaveTextContent('Movimiento 0');
    expect(firstRow).toHaveTextContent('Supermercado');
    expect(firstRow).toHaveTextContent(/-10,00\s€ \(gasto\)/);
  });

  it('uses a single tab stop (roving tabindex) and moves real focus with the arrows', async () => {
    const user = userEvent.setup();
    renderList();
    const grid = screen.getByRole('grid');
    const [first, second] = dataRows(grid);

    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('tabindex', '0');
    expect(first).toHaveAttribute('tabindex', '-1');
  });

  it('jumps to the last of 10.000 rows with Ctrl+End and keeps the active row mounted', async () => {
    const user = userEvent.setup();
    renderList();
    await user.tab();

    await user.keyboard('{Control>}{End}{/Control}');

    const grid = screen.getByRole('grid');
    const active = document.activeElement as HTMLElement;
    expect(active).toHaveAttribute('aria-rowindex', String(TOTAL + 1));
    expect(active).toHaveTextContent(`Movimiento ${TOTAL - 1}`);
    expect(grid.scrollTop).toBeGreaterThan((TOTAL - 20) * ROW_PX);

    await user.keyboard('{Control>}{Home}{/Control}');
    expect(document.activeElement).toHaveAttribute('aria-rowindex', '2');
  });

  it('activates the focused row with Enter and with a click', async () => {
    const user = userEvent.setup();
    const onActivateRow = vi.fn();
    renderList({ onActivateRow });
    await user.tab();

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onActivateRow).toHaveBeenLastCalledWith(rows[1], 1);

    await user.click(screen.getByText('Movimiento 3'));
    expect(onActivateRow).toHaveBeenLastCalledWith(rows[3], 3);
  });

  it('reports the visible range so pages can be requested', async () => {
    const onRangeChange = vi.fn();
    renderList({ onRangeChange });

    expect(onRangeChange).toHaveBeenCalled();
    const [start, end] = onRangeChange.mock.lastCall ?? [];
    expect(start).toBe(0);
    expect(end).toBeGreaterThan(5);
    expect(end).toBeLessThan(40);

    const grid = screen.getByRole('grid');
    act(() => {
      grid.scrollTop = 5_000 * ROW_PX;
      fireEvent.scroll(grid);
    });
    await waitFor(() => {
      const [scrolledStart] = onRangeChange.mock.lastCall ?? [];
      expect(scrolledStart).toBeGreaterThan(4_900);
    });
    // La fila activa (la primera) sigue montada aunque esté fuera de la ventana.
    const mountedIndexes = dataRows(grid).map((row) => row.getAttribute('aria-rowindex'));
    expect(mountedIndexes[0]).toBe('2');
    expect(mountedIndexes.length).toBeLessThan(40);
  });

  it('renders busy placeholder rows while their page is loading', () => {
    renderList({ getRow: () => undefined });

    const firstRow = dataRows(screen.getByRole('grid'))[0];
    expect(firstRow).toHaveAttribute('aria-busy', 'true');
    expect(firstRow).toHaveTextContent('Cargando movimiento');
  });

  it('handles an empty result', () => {
    renderList({ total: 0 });

    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-rowcount', '1');
    expect(within(grid).getAllByRole('row')).toHaveLength(1);
  });
});
