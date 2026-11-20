import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContainer } from '@/composition/container.types';
import { createTestContainer } from '@/composition/createTestContainer';
import type { AccountId } from '@/domain/account/Account';
import { SettingsPage } from '@/ui/features/settings/SettingsPage';
import { renderWithProviders, setupI18n } from '../../renderWithProviders';

const PASSWORD = 'caballo-bateria-grapa-correcta';
const SAMPLE_TRANSACTIONS = 50;
const FILE_LABEL = 'Archivo de copia (.ccbackup)';

type User = ReturnType<typeof userEvent.setup>;

let container: AppContainer;
let downloads: { name: string; blob: Blob }[];

async function seedSample(c: AppContainer): Promise<void> {
  const account = await c.manageCatalog.saveAccount({ name: 'Cuenta principal', ibanLast4: null });
  if (!account.ok) throw new Error('account');
  const buf = readFileSync(resolve(process.cwd(), 'public/samples', 'bbva.csv'));
  const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const preview = await c.importStatement.preview({ name: 'bbva.csv', bytes });
  if (!preview.ok) throw new Error('preview');
  const committed = await c.importStatement.commit({
    previewId: preview.value.previewId,
    accountId: account.value.id as AccountId,
    mapping: preview.value.suggestedMapping,
  });
  if (!committed.ok) throw new Error('commit');
  await c.whenIndexIdle();
}

async function transactionCount(c: AppContainer): Promise<number> {
  await c.whenIndexIdle();
  return (await c.queryTransactions.search({ filter: {}, sort: 'dateAsc' })).total;
}

function stubDownloads(): void {
  downloads = [];
  let lastBlob: Blob | null = null;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    lastBlob = blob as Blob;
    return 'blob:backup';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (lastBlob) downloads.push({ name: this.download, blob: lastBlob });
  });
}

async function exportBackup(user: User, password = PASSWORD): Promise<File> {
  await user.click(screen.getByRole('button', { name: 'Exportar copia cifrada' }));
  const dialog = await screen.findByRole('dialog', { name: 'Exportar copia cifrada' });
  await user.type(within(dialog).getByLabelText('Contraseña'), password);
  await user.type(within(dialog).getByLabelText('Repetir contraseña'), password);
  await user.click(within(dialog).getByRole('button', { name: 'Cifrar y descargar' }));
  await waitFor(() => expect(downloads).toHaveLength(1), { timeout: 5000 });
  const [download] = downloads;
  if (!download) throw new Error('no download');
  return new File([await download.blob.arrayBuffer()], download.name);
}

async function startRestore(user: User, file: File): Promise<HTMLElement> {
  await user.upload(screen.getByLabelText(FILE_LABEL), file);
  const confirm = await screen.findByRole('dialog', { name: '¿Reemplazar todos tus datos?' });
  await user.click(within(confirm).getByRole('button', { name: 'Sí, reemplazar mis datos' }));
  return screen.findByRole('dialog', { name: 'Restaurar copia' });
}

