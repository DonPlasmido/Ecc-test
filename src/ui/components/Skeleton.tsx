import { useTranslation } from 'react-i18next';

type SkeletonProps = {
  variant?: 'text' | 'figure' | 'row';
  /** Número de bloques con la geometría final. */
  count?: number;
  /** Si es `true`, incluye un texto oculto «Cargando» para lectores de pantalla. */
  hasLabel?: boolean;
};

/** Marcador de carga con la misma geometría que el contenido final (sin saltos de diseño). */
export function Skeleton({ variant = 'text', count = 1, hasLabel = false }: SkeletonProps) {
  const { t } = useTranslation();
  const blocks = Array.from({ length: count }, (_, index) => index);
  return (
    <>
      {hasLabel ? <span className="visually-hidden">{t('status.loading')}</span> : null}
      {blocks.map((index) => (
        <span key={index} className={`skeleton skeleton--${variant}`} aria-hidden="true" />
      ))}
    </>
  );
}
