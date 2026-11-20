import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { BarChart } from '@/ui/components/charts/BarChart';
import { LineChart } from '@/ui/components/charts/LineChart';
import { renderWithProviders, setupI18n } from './renderWithProviders';

beforeEach(async () => {
  await setupI18n('es');
});

const SPENDING = [
  { key: 'groceries', label: 'Supermercado', value: 32_000, color: 'var(--color-cat-1)' },
  { key: 'leisure', label: 'Ocio', value: 8_000 },
];

describe('BarChart', () => {
  it('exposes the bars as one image with a data summary', () => {
    renderWithProviders(<BarChart title="Gasto por categoría" data={SPENDING} />);

    const image = screen.getByRole('img');
    expect(image).toHaveAccessibleName(/Gasto por categoría\. Máximo 320,00\s€ en Supermercado; mínimo 80,00\s€ en Ocio/);
  });

  it('offers an equivalent table behind an aria-expanded toggle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BarChart title="Gasto por categoría" data={SPENDING} />);
    const toggle = screen.getByRole('button', { name: 'Ver como tabla' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Ocultar tabla');
    expect(toggle).toHaveFocus();
    const table = screen.getByRole('table', { name: 'Gasto por categoría' });
    expect(within(table).getByRole('rowheader', { name: 'Supermercado' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('says there is no data instead of drawing an empty chart', () => {
    renderWithProviders(<BarChart title="Gasto" data={[]} />);

    expect(screen.getByText('Sin datos para este periodo')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('LineChart', () => {
  const props = {
    title: 'Ingresos y gastos',
    labels: ['ene 2026', 'feb 2026', 'mar 2026'],
    series: [
      { key: 'income', label: 'Ingresos', values: [200_000, 210_000, 205_000], color: 'var(--color-chart-income)' },
      { key: 'expense', label: 'Gastos', values: [150_000, 185_000, 92_000], color: 'var(--color-chart-expense)', isDashed: true },
    ],
  };

  it('is an SVG image named by <title> and described by <desc>', () => {
    renderWithProviders(<LineChart {...props} />);

    const svg = screen.getByRole('img', { name: /Ingresos y gastos/ });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg).toHaveAccessibleName(expect.stringMatching(/Gastos\. Máximo 1850,00\s€ en feb 2026; mínimo 920,00\s€ en mar 2026/));
  });

  it('has a text legend and a table with one column per series', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LineChart {...props} />);

    expect(screen.getByRole('list')).toHaveTextContent('IngresosGastos');
    await user.click(screen.getByRole('button', { name: 'Ver como tabla' }));

    const table = screen.getByRole('table', { name: 'Ingresos y gastos' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Periodo',
      'Ingresos',
      'Gastos',
    ]);
    expect(within(table).getAllByRole('row')).toHaveLength(4);
  });

  it('renders the empty state without series', () => {
    renderWithProviders(<LineChart title="Saldo" labels={[]} series={[]} />);

    expect(screen.getByText('Sin datos para este periodo')).toBeInTheDocument();
  });
});
