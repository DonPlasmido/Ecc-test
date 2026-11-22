import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { NavigationTrackerContext } from './navigationTracker';

type PageProps = {
  /** Título ya traducido: `<h1>` único y `document.title` (a11y T3, T5). */
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
};

/** Clave de la primera ubicación del router: en la carga inicial no se mueve el foco. */
const INITIAL_LOCATION_KEY = 'default';

/**
 * Estructura común de pantalla. Al cambiar de pantalla (pathname), el foco va al `<h1>` (a11y T6)
 * para que el lector anuncie la pantalla nueva. Los cambios de query (filtros en la URL) NO mueven
 * el foco: si no, escribir en un buscador lo perdería a cada tecla (WCAG 3.2.2).
 */
export function Page({ title, intro, children }: PageProps) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const location = useLocation();

  useEffect(() => {
    document.title = t('app.documentTitle', { page: title });
  }, [t, title]);

  // Montaje: si se llega por navegación (no es la ubicación inicial del router), foco al h1.
  // Atrás hacia la primera entrada del historial vuelve a tener la clave inicial: lo delata el seguimiento del layout.
  const tracker = useContext(NavigationTrackerContext);
  const mountedByNavigation = useRef(location.key !== INITIAL_LOCATION_KEY || tracker);
  const previousPathname = useRef<string | null>(null);
  useEffect(() => {
    const isFirstRun = previousPathname.current === null;
    const pathnameChanged = !isFirstRun && previousPathname.current !== location.pathname;
    previousPathname.current = location.pathname;
    if ((isFirstRun && mountedByNavigation.current) || pathnameChanged) headingRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="stack stack--loose">
      <div className="page__header">
        <h1 className="page__title" ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
        {intro ? <p className="page__intro">{intro}</p> : null}
      </div>
      {children}
    </div>
  );
}
