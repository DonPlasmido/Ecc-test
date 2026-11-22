import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContainer } from '@/composition/container.types';
import { createTestContainer } from '@/composition/createTestContainer';
import { ImportPage } from '@/ui/features/import/ImportPage';
import { renderWithProviders, setupI18n } from '../../renderWithProviders';

/** Todos los extractos de ejemplo contienen los mismos 50 movimientos (public/samples/README.md). */
const SAMPLE_TRANSACTIONS = 50;
const FILE_LABEL = 'Archivo del extracto (CSV o XLSX)';

function sampleFile(name: string): File {
  const bytes = readFileSync(resolve(process.cwd(), 'public/samples', name));
  return new File([bytes], name);
}

function figure(term: string): string | null {
  const summary = screen.getByRole('region', { name: 'Importación completada' });
  return within(summary).getByText(term).nextElementSibling?.textContent ?? null;
}

async function importSample(user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> {
  await user.upload(screen.getByLabelText(FILE_LABEL), sampleFile(name));
  await screen.findByRole('table', { name: /vista previa/i }, { timeout: 5000 });
  await user.click(screen.getByRole('button', { name: 'Importar' }));
  await screen.findByRole('heading', { name: 'Importación completada' }, { timeout: 5000 });
}

let container: AppContainer;

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  await setupI18n('es');
  container = await createTestContainer();
});

describe('ImportPage with the real use case and sample statements', () => {
  it('imports the CaixaBank CSV (Windows-1252, Debe/Haber) and skips every row on re-import', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportPage />, { container, route: '/importar' });

    await user.upload(screen.getByLabelText(FILE_LABEL), sampleFile('caixabank.csv'));

    const preview = await screen.findByRole('table', { name: /vista previa/i });
    expect(screen.getByRole('combobox', { name: 'Cómo vienen los importes' })).toHaveValue('debitCredit');
    expect(screen.getByRole('combobox', { name: 'Columna 5 (Debe): usar como' })).toHaveValue('debit');
    expect(within(preview).getAllByRole('row')[1]).toHaveTextContent('TRANSFERENCIA ALQUILER PISO');
    expect(within(preview).getAllByRole('row')[1]).toHaveTextContent('-750,00');

    await user.click(screen.getByRole('button', { name: 'Importar' }));
    await screen.findByRole('heading', { name: 'Importación completada' });
    expect(figure('Movimientos importados')).toBe(String(SAMPLE_TRANSACTIONS));
    expect(figure('Duplicados omitidos')).toBe('0');
    await container.whenIndexIdle();
    expect(container.indexStore.getSnapshot().size).toBe(SAMPLE_TRANSACTIONS);

    await user.click(screen.getByRole('button', { name: 'Importar otro extracto' }));
    await importSample(user, 'caixabank.csv');
    expect(figure('Movimientos importados')).toBe('0');
    expect(figure('Duplicados omitidos')).toBe(String(SAMPLE_TRANSACTIONS));
    expect(screen.getByText(/todo el extracto ya estaba importado/)).toBeInTheDocument();
  });

  it('imports the BBVA XLSX into the account created on the first import', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportPage />, { container, route: '/importar' });

    await importSample(user, 'bbva.xlsx');

    expect(figure('Movimientos importados')).toBe(String(SAMPLE_TRANSACTIONS));
    const accounts = await container.manageCatalog.listAccounts();
    expect(accounts.map((account) => account.name)).toEqual(['Principal']);
  });

  it('previews the real BBVA sample when opened from the dashboard link (?ejemplo=1)', async () => {
    const bytes = readFileSync(resolve(process.cwd(), 'public/samples/bbva.csv'));
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(bytes, { status: 200 }))));
    renderWithProviders(<ImportPage />, { container, route: '/importar?ejemplo=1' });

    const preview = await screen.findByRole('table', { name: /vista previa/i }, { timeout: 5000 });
    expect(screen.getByText('Archivo: bbva.csv')).toBeInTheDocument();
    expect(within(preview).getAllByRole('row')[1]).toHaveTextContent('TRANSFERENCIA A CUENTA AHORRO');
  });

  it('rejects an unsupported file with a translated message', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<ImportPage />, { container, route: '/importar' });

    await user.upload(screen.getByLabelText(FILE_LABEL), new File(['x'], 'extracto.xls'));

    expect(await screen.findByText(/Formato no admitido/)).toHaveAttribute('role', 'alert');
  });
});
