import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportPreview, ImportResult, ImportStatement } from '@/application/ports/inbound/ImportStatement';
import type { ManageCatalog } from '@/application/ports/inbound/ManageCatalog';
import type { Account, AccountId } from '@/domain/account/Account';
import type { ColumnMapping } from '@/domain/import/ColumnMapping';
import type { ImportBatchId } from '@/domain/import/ImportBatch';
import type { RawCell, RawTable } from '@/domain/import/RawTable';
import { domainError } from '@/domain/shared/DomainError';
import { err, ok } from '@/domain/shared/Result';
import { ImportPage } from '@/ui/features/import/ImportPage';
import { createFakeContainer } from '../../fakeContainer';
import { renderWithProviders, setupI18n } from '../../renderWithProviders';

const text = (value: string): RawCell => (value === '' ? { kind: 'empty' } : { kind: 'text', value });
const table = (rows: readonly (readonly string[])[]): RawTable => ({ sourceName: 'extracto.csv', rows: rows.map((row) => row.map(text)) });

const MAPPING: ColumnMapping = { headerRowIndex: 0, columns: ['date', 'description', 'amount', 'balance'], amountConvention: 'signed' };
const TABLE = table([
  ['Fecha', 'Concepto', 'Importe', 'Saldo'],
  ['05/01/2026', 'COMPRA MERCADONA 123', '-45,10', '1.954,90'],
  ['31/02/2026', 'FECHA IMPOSIBLE', '-1,00', ''],
  ['06/01/2026', '<img src=x onerror=alert(1)>', '2.000,00', '3.953,90'],
]);

const ACCOUNT: Account = { id: 'acc-1' as AccountId, name: 'Cuenta nómina', ibanLast4: null, currency: 'EUR', createdAt: '2026-01-01T00:00:00.000Z' };

function previewOf(overrides: Partial<ImportPreview> = {}): ImportPreview {
  return { previewId: 'p-1', table: TABLE, suggestedMapping: MAPPING, confidence: 1, rememberedMapping: false, ambiguousDates: false, ...overrides };
}

const RESULT: ImportResult = {
  batchId: 'b-1' as ImportBatchId,
  inserted: 2,
  duplicates: 1,
  autoCategorized: 1,
  rowErrors: [{ line: 3, error: domainError('date.invalidDate', { value: '31/02/2026' }) }],
};

type SetupOptions = {
  preview?: ImportStatement['preview'];
  commit?: ImportStatement['commit'];
  accounts?: readonly Account[];
  route?: string;
};

/** Muestra la query actual del router para comprobar que `?ejemplo=1` se consume. */
function LocationProbe() {
  const location = useLocation();
  return <output aria-label="query">{location.search}</output>;
}

function setup(options: SetupOptions = {}) {
  const importStatement = {
    preview: vi.fn(options.preview ?? (() => Promise.resolve(ok(previewOf())))),
    commit: vi.fn(options.commit ?? (() => Promise.resolve(ok(RESULT)))),
  };
  const manageCatalog = {
    listAccounts: vi.fn(() => Promise.resolve(options.accounts ?? [ACCOUNT])),
    saveAccount: vi.fn(() => Promise.resolve(ok({ ...ACCOUNT, id: 'acc-new' as AccountId, name: 'Nueva' }))),
  } as unknown as ManageCatalog & { listAccounts: ReturnType<typeof vi.fn>; saveAccount: ReturnType<typeof vi.fn> };
  const container = createFakeContainer({ importStatement, manageCatalog });
  const user = userEvent.setup();
  renderWithProviders(
    <>
      <ImportPage />
      <LocationProbe />
    </>,
    { container, route: options.route ?? '/importar' },
  );
  return { user, importStatement, manageCatalog };
}

const csvFile = () => new File(['Fecha;Concepto;Importe\n'], 'extracto.csv', { type: 'text/csv' });

async function chooseFile(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText('Archivo del extracto (CSV o XLSX)'), csvFile());
  return screen.findByRole('table', { name: /vista previa de las primeras/i });
}

/** Alerta propia de la pantalla (la app tiene además una región global `role="alert"`). */
async function findAlert(message: RegExp): Promise<HTMLElement> {
  const alerts = await screen.findAllByRole('alert');
  const match = await waitFor(() => {
    const found = screen.getAllByRole('alert').find((alert) => message.test(alert.textContent ?? ''));
    if (!found) throw new Error(`No alert matches ${String(message)} among ${alerts.length}`);
    return found;
  });
  return match;
}

