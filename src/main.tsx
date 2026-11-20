import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { registerSW } from 'virtual:pwa-register';
import type { AppContainer } from '@/composition/container.types';
import type { DomainError } from '@/domain/shared/DomainError';
import { App } from '@/ui/App';
import { initI18n } from '@/ui/i18n/i18n';
import { BootError } from '@/ui/layout/BootError';
import { applyTheme, readThemePreference } from '@/ui/theme/theme';
import '@/ui/styles/tokens.css';
import '@/ui/styles/base.css';
import '@/ui/styles/components.css';
import '@/ui/styles/app.css';

/** Composición real: se carga en diferido para que el primer render (tema/idioma) no espere a IndexedDB. */
async function loadContainer(): Promise<AppContainer> {
  const { createContainer } = await import('@/composition/createContainer');
  return createContainer();
}

function isDomainError(value: unknown): value is DomainError {
  return typeof value === 'object' && value !== null && typeof (value as { code?: unknown }).code === 'string';
}

async function bootstrap(): Promise<void> {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('#root not found in index.html');
  const root = createRoot(rootElement);

  // Tema e idioma antes del primer render: sin parpadeo ni `lang` incorrecto (a11y §16).
  applyTheme(readThemePreference());
  const i18n = await initI18n();

  try {
    const container = await loadContainer();
    root.render(
      <StrictMode>
        <App container={container} i18n={i18n} />
      </StrictMode>,
    );
  } catch (error: unknown) {
    console.error('Container bootstrap failed', error);
    root.render(
      <StrictMode>
        <I18nextProvider i18n={i18n}>
          <BootError error={isDomainError(error) ? error : null} />
        </I18nextProvider>
      </StrictMode>,
    );
  }
}

registerSW({
  immediate: true,
  // Sin esto, un fallo de registro o actualización del service worker sería invisible (silent-failures 7).
  onRegisterError: (error: unknown) => console.error('Service worker registration failed', error),
});
void bootstrap();
