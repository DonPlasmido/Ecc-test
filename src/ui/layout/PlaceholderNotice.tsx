import { useTranslation } from 'react-i18next';

/** Aviso temporal mientras la pantalla no tiene contenido. TODO(features): quitar al rellenarla. */
export function PlaceholderNotice() {
  const { t } = useTranslation();
  return <p className="text-muted">{t('pages.placeholder')}</p>;
}
