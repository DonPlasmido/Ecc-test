import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories';
import { DOMAIN_ERROR_CODES } from '@/domain/shared/DomainError';
import enCommon from '@/ui/i18n/locales/en/common.json';
import enErrors from '@/ui/i18n/locales/en/errors.json';
import esCommon from '@/ui/i18n/locales/es/common.json';
import esErrors from '@/ui/i18n/locales/es/errors.json';

type Tree = { readonly [key: string]: unknown };

/** Aplana un árbol JSON a claves con puntos (solo hojas de texto). */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      entries.set(path, value);
    } else if (value && typeof value === 'object') {
      flatten(value as Tree, path).forEach((leaf, leafPath) => entries.set(leafPath, leaf));
    } else {
      throw new Error(`Non-string leaf at ${path}`);
    }
  }
  return entries;
}

function placeholders(text: string): readonly string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1] ?? '').sort();
}

const NAMESPACES = {
  common: { es: flatten(esCommon), en: flatten(enCommon) },
  errors: { es: flatten(esErrors), en: flatten(enErrors) },
} as const;

describe('i18n locale parity (i18n-sync)', () => {
  it.each(Object.entries(NAMESPACES))('es and en have exactly the same keys in %s', (_ns, { es, en }) => {
    // Arrange
    const esKeys = [...es.keys()].sort();
    const enKeys = [...en.keys()].sort();

    // Assert
    expect(enKeys.filter((key) => !es.has(key))).toEqual([]);
    expect(esKeys.filter((key) => !en.has(key))).toEqual([]);
  });

  it.each(Object.entries(NAMESPACES))('keeps the same interpolation placeholders in %s', (_ns, { es, en }) => {
    for (const [key, esText] of es) {
      expect(placeholders(en.get(key) ?? ''), key).toEqual(placeholders(esText));
    }
  });

  it.each(Object.entries(NAMESPACES))('has no empty translations in %s', (_ns, { es, en }) => {
    for (const [key, text] of [...es, ...en]) {
      expect(text.trim(), key).not.toBe('');
    }
  });

  it('translates every DomainErrorCode in both languages', () => {
    const missing = DOMAIN_ERROR_CODES.filter(
      (code) => !NAMESPACES.errors.es.has(code) || !NAMESPACES.errors.en.has(code),
    );
    expect(missing).toEqual([]);
  });

  it('translates the nameKey of every default category', () => {
    const missing = DEFAULT_CATEGORIES.flatMap((category) => (category.nameKey ? [category.nameKey] : [])).filter(
      (key) => !NAMESPACES.common.es.has(key) || !NAMESPACES.common.en.has(key),
    );
    expect(missing).toEqual([]);
  });
});
