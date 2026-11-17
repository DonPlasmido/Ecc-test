import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/ui/components/Toast';
import { THEME_PREFERENCES, type ThemePreference } from '@/ui/theme/theme';
import { useTheme } from '@/ui/theme/ThemeProvider';

/** Tema Sistema / Claro / Oscuro como grupo de radios con `<legend>` (a11y §10). */
export function ThemeSelect() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { announce } = useNotifications();

  const handleChange = (next: ThemePreference) => {
    setTheme(next);
    announce(t('settings.theme.changed', { theme: t(`settings.theme.${next}`) }));
  };

  return (
    <fieldset className="stack stack--tight">
      <legend className="field__label">{t('settings.theme.legend')}</legend>
      {THEME_PREFERENCES.map((option) => (
        <label key={option} className="check">
          <input
            type="radio"
            name="theme"
            value={option}
            checked={theme === option}
            onChange={() => handleChange(option)}
          />
          {t(`settings.theme.${option}`)}
        </label>
      ))}
    </fieldset>
  );
}