beforeEach(async () => {
  await setupI18n('es');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ImportPage: file selection', () => {
  it('renders an accessible file input with its formats hint', () => {
    setup();

    const input = screen.getByLabelText('Archivo del extracto (CSV o XLSX)');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('CSV y Excel (.xlsx), hasta 20 MB'));
    expect(screen.getByRole('heading', { level: 1, name: 'Importar extracto' })).toBeInTheDocument();
  });

  it('shows a translated domain error linked to the input when the preview fails', async () => {
    const { user } = setup({ preview: () => Promise.resolve(err(domainError('import.unsupportedFormat'))) });

    await user.upload(screen.getByLabelText('Archivo del extracto (CSV o XLSX)'), csvFile());

    expect(await findAlert(/Formato no admitido/)).toBeInTheDocument();
    const input = screen.getByLabelText('Archivo del extracto (CSV o XLSX)');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Formato no admitido'));
  });

  it('shows a generic message when the preview throws unexpectedly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user } = setup({ preview: () => Promise.reject(new Error('boom')) });

    await user.upload(screen.getByLabelText('Archivo del extracto (CSV o XLSX)'), csvFile());

    expect(await findAlert(/No se ha podido leer el archivo/)).toBeInTheDocument();
  });

  it('loads the sample statement from the app origin', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('Fecha;Concepto;Importe\n', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const { user, importStatement } = setup();

    await user.click(screen.getByRole('button', { name: 'Probar con un extracto de ejemplo' }));

    await screen.findByRole('table', { name: /vista previa/i });
    expect(fetchMock).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}samples/bbva.csv`);
    expect(importStatement.preview).toHaveBeenCalledWith(expect.objectContaining({ name: 'bbva.csv' }));
  });

  it('loads the sample automatically from the dashboard link (?ejemplo=1) only once', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('Fecha;Concepto;Importe\n', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const { importStatement } = setup({ route: '/importar?ejemplo=1' });

    expect(await screen.findByRole('table', { name: /vista previa/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}samples/bbva.csv`);
    expect(importStatement.preview).toHaveBeenCalledTimes(1);
    expect(importStatement.preview).toHaveBeenCalledWith(expect.objectContaining({ name: 'bbva.csv' }));
    expect(screen.getByRole('status', { name: 'query' })).toHaveTextContent(/^$/);
  });

  it('does not load the sample without the query parameter', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setup({ route: '/importar?ejemplo=0' });

    await screen.findByLabelText('Archivo del extracto (CSV o XLSX)');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('explains when the sample cannot be downloaded', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('', { status: 404 }))));
    const { user, importStatement } = setup();

    await user.click(screen.getByRole('button', { name: 'Probar con un extracto de ejemplo' }));

    expect(await findAlert(/No se ha podido cargar el extracto de ejemplo/)).toBeInTheDocument();
    expect(importStatement.preview).not.toHaveBeenCalled();
  });
});

describe('ImportPage: preview', () => {
  it('shows normalised rows, rejected rows with their line and untrusted text as literal text', async () => {
    const { user } = setup();

    const preview = await chooseFile(user);

    const rows = within(preview).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('COMPRA MERCADONA 123');
    expect(rows[1]).toHaveTextContent('-45,10');
    expect(rows[2]).toHaveTextContent('3');
    expect(rows[2]).toHaveTextContent(/No se importará: La fecha «.+» no existe\./);
    expect(rows[3]).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(preview.querySelector('img')).toBeNull();
    expect(screen.getByRole('region', { name: /vista previa de las primeras/i })).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('En las primeras filas leídas: 2 válidas y 1 con errores.')).toBeInTheDocument();
  });

  it('labels every column select uniquely and offers an explicit "do not use" option', async () => {
    const { user } = setup();
    await chooseFile(user);

    const select = screen.getByRole('combobox', { name: 'Columna 3 (Importe): usar como' });
    expect(select).toHaveValue('amount');
    expect(within(select).getByRole('option', { name: 'No usar esta columna' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Columna 1 (Fecha): usar como' })).toHaveAccessibleDescription('Ejemplo: 05/01/2026');
  });

  it('disables Import and names the missing column when the amount column is unassigned (AC-007)', async () => {
    const { user, importStatement } = setup();
    await chooseFile(user);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Columna 3 (Importe): usar como' }), 'ignore');

    expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled();
    expect(screen.getByText(/Indica qué columna contiene el importe/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(importStatement.commit).not.toHaveBeenCalled();
  });

  it('updates the preview when a column is reassigned without committing anything (AC-006)', async () => {
    const { user, importStatement } = setup();
    await chooseFile(user);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Columna 4 (Saldo): usar como' }), 'amount');

    expect(screen.getByRole('combobox', { name: 'Columna 3 (Importe): usar como' })).toHaveValue('ignore');
    const preview = screen.getByRole('table', { name: /vista previa/i });
    expect(within(preview).getAllByRole('row')[1]).toHaveTextContent('1954,90');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(importStatement.commit).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText('Archivo del extracto (CSV o XLSX)')).toHaveFocus());
  });

  it('requires confirming dd/mm when every date is ambiguous', async () => {
    const { user } = setup({ preview: () => Promise.resolve(ok(previewOf({ ambiguousDates: true }))) });
    await chooseFile(user);
    const confirm = screen.getByRole('button', { name: 'Importar' });
    expect(confirm).toBeDisabled();
    expect(screen.getByText('Confirma el formato de las fechas.')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /fechas están en formato día\/mes/ }));

    expect(confirm).toBeEnabled();
  });

  it('flags low-confidence detection and remembered mappings', async () => {
    const { user } = setup({ preview: () => Promise.resolve(ok(previewOf({ confidence: 0.4 }))) });
    await chooseFile(user);

    expect(screen.getByText(/La detección no es segura/)).toBeInTheDocument();
    expect(screen.getByText(/confianza 40/)).toBeInTheDocument();
  });

  it('lists ambiguous amount warnings', async () => {
    const ambiguous = table([
      ['Fecha', 'Concepto', 'Importe', 'Saldo'],
      ['05/01/2026', 'CAFE', '12.345', ''],
    ]);
    const { user } = setup({ preview: () => Promise.resolve(ok(previewOf({ table: ambiguous }))) });
    await chooseFile(user);

    expect(screen.getByText(/Línea 2: el importe «12.345» es ambiguo/)).toBeInTheDocument();
    expect(screen.getByText('Revisar importe')).toBeInTheDocument();
  });
});

