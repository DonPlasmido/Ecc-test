import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

type PageProps = {
  /** Título ya traducido: `<h1>` único y `document.title` (a11y T3, T5). */
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
};

/** Clave de la primera ubicación del router: en la carga inicial no se mueve el foco. */
const INITIAL_LOCATION_KEY = 'default';

/**
 * Estructura común de pantalla. Al navegar, el foco va al `<h1>` (a11y T6) para que
 * el lector anuncie la pantalla nueva y no quede en un enlace desmontado.
 */
export function Page({ title, intro, children }: PageProps) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const location = useLocation();

  useEffect(() => {
    document.title = t('app.documentTitle', { page: title });
  }, [t, title]);

  useEffect(() => {
    if (location.key !== INITIAL_LOCATION_KEY) headingRef.current?.focus();
  }, [location.key]);

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
