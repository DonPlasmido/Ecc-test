import { useTranslation } from 'react-i18next';
import { Select, type SelectOption } from '@/ui/components/Select';
import { useNotifications } from '@/ui/components/Toast';
import { changeLanguage, type Language } from '@/ui/i18n/i18n';
import { useLanguage } from '@/ui/i18n/useLanguage';

/** Cada idioma escrito en su propio idioma, con su `lang` (a11y §16). */
const LANGUAGE_OPTIONS: readonly SelectOption<Language>[] = [
  { value: 'es', label: 'Español', lang: 'es' },
  { value: 'en', label: 'English', lang: 'en' },
];

/** Selector de idioma persistente: no recarga ni mueve el foco; anuncia el cambio en el idioma nuevo. */
export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const { announce } = useNotifications();
  const language = useLanguage();

  const handleChange = async (next: Language) => {
    await changeLanguage(next);
    announce(i18n.getFixedT(next)('settings.language.changed'));
  };

  return (
    <Select
      id="settings-language"
      name="language"
      label={t('settings.language.label')}
      value={language}
      options={LANGUAGE_OPTIONS}
      onChange={(next) => void handleChange(next)}
    />
  );
}
