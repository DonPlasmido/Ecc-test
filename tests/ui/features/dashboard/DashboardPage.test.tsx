import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContainer } from '@/composition/createTestContainer';
import type { AppContainer } from '@/composition/container.types';
import { DashboardPage } from '@/ui/features/dashboard/DashboardPage';
import { renderWithProviders, setupI18n } from '../../renderWithProviders';
import { createSeededContainer } from './seedDashboard';

/** Normaliza espacios duros de `Intl` para comparar texto. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/\s/g, ' ');

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderDashboard(container: AppContainer, route = '/') {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
      <LocationProbe />
    </>,
    { container, route },
  );
}

async function section(name: RegExp | string) {
  return screen.findByRole('region', { name });
}

describe('DashboardPage', () => {
  beforeEach(async () => {
    await setupI18n('es');
  });

  describe('first use (AC-030)', () => {
    it('shows an empty ledger with links to import a statement or try sample data', async () => {
      // Arrange
      const container = await createTestContainer();

      // Act
      renderDashboard(container);

      // Assert
      const empty = await section(/libro de cuentas está vacío/i);
      expect(within(empty).getByRole('link', { name: 'Importar extracto' })).toHaveAttribute('href', '/importar');
      expect(within(empty).getByRole('link', { name: 'Probar con datos de ejemplo' })).toHaveAttribute(
        'href',
        '/importar?ejemplo=1',
      );
      expect(within(empty).getAllByRole('listitem')).toHaveLength(3);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('with a seeded ledger', () => {
    let container: AppContainer;

    beforeEach(async () => {
      container = await createSeededContainer();
    });

    it('opens on the latest month with movements and leads with what was spent', async () => {
      renderDashboard(container);

      const hero = await section('Gastado en marzo de 2026');
      expect(plain(hero.querySelector('.dash-hero__figure')?.textContent)).toBe('590,56 €');
      expect(screen.getByRole('combobox', { name: 'Mes' })).toHaveValue('2026-03');
    });

    it('says in words whether spending went up or down versus the previous month', async () => {
      renderDashboard(container);

      const hero = await section('Gastado en marzo de 2026');
      expect(plain(hero.textContent)).toContain('97 % más que en febrero de 2026 (+290,56 €)');
    });

    it('summarises income, spending and savings for the month (AC-027)', async () => {
      renderDashboard(container);

      const hero = await section('Gastado en marzo de 2026');
      const terms = within(hero).getAllByRole('term').map((term) => term.textContent);
      const values = within(hero).getAllByRole('definition').map((value) => plain(value.textContent));
      expect(terms).toEqual(['Ingresos', 'Gastos', 'Ahorro']);
      expect(values).toEqual(['2000,00 €', '590,56 €', '+1409,44 €']);
    });

    it('lists spending by category, sorted, and its table matches to the cent (AC-025, AC-029)', async () => {
      const user = userEvent.setup();
      renderDashboard(container);

      const categories = await section('¿En qué se ha ido?');
      const chart = within(categories).getByRole('img', { name: /Gasto por categoría, marzo de 2026/ });
      expect(chart).toBeInTheDocument();
      await user.click(within(categories).getByRole('button', { name: 'Ver como tabla' }));

      const table = within(categories).getByRole('table', { name: 'Gasto por categoría, marzo de 2026' });
      const rows = within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => plain(row.textContent));
      expect(rows).toEqual([
        'Supermercado400,00 €',
        'Restaurantes y cafés120,50 €',
        'Transporte60,06 €',
        'Sin categoría10,00 €',
      ]);
    });

    it('shows 12 months of income and spending with zeros for empty months (AC-026)', async () => {
      const user = userEvent.setup();
      renderDashboard(container);

      const trend = await section('¿Mejor o peor que otros meses?');
      expect(within(trend).getByRole('img', { name: /Ingresos y gastos, abril de 2025 – marzo de 2026/ })).toBeInTheDocument();
      await user.click(within(trend).getByRole('button', { name: 'Ver como tabla' }));

      const rows = within(within(trend).getByRole('table')).getAllByRole('row').slice(1);
      expect(rows).toHaveLength(12);
      expect(plain(rows[0]?.textContent)).toBe('abr 250,00 €0,00 €');
      expect(plain(rows[6]?.textContent)).toBe('oct 250,00 €45,00 €');
      expect(plain(rows[11]?.textContent)).toBe('mar 262000,00 €590,56 €');
    });

    it('surfaces the budgets at risk, worst first, and links to Budgets', async () => {
      renderDashboard(container);

      const budgets = await section('¿Qué presupuesto se me va?');
      const items = within(budgets).getAllByRole('group');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveAccessibleName('Supermercado');
      expect(items[1]).toHaveAccessibleName('Restaurantes y cafés');
      expect(within(items[0] as HTMLElement).getByText('Superado')).toBeInTheDocument();
      expect(within(items[1] as HTMLElement).getByText('Cerca del límite')).toBeInTheDocument();
      expect(within(budgets).getByRole('link', { name: /Ver todos los presupuestos/ })).toHaveAttribute(
        'href',
        '/presupuestos',
      );
    });

    it('shows «Sin saldo en el extracto» instead of a misleading computed balance (AC-028)', async () => {
      renderDashboard(container);

      const balances = await section('¿Cuánto tengo?');
      const [checking, savings] = within(balances).getAllByRole('listitem');
      expect(plain(checking?.textContent)).toContain('Cuenta nómina···1234+3210,99 €');
      expect(checking).not.toHaveTextContent('estimado');
      expect(savings).toHaveTextContent('Sin saldo en el extracto');
      expect(savings).not.toHaveTextContent('estimado');
      expect(within(balances).queryByText(/^Total en/)).not.toBeInTheDocument();
      expect(within(balances).queryByText(/^Estimado:/)).not.toBeInTheDocument();
    });

    it('moves to another month with the picker and keeps it in the URL', async () => {
      const user = userEvent.setup();
      renderDashboard(container);
      await section('Gastado en marzo de 2026');

      await user.click(screen.getByRole('button', { name: 'Mes anterior' }));

      const hero = await section('Gastado en febrero de 2026');
      expect(plain(hero.querySelector('.dash-hero__figure')?.textContent)).toBe('300,00 €');
      expect(plain(hero.textContent)).toContain('Sin gastos en enero de 2026 para comparar');
      expect(screen.getByTestId('location')).toHaveTextContent('/?mes=2026-02');
      expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled();
    });

    it('shows the requested month in the picker while it loads, so fast clicks are not lost', async () => {
      let release: () => void = () => undefined;
      let gate: Promise<void> = Promise.resolve();
      const slow: AppContainer = {
        ...container,
        buildDashboard: Object.assign(Object.create(container.buildDashboard) as AppContainer['buildDashboard'], {
          execute: async (input: Parameters<AppContainer['buildDashboard']['execute']>[0]) => {
            await gate;
            return container.buildDashboard.execute(input);
          },
        }),
      };
      const user = userEvent.setup();
      renderDashboard(slow);
      await section('Gastado en marzo de 2026');
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });

      await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
      expect(screen.getByRole('combobox', { name: 'Mes' })).toHaveValue('2026-02');
      await user.click(screen.getByRole('button', { name: 'Mes anterior' }));

      expect(screen.getByTestId('location')).toHaveTextContent('/?mes=2026-01');
      release();
      await section('Gastado en enero de 2026');
    });

    it('opens the month given in the URL and ignores an invalid one', async () => {
      const { unmount } = renderDashboard(container, '/?mes=2025-10');
      expect(await section('Gastado en octubre de 2025')).toBeInTheDocument();
      unmount();

      renderDashboard(container, '/?mes=2026-13');
      expect(await section('Gastado en marzo de 2026')).toBeInTheDocument();
    });

    it('tells the user all budgets are fine when none is at risk', async () => {
      renderDashboard(container, '/?mes=2026-01');

      const budgets = await section('¿Qué presupuesto se me va?');
      expect(budgets).toHaveTextContent('Todos tus presupuestos van bien en enero de 2026.');
    });

    it('formats figures in English when the language is English (a11y 3.1.2)', async () => {
      await setupI18n('en');
      renderDashboard(container);

      const hero = await section('Spent in March 2026');
      expect(plain(hero.querySelector('.dash-hero__figure')?.textContent)).toBe('€590.56');
      expect(plain(hero.textContent)).toContain('97% more than in February 2026 (+€290.56)');
      await setupI18n('es');
    });
  });

  it('invites to create a budget when there are none', async () => {
    const container = await createSeededContainer({ hasBudgets: false });
    renderDashboard(container);

    const budgets = await section('¿Qué presupuesto se me va?');
    expect(within(budgets).getByRole('link', { name: /Crear un presupuesto/ })).toHaveAttribute('href', '/presupuestos');
  });

  it('refreshes when new data reaches the index', async () => {
    const container = await createTestContainer();
    renderDashboard(container);
    await section(/vacío/i);

    const account = await container.manageCatalog.saveAccount({ name: 'Cuenta', ibanLast4: null });
    if (!account.ok) throw new Error('account');
    const bytes = new TextEncoder().encode('Fecha;Concepto;Importe\n02/03/2026;MERCADONA;-42,10\n');
    const preview = await container.importStatement.preview({ name: 'm.csv', bytes: bytes.buffer as ArrayBuffer });
    if (!preview.ok) throw new Error('preview');
    await container.importStatement.commit({
      previewId: preview.value.previewId,
      accountId: account.value.id,
      mapping: preview.value.suggestedMapping,
    });
    await container.whenIndexIdle();

    await waitFor(() => expect(screen.getByRole('region', { name: 'Gastado en marzo de 2026' })).toBeInTheDocument());
  });
});
