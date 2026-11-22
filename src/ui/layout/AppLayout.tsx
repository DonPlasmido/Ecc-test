import { Suspense, useRef, useState, type MouseEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/ui/components/Skeleton';
import { BottomNav } from './BottomNav';
import { ErrorBoundary } from './ErrorBoundary';
import { IndexStatusBanner } from './IndexStatusBanner';
import { NavigationTrackerContext } from './navigationTracker';
import { UpdateBanner } from './UpdateBanner';

function PageFallback() {
  return (
    <div className="stack" aria-busy="true">
      <Skeleton variant="figure" hasLabel />
      <Skeleton variant="row" count={3} />
    </div>
  );
}

/** Esqueleto móvil: enlace de salto, cabecera, `<main id="main">` y navegación inferior. */
export function AppLayout() {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();

  // Estado derivado durante el render (patrón de React): la página nueva monta en este mismo commit y debe verlo.
  const [lastPathname, setLastPathname] = useState(location.pathname);
  const [hasNavigated, setHasNavigated] = useState(false);
  if (lastPathname !== location.pathname) {
    setLastPathname(location.pathname);
    setHasNavigated(true);
  }

  // Con hash router, `href="#main"` cambiaría la ruta: se enfoca `main` a mano (a11y T4).
  const handleSkip = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    mainRef.current?.focus();
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main" onClick={handleSkip}>
        {t('skipLink')}
      </a>
      <header className="app-header">
        <p className="app-header__title">{t('app.name')}</p>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="container page">
        <IndexStatusBanner />
        <UpdateBanner />
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageFallback />}>
            <NavigationTrackerContext.Provider value={hasNavigated}>
              <Outlet />
            </NavigationTrackerContext.Provider>
          </Suspense>
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}