beforeEach(async () => {
  await setupI18n('es');
  container = await createTestContainer();
  stubDownloads();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Alerta con texto dentro de `scope` (ignora la región viva global, que también vive en el diálogo abierto). */
async function alertIn(scope: HTMLElement): Promise<HTMLElement> {
  return waitFor(() => {
    const found = within(scope).getAllByRole('alert').find((element) => element.textContent);
    if (!found) throw new Error('no alert with text');
    return found;
  });
}

describe('SettingsPage: encrypted backup', () => {
  it('exports a real backup, deletes everything and restores it with the password', async () => {
    // Arrange
    await seedSample(container);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });
    expect(await screen.findByText(/Todavía no has hecho ninguna copia/)).toBeInTheDocument();

    // Act: exportar
    const file = await exportBackup(user);

    // Assert: archivo y última copia (reloj fijo de los tests: 15/03/2026)
    expect(file.name).toBe('cuentas-claras-2026-03-15.ccbackup');
    expect(new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()))).not.toContain('TRANSFERENCIA');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText(/Copia guardada: cuentas-claras-2026-03-15\.ccbackup/)).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:backup');

    // Act: borrar todo
    await user.click(screen.getByRole('button', { name: 'Borrar todos los datos…' }));
    const deleteDialog = await screen.findByRole('dialog', { name: '¿Borrar todos los datos?' });
    await user.type(within(deleteDialog).getByRole('textbox', { name: /Escribe BORRAR/ }), 'borrar');
    await user.click(within(deleteDialog).getByRole('button', { name: 'Borrar todo' }));
    await screen.findByText('Se han borrado todos los datos de este dispositivo.');
    await container.whenIndexIdle();
    expect(await transactionCount(container)).toBe(0);

    // Act: restaurar
    const restore = await startRestore(user, file);
    await user.type(within(restore).getByLabelText('Contraseña'), PASSWORD);
    await user.click(within(restore).getByRole('button', { name: 'Restaurar copia' }));

    // Assert
    expect(await screen.findByText(`Copia restaurada: ${SAMPLE_TRANSACTIONS} movimientos (copia del 15 mar 2026).`)).toBeInTheDocument();
    expect(await transactionCount(container)).toBe(SAMPLE_TRANSACTIONS);
  });

  it('rejects a wrong password with a clear message and keeps the current data', async () => {
    // Arrange
    await seedSample(container);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });
    const file = await exportBackup(user);

    // Act
    const restore = await startRestore(user, file);
    const password = within(restore).getByLabelText('Contraseña');
    await user.type(password, 'otra-contraseña-distinta');
    await user.click(within(restore).getByRole('button', { name: 'Restaurar copia' }));

    // Assert
    const alert = await alertIn(restore);
    expect(alert).toHaveTextContent('La contraseña no es correcta o el archivo está dañado.');
    expect(password).toBeInvalid();
    expect(password).toHaveAccessibleDescription(expect.stringContaining('La contraseña no es correcta'));
    expect(await transactionCount(container)).toBe(SAMPLE_TRANSACTIONS);
  });

  it('rejects a damaged file and leaves the data untouched', async () => {
    // Arrange
    await seedSample(container);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });
    const file = await exportBackup(user);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const last = bytes.length - 1;
    bytes[last] = (bytes[last] ?? 0) ^ 0xff;
    const damaged = new File([bytes], 'dañada.ccbackup');

    // Act
    const restore = await startRestore(user, damaged);
    await user.type(within(restore).getByLabelText('Contraseña'), PASSWORD);
    await user.click(within(restore).getByRole('button', { name: 'Restaurar copia' }));

    // Assert
    expect(await alertIn(restore)).toHaveTextContent('La contraseña no es correcta o el archivo está dañado.');
    expect(await transactionCount(container)).toBe(SAMPLE_TRANSACTIONS);
  });

  it('rejects a file that is not a backup at all', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });

    // Act
    const restore = await startRestore(user, new File(['fecha;concepto;importe'], 'extracto.ccbackup'));
    await user.type(within(restore).getByLabelText('Contraseña'), PASSWORD);
    await user.click(within(restore).getByRole('button', { name: 'Restaurar copia' }));

    // Assert
    expect(await alertIn(restore)).toHaveTextContent('El archivo no es una copia de Cuentas Claras.');
  });

  it('asks for confirmation before replacing data and cancelling does nothing', async () => {
    // Arrange
    const user = userEvent.setup();
    const importSpy = vi.spyOn(container.importEncryptedBackup, 'execute');
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });

    // Act
    await user.upload(screen.getByLabelText(FILE_LABEL), new File(['x'], 'copia.ccbackup'));
    const confirm = await screen.findByRole('dialog', { name: '¿Reemplazar todos tus datos?' });

    // Assert
    expect(confirm).toHaveAccessibleDescription(expect.stringContaining('«copia.ccbackup» borrará todos los movimientos'));
    // El foco inicial en «Cancelar» se comprueba en E2E: jsdom/user-event reenfoca el input tras `upload`.
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(importSpy).not.toHaveBeenCalled();
  });
});

describe('SettingsPage: export password dialog', () => {
  it('shows the requirements, the no-recovery warning and a strength meter', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });

    // Act
    await user.click(screen.getByRole('button', { name: 'Exportar copia cifrada' }));
    const dialog = await screen.findByRole('dialog', { name: 'Exportar copia cifrada' });
    const password = within(dialog).getByLabelText('Contraseña');

    // Assert
    expect(password).toHaveFocus();
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(password).toHaveAccessibleDescription(expect.stringContaining('Al menos 12 caracteres'));
    expect(within(dialog).getByText(/Si olvidas la contraseña no hay forma de recuperar los datos/)).toBeInTheDocument();
    expect(password).toHaveAccessibleDescription(expect.stringContaining('Fortaleza: demasiado corta'));
    await user.type(password, 'corta');
    expect(within(dialog).getByText('Fortaleza: demasiado corta')).toBeInTheDocument();
    await user.type(password, '-pero-ahora-larga');
    expect(within(dialog).getByText('Fortaleza: fuerte')).toBeInTheDocument();
  });

  it('allows pasting and toggles the visibility without losing the value', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });
    await user.click(screen.getByRole('button', { name: 'Exportar copia cifrada' }));
    const dialog = await screen.findByRole('dialog', { name: 'Exportar copia cifrada' });
    const password = within(dialog).getByLabelText('Contraseña');

    // Act
    await user.click(password);
    await user.paste(PASSWORD);
    await user.click(within(dialog).getByRole('checkbox', { name: 'Mostrar contraseña' }));

    // Assert
    expect(password).toHaveValue(PASSWORD);
    expect(password).toHaveAttribute('type', 'text');
    expect(within(dialog).getByLabelText('Repetir contraseña')).toHaveAttribute('type', 'text');
  });

  it('rejects a short password and a mismatching confirmation without exporting', async () => {
    // Arrange
    const user = userEvent.setup();
    const exportSpy = vi.spyOn(container.exportEncryptedBackup, 'execute');
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });
    await user.click(screen.getByRole('button', { name: 'Exportar copia cifrada' }));
    const dialog = await screen.findByRole('dialog', { name: 'Exportar copia cifrada' });
    const password = within(dialog).getByLabelText('Contraseña');
    const confirmation = within(dialog).getByLabelText('Repetir contraseña');
    const submit = within(dialog).getByRole('button', { name: 'Cifrar y descargar' });

    // Act + Assert: 7 caracteres
    await user.type(password, '1234567');
    await user.click(submit);
    expect(await alertIn(dialog)).toHaveTextContent('La contraseña debe tener al menos 12 caracteres. Añade 5 más.');
    expect(password).toBeInvalid();
    expect(password).toHaveFocus();

    // Act + Assert: no coinciden
    await user.type(password, '89012');
    await user.type(confirmation, '123456789099');
    await user.click(submit);
    expect(await alertIn(dialog)).toHaveTextContent('Las contraseñas no coinciden.');
    expect(confirmation).toHaveFocus();
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it('clears the password fields when the dialog is closed', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });
    const open = screen.getByRole('button', { name: 'Exportar copia cifrada' });
    await user.click(open);
    const dialog = await screen.findByRole('dialog', { name: 'Exportar copia cifrada' });
    await user.type(within(dialog).getByLabelText('Contraseña'), PASSWORD);

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await user.click(open);

    // Assert
    const reopened = await screen.findByRole('dialog', { name: 'Exportar copia cifrada' });
    expect(within(reopened).getByLabelText('Contraseña')).toHaveValue('');
    expect(document.body.innerHTML).not.toContain(PASSWORD);
  });

  it('never persists or logs the password', async () => {
    // Arrange
    const log = vi.spyOn(console, 'log');
    const warn = vi.spyOn(console, 'warn');
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });

    // Act
    await exportBackup(user);

    // Assert
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain(PASSWORD);
    expect(JSON.stringify(await container.settings.get())).not.toContain(PASSWORD);
    for (const spy of [log, warn]) expect(JSON.stringify(spy.mock.calls)).not.toContain(PASSWORD);
  });
});

