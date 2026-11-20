import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AppContainer } from '@/composition/container.types';
import { normalizeText } from '@/domain/shared/normalizeText';
import { generateTransactions } from '../../../fixtures/generateTransactions';
import { setupI18n } from '../../renderWithProviders';
import { account, installFakeGridLayout, renderTransactionsPage, seededContainer } from './helpers';

installFakeGridLayout();

const COUNT = 100_000;
/** Ventana visible (600 px / 56 px ≈ 11 filas) + overscan 8 por lado: muy por debajo de 100 (AC-031). */
const MAX_RENDERED_ROWS = 40;
const SLOW = { timeout: 10_000 };

const transactions = generateTransactions({ count: COUNT, seed: 7 });
const needle = normalizeText('mercadona');
const expectedMatches = transactions.filter((t) => t.normalizedDescription.includes(needle)).length;
let container: AppContainer;

beforeAll(async () => {
  await setupI18n('es');
  container = await seededContainer(transactions, [account('acc-0', 'A'), account('acc-1', 'B'), account('acc-2', 'C')]);
}, 60_000);

function renderedRows(): HTMLElement[] {
  return within(screen.getByRole('grid')).getAllByRole('row');
}

describe('TransactionsPage with 100.000 transactions', () => {
  it('renders only a window of rows and filters by text without rendering every row', async () => {
    const user = userEvent.setup();
    renderTransactionsPage(container);
    const grid = await screen.findByRole('grid', {}, SLOW);
    expect(grid).toHaveAttribute('aria-rowcount', String(COUNT + 1));
    await waitFor(() => expect(renderedRows().some((row) => row.getAttribute('aria-rowindex') === '2' && !row.hasAttribute('aria-busy'))).toBe(true), SLOW);
    expect(renderedRows().length).toBeLessThanOrEqual(MAX_RENDERED_ROWS);

    await user.type(screen.getByRole('searchbox'), 'mercadona');
    const started = performance.now();
    await waitFor(() => expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', String(expectedMatches + 1)), SLOW);
    const elapsedMs = performance.now() - started;

    expect(expectedMatches).toBeGreaterThan(0);
    expect(renderedRows().length).toBeLessThanOrEqual(MAX_RENDERED_ROWS);
    await waitFor(() => expect(renderedRows()[1]).toHaveTextContent(/MERCADONA/), SLOW);
    // Incluye el debounce (250 ms) en jsdom; margen amplio para CI. El umbral real (≤ 200 ms) es E2E (AC-033).
    expect(elapsedMs).toBeLessThan(2_000);
  }, 60_000);
});
