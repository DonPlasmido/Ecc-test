import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppContainer } from '@/composition/container.types';
import { UNCATEGORIZED } from '@/domain/category/Category';
import type { TransactionId } from '@/domain/transaction/Transaction';
import { tx } from '../../../fixtures/txBuilder';
import { setupI18n } from '../../renderWithProviders';
import { account, installFakeGridLayout, renderTransactionsPage, seededContainer } from './helpers';

installFakeGridLayout();

const SETTLE = { timeout: 3000 };

const DATASET = [
  tx({ id: 'n1', desc: 'NETFLIX.COM 1234', cents: -1299, cat: UNCATEGORIZED, date: '2026-03-01' }),
  ...[2, 3, 4, 5, 6].map((n) =>
    tx({ id: `n${n}`, desc: `NETFLIX.COM ${n}00${n}`, cents: -1299, cat: UNCATEGORIZED, date: `2025-1${n % 3}-0${n}` }),
  ),
  tx({ id: 'm1', desc: 'COMPRA MERCADONA VALENCIA', cents: -4230, cat: 'cat-groceries', date: '2026-03-05' }),
  tx({ id: 'm2', desc: 'MERCADONA ALICANTE', cents: -1500, cat: 'cat-groceries', date: '2026-02-10', acc: 'a2' }),
  tx({ id: 's1', desc: 'NÓMINA EMPRESA SA', cents: 200_000, cat: 'cat-salary', date: '2026-02-28' }),
  tx({ id: 'c1', desc: 'CAFÉ CENTRAL', cents: -350, cat: 'cat-restaurants', date: '2026-01-15' }),
];

const ACCOUNTS = [account('a1', 'Cuenta nómina', '1234'), account('a2', 'Ahorro')];

function dataRows(): HTMLElement[] {
  return within(screen.getByRole('grid'))
    .getAllByRole('row')
    .filter((row) => row.getAttribute('aria-rowindex') !== '1');
}

async function renderPage(route = '/movimientos'): Promise<AppContainer> {
  const container = await seededContainer(DATASET, ACCOUNTS);
  renderTransactionsPage(container, route);
  await screen.findByRole('grid', { name: 'Movimientos' }, SETTLE);
  return container;
}

function summaryText(): string {
  return document.querySelector('.tx-summary__count')?.textContent ?? '';
}

beforeEach(async () => {
  await setupI18n('es');
});

describe('TransactionsPage: empty state', () => {
  it('offers a link to Import when there are no transactions', async () => {
    const container = await seededContainer([]);
    renderTransactionsPage(container);

    expect(await screen.findByRole('heading', { name: 'Aún no hay movimientos' }, SETTLE)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Importar extracto' })).toHaveAttribute('href', '/importar');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});

describe('TransactionsPage: list, search and filters', () => {
  it('shows every transaction with the count and the filtered total', async () => {
    await renderPage();

    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', String(DATASET.length + 1));
    await waitFor(() => expect(dataRows()[0]).toHaveTextContent('COMPRA MERCADONA VALENCIA'), SETTLE);
    expect(summaryText()).toBe('10 movimientos');
    // −12,99×6 −42,30 −15,00 +2.000,00 −3,50 = 1.861,26 €
    expect(document.querySelector('.tx-summary__sum')).toHaveTextContent(/\+1\.?861,26\s€/);
  });

  it('filters by text after the debounce, ignoring case and accents, and stores it in the URL', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar movimientos' }), 'cafe');

    await waitFor(() => expect(summaryText()).toBe('1 movimiento'), SETTLE);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '2');
    expect(screen.getByTestId('location')).toHaveTextContent('?q=cafe');
    // Aplicar el filtro no mueve el foco (a11y §2.5, 3.2.2).
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await waitFor(() => expect(dataRows()[0]).toHaveTextContent('CAFÉ CENTRAL'), SETTLE);
  });

  it('announces the result count once in a status region outside the grid', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar movimientos' }), 'mercadona');

    const status = screen.getAllByRole('status').find((region) => region.getAttribute('aria-live') === 'polite');
    if (!status) throw new Error('no polite status region');
    await waitFor(() => expect(status).toHaveTextContent('2 movimientos encontrados'), SETTLE);
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-live');
    expect(screen.getByRole('grid').contains(status)).toBe(false);
  });

  it('restores filters from the URL and combines them with AND', async () => {
    await renderPage('/movimientos?tipo=expense&cat=cat-groceries&cuenta=a1&min=20');

    await waitFor(() => expect(summaryText()).toBe('1 movimiento'), SETTLE);
    const toggle = screen.getByRole('button', { name: 'Filtros (4)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('radio', { name: 'Gastos' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Cuenta nómina ···1234' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Supermercado' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(dataRows()[0]).toHaveTextContent('COMPRA MERCADONA VALENCIA'), SETTLE);
  });

  it('filters by date range and amount from the filter panel', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const dates = screen.getByRole('group', { name: 'Fechas' });
    await user.type(within(dates).getByLabelText('Desde'), '2026-02-01');
    await waitFor(() => expect(summaryText()).toBe('4 movimientos'), SETTLE);

    await user.type(screen.getByLabelText('Máximo'), '20');
    await waitFor(() => expect(summaryText()).toBe('2 movimientos'), SETTLE);
    expect(screen.getByTestId('location')).toHaveTextContent('desde=2026-02-01');
    expect(screen.getByTestId('location')).toHaveTextContent('max=20');
  });

  it('flags an invalid amount without applying it', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: 'Filtros' }));

    await user.type(screen.getByLabelText('Mínimo'), '12,5,0');

    expect(screen.getByLabelText('Mínimo')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Escribe un importe como 12,50.')).toHaveAttribute('role', 'alert');
    expect(summaryText()).toBe('10 movimientos');
  });

  it('sorts by amount and marks the column header', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'amountDesc');

    await waitFor(() => expect(dataRows()[0]).toHaveTextContent('NÓMINA EMPRESA SA'), SETTLE);
    expect(screen.getByRole('columnheader', { name: 'Importe' })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByTestId('location')).toHaveTextContent('orden=amountDesc');
  });

  it('removes a single filter from its chip and clears all filters returning focus to the search', async () => {
    const user = userEvent.setup();
    renderTransactionsPage(await seededContainer(DATASET, ACCOUNTS), '/movimientos?q=zzz&tipo=income');
    await screen.findByRole('heading', { name: 'Ningún movimiento coincide' }, SETTLE);

    await user.click(screen.getByRole('button', { name: 'Quitar filtro: «zzz»' }));
    await waitFor(() => expect(summaryText()).toBe('1 movimiento'), SETTLE);
    expect(screen.getByRole('searchbox')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(summaryText()).toBe('10 movimientos'), SETTLE);
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(screen.getByTestId('location')).toBeEmptyDOMElement();
  });
});