describe('SettingsPage: last backup, storage, privacy and delete', () => {
  it('reminds to back up when the last backup is older than 30 days', async () => {
    // Arrange
    await container.settings.save({ locale: 'es', theme: 'system', lastBackupAt: '2020-01-10T09:00:00.000Z' });

    // Act
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });

    // Assert
    expect(await screen.findByText(/Tu última copia es del viernes, 10 de enero de 2020, hace \d+ días/)).toBeInTheDocument();
    expect(screen.getByText(/más de 30 días: haz una copia nueva/)).toBeInTheDocument();
  });

  it('shows a recent backup date without a reminder', async () => {
    // Arrange
    await container.settings.save({ locale: 'es', theme: 'system', lastBackupAt: new Date().toISOString() });

    // Act
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });

    // Assert
    expect(await screen.findByText(/^Última copia: /)).toBeInTheDocument();
    expect(screen.queryByText(/haz una copia nueva/)).not.toBeInTheDocument();
  });

  it('shows estimated usage and offers to retry when storage is not persistent', async () => {
    // Arrange
    const requestPersistence = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const storage = { requestPersistence, estimate: () => Promise.resolve({ usageBytes: 1_572_864, quotaBytes: 2 * 1024 ** 3 }) };
    const withStorage = await createTestContainer({ storage });
    requestPersistence.mockClear().mockResolvedValueOnce(false).mockResolvedValue(true);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { container: withStorage, route: '/ajustes' });

    // Act
    expect(await screen.findByText(/Uso estimado: 1,5 MB de 2 GB disponibles/)).toBeInTheDocument();
    expect(screen.getByText(/Almacenamiento no persistente/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver a pedir almacenamiento persistente' }));

    // Assert
    expect(await screen.findByText(/^Almacenamiento persistente/)).toBeInTheDocument();
  });

  it('explains that the storage estimate is unavailable', async () => {
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });
    expect(await screen.findByText('Este navegador no permite estimar el espacio usado.')).toBeInTheDocument();
  });

  it('states that everything stays on the device and links to rules and categories', () => {
    // Act
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });

    // Assert
    const privacy = screen.getByRole('region', { name: 'Privacidad' });
    expect(privacy).toHaveTextContent('Todo se guarda solo en este dispositivo');
    expect(screen.getByRole('link', { name: 'Ir a Reglas y categorías' })).toHaveAttribute('href', '/reglas');
    // Idioma y tema se conservan
    expect(screen.getByRole('combobox', { name: /Idioma/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
  });

  it('does not delete anything unless the confirmation word is typed', async () => {
    // Arrange
    await seedSample(container);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { container, route: '/ajustes' });
    await user.click(screen.getByRole('button', { name: 'Borrar todos los datos…' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Borrar todos los datos?' });
    const input = within(dialog).getByRole('textbox', { name: /Escribe BORRAR/ });

    // Act
    expect(input).toHaveFocus();
    await user.type(input, 'borra');
    await user.click(within(dialog).getByRole('button', { name: 'Borrar todo' }));

    // Assert
    expect(await alertIn(dialog)).toHaveTextContent('Escribe BORRAR exactamente para confirmar.');
    expect(await transactionCount(container)).toBe(SAMPLE_TRANSACTIONS);
  });
});
