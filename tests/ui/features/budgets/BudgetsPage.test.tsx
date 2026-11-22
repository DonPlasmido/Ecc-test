import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AppContainer } from '@/composition/container.types';
import { createTestContainer } from '@/composition/createTestContainer';
import type { CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { YearMonth } from '@/domain/date/YearMonth';
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction';
import { BudgetsPage } from '@/ui/features/budgets/BudgetsPage';
import { createInMemoryState } from '../../../fakes/InMemoryState';
import { InMemoryTransactionRepository } from '../../../fakes/InMemoryTransactionRepository';
import { makeTransaction, money } from '../../fixtures';
import { renderWithProviders, setupI18n } from '../../renderWithProviders';

const MARCH = '2026-03' as YearMonth;
const cat = (slug: string) => `cat-${slug}` as CategoryId;

interface SpendInput {
  readonly slug: string;
  readonly date: string;
  readonly cents: number;
}

let txCounter = 0;
function spend({ slug, date, cents }: SpendInput): Transaction {
  txCounter += 1;
  return { ...makeTransaction(txCounter), id: `tx-b-${txCounter}` as TransactionId, date: date as IsoDate, amount: money(-cents), categoryId: cat(slug) };
}

/** Contenedor de test con movimientos sembrados antes de hidratar el índice. */
async function containerWith(transactions: readonly Transaction[] = []): Promise<AppContainer> {
  const state = createInMemoryState();
  for (const tx of transactions) state.transactions.set(tx.id, tx);
  return createTestContainer({ transactions: new InMemoryTransactionRepository(state) });
}

async function addBudget(container: AppContainer, slug: string, cents: number, startMonth: YearMonth = MARCH) {
  const saved = await container.manageCatalog.saveBudget({
    categoryId: cat(slug),
    monthlyLimit: money(cents),
    startMonth,
    endMonth: null,
  });
  if (!saved.ok) throw new Error(saved.error.code);
  return saved.value;
}

function renderPage(container: AppContainer, month: string = MARCH) {
  return renderWithProviders(<BudgetsPage />, { container, route: `/presupuestos?mes=${month}` });
}

const budgetList = () => screen.findByRole('list', { name: /presupuestos de marzo de 2026/i });
const nbsp = (text: string) => text.replace(/\s/g, ' ');

describe('BudgetsPage', () => {
  beforeAll(async () => {
    await setupI18n('es');
  });

  it('shows an empty state with the add action and no suggestions when there is no history', async () => {
    renderPage(await containerWith());

    expect(await screen.findByRole('heading', { name: /sin presupuestos en marzo de 2026/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir presupuesto' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /sugerencias/i })).not.toBeInTheDocument();
  });

  it('lists budgets ordered by risk with status text, amounts and remaining (AC-024)', async () => {
    // Arrange
    const container = await containerWith([
      spend({ slug: 'groceries', date: '2026-03-03', cents: 30_001 }),
      spend({ slug: 'transport', date: '2026-03-05', cents: 24_000 }),
      spend({ slug: 'leisure', date: '2026-03-07', cents: 1_000 }),
      spend({ slug: 'leisure', date: '2026-02-07', cents: 99_000 }),
    ]);
    await addBudget(container, 'leisure', 10_000);
    await addBudget(container, 'transport', 30_000);
    await addBudget(container, 'groceries', 30_000);

    // Act
    renderPage(container);
    const items = within(await budgetList()).getAllByRole('listitem');

    // Assert
    expect(items.map((item) => within(item).getByRole('group').getAttribute('aria-labelledby'))).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Supermercado');
    expect(items[0]).toHaveTextContent('Superado');
    expect(nbsp(items[0]?.textContent ?? '')).toContain('Te has pasado 0,01 €');
    expect(items[1]).toHaveTextContent('Transporte');
    expect(items[1]).toHaveTextContent('Cerca del límite');
    expect(nbsp(items[1]?.textContent ?? '')).toContain('240,00 € de 300,00 €');
    expect(items[2]).toHaveTextContent('Ocio');
    expect(items[2]).toHaveTextContent('Dentro del presupuesto');
    expect(nbsp(items[2]?.textContent ?? '')).toContain('Quedan 90,00 €');
  });

  it('summarises budgeted versus spent for the month', async () => {
    const container = await containerWith([spend({ slug: 'groceries', date: '2026-03-03', cents: 35_000 })]);
    await addBudget(container, 'groceries', 30_000);
    await addBudget(container, 'transport', 20_000);

    renderPage(container);
    const summary = await screen.findByRole('region', { name: 'Resumen del mes' });

    expect(nbsp(summary.textContent ?? '')).toContain('350,00 € gastados de 500,00 € presupuestados');
    expect(nbsp(summary.textContent ?? '')).toContain('150,00 €');
    expect(summary).toHaveTextContent('1 categoría superada');
  });

  it('validates the form and creates a budget (AC-021)', async () => {
    // Arrange
    const user = userEvent.setup();
    const container = await containerWith();
    renderPage(container);
    await user.click(await screen.findByRole('button', { name: 'Añadir presupuesto' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo presupuesto' });
    const category = within(dialog).getByRole('combobox', { name: /categoría/i });
    const limit = within(dialog).getByRole('textbox', { name: /límite mensual/i });

    // Act: envío vacío
    await user.click(within(dialog).getByRole('button', { name: 'Guardar presupuesto' }));

    // Assert: errores enlazados y foco en el primero
    expect(category).toHaveAttribute('aria-invalid', 'true');
    expect(limit).toHaveAttribute('aria-invalid', 'true');
    expect(category).toHaveFocus();
    expect(within(dialog).getByText('Elige una categoría.')).toBeInTheDocument();

    // Act: más de dos decimales y cero
    await user.selectOptions(category, 'Supermercado');
    await user.type(limit, '12,345');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar presupuesto' }));
    expect(limit).toHaveAccessibleDescription(/dos decimales como máximo/i);
    expect(limit).toHaveFocus();
    await user.clear(limit);
    await user.type(limit, '0');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar presupuesto' }));
    expect(within(dialog).getByText('El límite debe ser mayor que cero.')).toBeInTheDocument();

    // Act: válido
    await user.clear(limit);
    await user.type(limit, '300');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar presupuesto' }));

    // Assert
    const item = within(await budgetList()).getByRole('listitem');
    expect(nbsp(item.textContent ?? '')).toContain('0,00 € de 300,00 €');
    expect(await screen.findByText('Presupuesto de Supermercado guardado.')).toBeInTheDocument();
    const [budget] = await container.manageCatalog.listBudgets();
    expect(budget).toMatchObject({ categoryId: cat('groceries'), monthlyLimit: { cents: 30_000 }, startMonth: MARCH, endMonth: null });
  });

  it('keeps focus on the list heading after saving the first budget from the empty state', async () => {
    const user = userEvent.setup();
    renderPage(await containerWith());
    await user.click(await screen.findByRole('button', { name: 'Añadir presupuesto' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo presupuesto' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /categoría/i }), 'Supermercado');
    await user.type(within(dialog).getByRole('textbox', { name: /límite mensual/i }), '300');

    await user.click(within(dialog).getByRole('button', { name: 'Guardar presupuesto' }));

    await budgetList();
    const heading = screen.getByRole('heading', { name: 'Por categoría' });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('creates only one budget when the form is submitted twice in the same tick', async () => {
    const user = userEvent.setup();
    const container = await containerWith();
    renderPage(container);
    await user.click(await screen.findByRole('button', { name: 'Añadir presupuesto' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo presupuesto' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /categoría/i }), 'Supermercado');
    await user.type(within(dialog).getByRole('textbox', { name: /límite mensual/i }), '300');

    const form = dialog.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await budgetList();
    await waitFor(async () => expect(await container.manageCatalog.listBudgets()).toHaveLength(1));
  });

  it('lets a new budget start in an earlier month than the one being viewed', async () => {
    const user = userEvent.setup();
    const container = await containerWith();
    renderPage(container);
    await user.click(await screen.findByRole('button', { name: 'Añadir presupuesto' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo presupuesto' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /aplicar desde/i }), '2025-12');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /categoría/i }), 'Supermercado');
    await user.type(within(dialog).getByRole('textbox', { name: /límite mensual/i }), '300');

    await user.click(within(dialog).getByRole('button', { name: 'Guardar presupuesto' }));

    await waitFor(async () => {
      const [budget] = await container.manageCatalog.listBudgets();
      expect(budget?.startMonth).toBe('2025-12');
    });
  });

  it('does not offer categories that already have a budget', async () => {
    const user = userEvent.setup();
    const container = await containerWith();
    await addBudget(container, 'groceries', 30_000);
    renderPage(container);

    await user.click(await screen.findByRole('button', { name: 'Añadir presupuesto' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo presupuesto' });
    const options = within(dialog).getAllByRole('option').map((o) => o.textContent);

    expect(options).not.toContain('Supermercado');
    expect(options).toContain('Transporte');
    expect(options).not.toContain('Nómina');
  });

  it('edits the limit and announces when the budget becomes exceeded', async () => {
    // Arrange
    const user = userEvent.setup();
    const container = await containerWith([spend({ slug: 'groceries', date: '2026-03-03', cents: 20_000 })]);
    await addBudget(container, 'groceries', 30_000);
    renderPage(container);
    const item = within(await budgetList()).getByRole('listitem');

    // Act
    await user.click(within(item).getByRole('button', { name: 'Editar presupuesto de Supermercado' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar presupuesto de Supermercado' });
    const limit = within(dialog).getByRole('textbox', { name: /límite mensual/i });
    expect(limit).toHaveValue('300,00');
    expect(limit).toHaveFocus();
    await user.clear(limit);
    await user.type(limit, '150');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar presupuesto' }));

    // Assert
    await waitFor(() => expect(within(screen.getByRole('listitem')).getByText('Superado')).toBeInTheDocument());
    expect(await screen.findByText('Presupuesto de Supermercado superado.')).toBeInTheDocument();
    expect((await container.manageCatalog.listBudgets())[0]?.monthlyLimit.cents).toBe(15_000);
  });

  it('confirms before deleting, with focus on Cancel, and returns to the empty state', async () => {
    // Arrange
    const user = userEvent.setup();
    const container = await containerWith();
    await addBudget(container, 'groceries', 30_000);
    renderPage(container);
    const item = within(await budgetList()).getByRole('listitem');

    // Act
    await user.click(within(item).getByRole('button', { name: 'Borrar presupuesto de Supermercado' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Borrar el presupuesto de Supermercado?' });

    // Assert
    expect(dialog).toHaveAccessibleDescription(/se borra el límite de todos los meses/i);
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Borrar presupuesto' }));

    // Assert
    expect(await screen.findByRole('heading', { name: /sin presupuestos en marzo de 2026/i })).toBeInTheDocument();
    expect(await container.manageCatalog.listBudgets()).toEqual([]);
    expect(screen.getByText('Presupuesto de Supermercado borrado.')).toBeInTheDocument();
  });

  it('averages suggestions only over the months that have data', async () => {
    // Arrange: diciembre y febrero con gasto, enero vacío
    const container = await containerWith([
      spend({ slug: 'groceries', date: '2025-12-10', cents: 20_000 }),
      spend({ slug: 'groceries', date: '2026-02-10', cents: 20_000 }),
    ]);
    await container.whenIndexIdle();
    renderPage(container);

    // Act
    const suggestions = await screen.findByRole('region', { name: /sugerencias según tu gasto/i });

    // Assert
    expect(nbsp(within(suggestions).getAllByRole('listitem')[0]?.textContent ?? '')).toContain('200,00 € al mes');
  });

  it('suggests limits from the average spending of the previous three months', async () => {
    // Arrange: 600 € en supermercado y 90 € en transporte entre diciembre y febrero
    const user = userEvent.setup();
    const container = await containerWith([
      spend({ slug: 'groceries', date: '2025-12-10', cents: 20_000 }),
      spend({ slug: 'groceries', date: '2026-01-10', cents: 20_000 }),
      spend({ slug: 'groceries', date: '2026-02-10', cents: 20_000 }),
      spend({ slug: 'transport', date: '2026-02-11', cents: 9_000 }),
      spend({ slug: 'groceries', date: '2025-11-10', cents: 500_000 }),
    ]);
    await container.whenIndexIdle();
    renderPage(container);

    // Act
    const suggestions = await screen.findByRole('region', { name: /sugerencias según tu gasto/i });
    const items = within(suggestions).getAllByRole('listitem');

    // Assert
    expect(items).toHaveLength(2);
    expect(nbsp(items[0]?.textContent ?? '')).toContain('200,00 € al mes');
    expect(nbsp(items[1]?.textContent ?? '')).toContain('30,00 € al mes');

    // Act: aceptar la sugerencia rellena el formulario
    await user.click(within(items[0] as HTMLElement).getByRole('button', { name: /crear presupuesto de supermercado/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo presupuesto' });
    expect(within(dialog).getByRole('combobox', { name: /categoría/i })).toHaveValue(cat('groceries'));
    expect(within(dialog).getByRole('textbox', { name: /límite mensual/i })).toHaveValue('200,00');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar presupuesto' }));

    // Assert
    expect(within(await budgetList()).getByRole('listitem')).toHaveTextContent('Supermercado');
  });

  it('switches month with the previous and next buttons', async () => {
    const user = userEvent.setup();
    const container = await containerWith();
    await addBudget(container, 'groceries', 30_000, '2026-04' as YearMonth);
    renderPage(container);

    expect(await screen.findByRole('heading', { name: /sin presupuestos en marzo de 2026/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));

    expect(await screen.findByRole('list', { name: /presupuestos de abril de 2026/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Mes' })).toHaveTextContent('abril de 2026');
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(await screen.findByRole('heading', { name: /sin presupuestos en marzo de 2026/i })).toBeInTheDocument();
  });

  it('shows a retryable error when budgets cannot be loaded', async () => {
    // Arrange
    const user = userEvent.setup();
    const container = await containerWith();
    let failures = 1;
    const evaluateBudgets = {
      execute: (input: { month: YearMonth }) =>
        failures-- > 0 ? Promise.reject(new Error('boom')) : container.evaluateBudgets.execute(input),
    };
    renderPage({ ...container, evaluateBudgets });

    // Act
    const message = await screen.findByText('No se han podido cargar los presupuestos.');
    const alert = message.closest('[role="alert"]') as HTMLElement;
    expect(alert).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    // Assert
    expect(await screen.findByRole('heading', { name: /sin presupuestos en marzo de 2026/i })).toBeInTheDocument();
  });
});
