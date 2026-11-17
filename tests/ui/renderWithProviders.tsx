import type { ReactElement, ReactNode } from 'react';
import { cleanup, render, type RenderResult } from '@testing-library/react';
import { afterEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import type { AppContainer } from '@/composition/container.types';
import { NotificationsProvider } from '@/ui/components/Toast';
import { ContainerProvider } from '@/ui/container/ContainerContext';
import { changeLanguage, i18n, initI18n, type Language } from '@/ui/i18n/i18n';
import { ThemeProvider } from '@/ui/theme/ThemeProvider';
import { createFakeContainer } from './fakeContainer';

// Vitest sin `globals`: Testing Library no desmonta solo entre tests.
afterEach(() => {
  cleanup();
});

/** Inicializa i18next en el idioma pedido (por defecto `es`) antes de renderizar. */
export async function setupI18n(language: Language = 'es'): Promise<void> {
  await initI18n(language);
  if (i18n.language !== language) await changeLanguage(language);
}

type Options = {
  container?: AppContainer;
  route?: string;
};

/** Render con todos los proveedores de la app y un router en memoria. */
export function renderWithProviders(ui: ReactElement, { container, route = '/' }: Options = {}): RenderResult {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider initialTheme="system">
        <ContainerProvider container={container ?? createFakeContainer()}>
          <NotificationsProvider>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </NotificationsProvider>
        </ContainerProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
  return render(ui, { wrapper });
}
