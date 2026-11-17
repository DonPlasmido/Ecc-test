import { useTranslation } from 'react-i18next';
import { currentLanguage, type Language } from './i18n';

/** Idioma activo; el componente se vuelve a renderizar al cambiarlo. */
export function useLanguage(): Language {
  const { i18n } = useTranslation();
  return currentLanguage(i18n);
}