describe('TransactionsPage: editing and rule suggestion (AC-019, AC-035)', () => {
  async function openNetflix(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByRole('searchbox'), 'netflix.com 1234');
    await waitFor(() => expect(summaryText()).toBe('1 movimiento'), SETTLE);
    const row = await waitFor(() => {
      const [first] = dataRows();
      expect(first).toHaveTextContent('NETFLIX.COM 1234');
      return first as HTMLElement;
    }, SETTLE);
    await user.click(row);
    return screen.getByRole('dialog', { name: 'Movimiento' });
  }

  it('shows the full concept with read-only date and amount and saves the note', async () => {
    const user = userEvent.setup();
    const container = await renderPage();
    const dialog = await openNetflix(user);

    expect(within(dialog).getByText('NETFLIX.COM 1234')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Categoría')).toHaveFocus();
    expect(within(dialog).queryByLabelText('Fecha')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Nota'), 'Plan familiar');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [stored] = await container.queryTransactions
      .search({ filter: { text: 'netflix.com 1234' }, sort: 'dateDesc' })
      .then((result) => container.queryTransactions.page({ resultId: result.resultId, offset: 0, limit: 1 }));
    expect(stored?.note).toBe('Plan familiar');
  });

  it('corrects the category, proposes an editable rule with its reach and creates it only on accept', async () => {
    const user = userEvent.setup();
    const container = await renderPage();
    const dialog = await openNetflix(user);

    await user.selectOptions(within(dialog).getByLabelText('Categoría'), 'cat-leisure');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    const ruleDialog = await screen.findByRole('dialog', { name: '¿Crear regla?' }, SETTLE);
    expect(ruleDialog).toHaveAccessibleDescription('Si el concepto contiene «NETFLIX.COM», asignar Ocio.');
    const pattern = within(ruleDialog).getByLabelText(/Texto que debe contener el concepto/);
    expect(pattern).toHaveValue('NETFLIX.COM');
    expect(pattern).toHaveFocus();
    expect(within(ruleDialog).getByText('Afectaría a 5 movimientos más.')).toBeInTheDocument();
    expect(await container.manageCatalog.listRules()).toHaveLength(0);

    await user.click(within(ruleDialog).getByRole('button', { name: 'Crear regla' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), SETTLE);
    const rules = await container.manageCatalog.listRules();
    expect(rules.map((rule) => [rule.pattern, rule.categoryId])).toEqual([['NETFLIX.COM', 'cat-leisure']]);
    await waitFor(() => expect(screen.getByText('Regla creada. 5 movimientos recategorizados.')).toBeInTheDocument(), SETTLE);
  });

  it('previews an edited pattern, validates it and creates nothing when dismissed', async () => {
    const user = userEvent.setup();
    const container = await renderPage();
    const dialog = await openNetflix(user);
    await user.selectOptions(within(dialog).getByLabelText('Categoría'), 'cat-leisure');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    const ruleDialog = await screen.findByRole('dialog', { name: '¿Crear regla?' }, SETTLE);
    const pattern = within(ruleDialog).getByLabelText(/Texto que debe contener el concepto/);

    await user.clear(pattern);
    await user.type(pattern, 'n');
    await user.click(within(ruleDialog).getByRole('button', { name: 'Crear regla' }));
    expect(within(ruleDialog).getByText('El texto debe tener al menos 2 caracteres.')).toHaveAttribute('role', 'alert');

    await user.type(pattern, 'etflix');
    expect(await within(ruleDialog).findByText('Aprox. 6 movimientos contienen este texto.', {}, SETTLE)).toBeInTheDocument();

    await user.click(within(ruleDialog).getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await container.manageCatalog.listRules()).toHaveLength(0);
    const [corrected] = await container.queryTransactions
      .search({ filter: { categoryIds: ['cat-leisure' as never] }, sort: 'dateDesc' })
      .then((r) => container.queryTransactions.page({ resultId: r.resultId, offset: 0, limit: 10 }));
    expect(corrected?.id).toBe('n1' as TransactionId);
    expect(corrected?.categorySource).toBe('manual');
  });
});
