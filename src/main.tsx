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

type CreateContainerModule = { createContainer: () => Promise<AppContainer> };

/**
 * Carga perezosa de la composición real (`src/composition/createContainer.ts`, otro módulo).
 * `import.meta.glob` no falla si el archivo aún no existe: entonces se usa el contenedor
 * provisional, cuyos casos de uso rechazan con "not wired".
 * TODO(composition): cuando exista createContainer, sustituir por
 *   `const { createContainer } = await import('@/composition/createContainer')`
 * y borrar src/ui/dev/stubContainer.ts.
 */
const compositionModules = import.meta.glob<CreateContainerModule>('/src/composition/createContainer.ts');

async function loadContainer(): Promise<AppContainer> {
  const loadComposition = compositionModules['/src/composition/createContainer.ts'];
  if (loadComposition) {
    const { createContainer } = await loadComposition();
    return createContainer();
  }
  const { createStubContainer } = await import('@/ui/dev/stubContainer');
  return createStubContainer();
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

registerSW({ immediate: true });
void bootstrap();
