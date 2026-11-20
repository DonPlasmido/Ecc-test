import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { HashRouter } from 'react-router-dom';
import type { AppContainer } from '@/composition/container.types';
import { AppRoutes } from './AppRoutes';
import { NotificationsProvider } from './components/Toast';
import { ContainerProvider } from './container/ContainerContext';
import { ErrorBoundary } from './layout/ErrorBoundary';
import { ThemeProvider } from './theme/ThemeProvider';

type AppProps = {
  container: AppContainer;
  /** Instancia i18next ya inicializada (`initI18n`). */
  i18n: I18nInstance;
};

/** Raíz: proveedores (i18n, tema, contenedor, avisos) y hash router (ADR-0005). */
export function App({ container, i18n }: AppProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <ErrorBoundary>
          <ContainerProvider container={container}>
            <NotificationsProvider>
              <HashRouter>
                <AppRoutes />
              </HashRouter>
            </NotificationsProvider>
          </ContainerProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </I18nextProvider>
  );
}
