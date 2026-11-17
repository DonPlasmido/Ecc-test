import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import esCommon from './locales/es/common.json';
import esErrors from './locales/es/errors.json';

/** Idiomas de la interfaz. `es` va en el chunk inicial; `en` se carga bajo demanda (ADR-0007). */
export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'es';
export const NAMESPACES = ['common', 'errors'] as const;

const LANGUAGE_STORAGE_KEY = 'cc.language';

type LocaleBundle = Readonly<Record<(typeof NAMESPACES)[number], Record<string, unknown>>>;

const loaders: Readonly<Record<Language, () => Promise<LocaleBundle>>> = {
  es: async () => ({ common: esCommon, errors: esErrors }),
  en: async () => {
    const [common, errors] = await Promise.all([
      import('./locales/en/common.json'),
      import('./locales/en/errors.json'),
    ]);
    return { common: common.default, errors: errors.default };
  },
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Lee la preferencia guardada; si no hay, español (AC-044: el idioma por defecto no depende del
 * navegador). Nunca lanza.
 */
export function readPreferredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // localStorage bloqueado (modo privado, política): se usa el idioma por defecto.
  }
  return DEFAULT_LANGUAGE;
}

function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Sin persistencia: el idioma se mantiene solo en esta sesión.
  }
}

async function ensureLanguageLoaded(instance: I18nInstance, language: Language): Promise<void> {
  if (instance.hasResourceBundle(language, 'common')) return;
  const bundle = await loaders[language]();
  for (const ns of NAMESPACES) {
    instance.addResourceBundle(language, ns, bundle[ns], true, true);
  }
}

function syncDocumentLanguage(language: string): void {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}

/** Instancia única de la app. */
export const i18n: I18nInstance = i18next.createInstance();
i18n.on('languageChanged', syncDocumentLanguage);

/**
 * Inicializa i18next con el idioma dado (cargándolo antes del primer render para no
 * leer inglés con voz española). Idempotente.
 */
export async function initI18n(language: Language = readPreferredLanguage()): Promise<I18nInstance> {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: { es: { common: esCommon, errors: esErrors } },
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: [...SUPPORTED_LANGUAGES],
      ns: [...NAMESPACES],
      defaultNS: 'common',
      interpolation: { escapeValue: false }, // React ya escapa
      react: { useSuspense: false },
    });
  }
  await ensureLanguageLoaded(i18n, language);
  if (i18n.language !== language) await i18n.changeLanguage(language);
  syncDocumentLanguage(language);
  return i18n;
}

/** Cambia el idioma: carga el paquete si falta, actualiza `<html lang>` y lo persiste. */
export async function changeLanguage(language: Language): Promise<void> {
  await ensureLanguageLoaded(i18n, language);
  await i18n.changeLanguage(language);
  storeLanguage(language);
}

/** Idioma activo, siempre uno soportado. */
export function currentLanguage(instance: I18nInstance = i18n): Language {
  const lng = instance.resolvedLanguage ?? instance.language;
  return isLanguage(lng) ? lng : DEFAULT_LANGUAGE;
}
