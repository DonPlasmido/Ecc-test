import { Suspense, useRef, type MouseEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/ui/components/Skeleton';
import { BottomNav } from './BottomNav';
import { ErrorBoundary } from './ErrorBoundary';
import { IndexStatusBanner } from './IndexStatusBanner';

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
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}
