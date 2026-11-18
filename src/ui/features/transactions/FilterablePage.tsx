import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

type FilterablePageProps = {
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
};

/** Clave de la primera ubicación del router: en la carga inicial no se mueve el foco. */
const INITIAL_LOCATION_KEY = 'default';

/**
 * Copia local de `layout/Page` para pantallas con filtros en la query del hash. `Page` mueve el foco al `<h1>`
 * en cada cambio de `location.key`, y cada filtro aplicado (`setSearchParams`) genera una clave nueva: el foco
 * saltaría al título al escribir en la búsqueda (a11y §2.5, 3.2.2). Aquí solo se mueve al entrar en la ruta.
 */
export function FilterablePage({ title, intro, children }: FilterablePageProps) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const isNavigation = location.key !== INITIAL_LOCATION_KEY;
  const isNavigationRef = useRef(isNavigation);

  useEffect(() => {
    document.title = t('app.documentTitle', { page: title });
  }, [t, title]);

  useEffect(() => {
    if (isNavigationRef.current) headingRef.current?.focus();
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