describe('ImportPage: confirm', () => {
  it('commits with the edited mapping and shows the summary with focus on its heading', async () => {
    const { user, importStatement } = setup();
    await chooseFile(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Columna 4 (Saldo): usar como' }), 'ignore');

    await user.click(screen.getByRole('button', { name: 'Importar' }));

    const heading = await screen.findByRole('heading', { name: 'Importación completada' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(importStatement.commit).toHaveBeenCalledWith({
      previewId: 'p-1',
      accountId: 'acc-1',
      mapping: { ...MAPPING, columns: ['date', 'description', 'amount', 'ignore'] },
    });
    const summary = screen.getByRole('region', { name: 'Importación completada' });
    expect(within(summary).getByText('Movimientos importados').nextElementSibling).toHaveTextContent('2');
    expect(within(summary).getByText('Duplicados omitidos').nextElementSibling).toHaveTextContent('1');
    expect(within(summary).getByText('Categorizados por reglas').nextElementSibling).toHaveTextContent('1');
    expect(within(summary).getByText('Línea 3: La fecha «31/02/2026» no existe.')).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: 'Ver movimientos' })).toHaveAttribute('href', '/movimientos');
    expect(await screen.findByText(/Importados 2 movimientos, 1 duplicados omitidos y 1 categorizados/)).toBeInTheDocument();
  });

  it('creates the destination account when there is none yet', async () => {
    const { user, importStatement, manageCatalog } = setup({ accounts: [] });
    await chooseFile(user);
    const name = screen.getByRole('textbox', { name: /Nombre de la nueva cuenta/ });
    expect(name).toHaveValue('Cuenta principal');
    await user.clear(name);
    expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled();
    await user.type(name, 'Ahorro');

    await user.click(screen.getByRole('button', { name: 'Importar' }));

    await screen.findByRole('heading', { name: 'Importación completada' });
    expect(manageCatalog.saveAccount).toHaveBeenCalledWith({ name: 'Ahorro', ibanLast4: null });
    expect(importStatement.commit).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'acc-new' }));
  });

  it('keeps the preview and shows the domain error when the commit fails', async () => {
    const { user } = setup({ commit: () => Promise.resolve(err(domainError('storage.quotaExceeded'))) });
    await chooseFile(user);

    await user.click(screen.getByRole('button', { name: 'Importar' }));

    expect(await findAlert(/No queda espacio en el dispositivo/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /vista previa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar' })).toBeEnabled();
  });

  it('starts over from the summary', async () => {
    const { user } = setup();
    await chooseFile(user);
    await user.click(screen.getByRole('button', { name: 'Importar' }));
    await screen.findByRole('heading', { name: 'Importación completada' });

    await user.click(screen.getByRole('button', { name: 'Importar otro extracto' }));

    await waitFor(() => expect(screen.getByLabelText('Archivo del extracto (CSV o XLSX)')).toHaveFocus());
  });
});
