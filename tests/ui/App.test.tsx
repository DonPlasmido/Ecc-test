import { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/ui/App';
import { i18n } from '@/ui/i18n/i18n';
import { ErrorBoundary } from '@/ui/layout/ErrorBoundary';
import { createFakeContainer } from './fakeContainer';
import { renderWithProviders, setupI18n } from './renderWithProviders';

async function renderApp(hash = '#/') {
  window.location.hash = hash;
  render(<App container={createFakeContainer()} i18n={i18n} />);
  return screen.findByRole('heading', { level: 1 });
}

beforeEach(async () => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  await setupI18n('es');
});

afterEach(async () => {
  await setupI18n('es');
});

describe('App shell', () => {
  it('renders landmarks, the skip link and the bottom navigation with aria-current', async () => {
    const heading = await renderApp();

    expect(heading).toHaveTextContent('Panel');
    expect(screen.getByRole('banner')).toHaveTextContent('Cuentas Claras');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Panel', 'Movimientos', 'Importar', 'Presupuestos', 'Ajustes']);
    expect(within(nav).getByRole('link', { name: 'Panel' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Movimientos' })).toHaveAttribute('href', '#/movimientos');
    expect(document.title).toBe('Panel - Cuentas Claras');
    expect(document.documentElement.lang).toBe('es');
  });

  it('skip link is the first tab stop and focuses main without changing the route', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.tab();
    const skip = screen.getByRole('link', { name: 'Saltar al contenido' });
    expect(skip).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#/');
  });

  it('navigating moves focus to the new h1, updates the title and aria-current', async () => {
    const user = userEvent.setup();
    await renderApp();
    const nav = screen.getByRole('navigation', { name: 'Principal' });

    await user.click(within(nav).getByRole('link', { name: 'Movimientos' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Movimientos' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(document.title).toBe('Movimientos - Cuentas Claras');
    expect(within(nav).getByRole('link', { name: 'Movimientos' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Panel' })).not.toHaveAttribute('aria-current');
  });

  it.each([
    ['#/importar', 'Importar extracto'],
    ['#/presupuestos', 'Presupuestos'],
    ['#/reglas', 'Reglas'],
    ['#/ajustes', 'Ajustes'],
    ['#/no-existe', 'Página no encontrada'],
  ])('route %s shows the "%s" screen with a single h1', async (hash, title) => {
    const heading = await renderApp(hash);

    expect(heading).toHaveTextContent(title);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('Settings', () => {
  it('switches to English: html lang, translated UI, persisted choice and announcement', async () => {
    const user = userEvent.setup();
    await renderApp('#/ajustes');
    const select = screen.getByRole('combobox', { name: 'Idioma / Language' });
    expect(within(select).getByRole('option', { name: 'English' })).toHaveAttribute('lang', 'en');

    await user.selectOptions(select, 'en');

    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(window.localStorage.getItem('cc.language')).toBe('en');
    expect(await screen.findByText('Language changed to English')).toBeInTheDocument();
    expect(select).toHaveFocus();
  });

  it('applies and persists the theme through data-theme', async () => {
    const user = userEvent.setup();
    await renderApp('#/ajustes');
    const group = screen.getByRole('group', { name: 'Tema' });
    expect(within(group).getByRole('radio', { name: 'Sistema' })).toBeChecked();

    await user.click(within(group).getByRole('radio', { name: 'Oscuro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('cc.theme')).toBe('dark');

    await user.click(within(group).getByRole('radio', { name: 'Sistema' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('keeps working when localStorage is blocked', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    await renderApp('#/ajustes');

    await user.click(screen.getByRole('radio', { name: 'Claro' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    setItem.mockRestore();
  });
});

describe('ErrorBoundary', () => {
  function Bomb(): never {
    throw new Error('render failure');
  }

  function Harness() {
    const [shouldThrow, setShouldThrow] = useState(true);
    return (
      <ErrorBoundary>
        {shouldThrow ? <Bomb /> : <p>Recuperado</p>}
        <button type="button" onClick={() => setShouldThrow(false)}>
          arreglar
        </button>
      </ErrorBoundary>
    );
  }

  it('shows a translated message and recovers on retry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    expect(screen.getByRole('heading', { name: 'Algo ha fallado' })).toBeInTheDocument();
    expect(screen.queryByText('render failure')).not.toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
