import { describe, expect, it } from 'vitest';
import en from '@/ui/i18n/locales/en/rules.json';
import es from '@/ui/i18n/locales/es/rules.json';

type Tree = { readonly [key: string]: unknown };

/** Hojas de texto con la clave base (sin sufijo plural: es usa `_many`, en no). */
function leaves(tree: Tree, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result.set(path.replace(/_(one|many|other)$/, ''), value);
    else leaves(value as Tree, path).forEach((text, leafPath) => result.set(leafPath, text));
  }
  return result;
}

const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

describe('rules locales (i18n-sync)', () => {
  const esLeaves = leaves(es);
  const enLeaves = leaves(en);

  it('has the same keys in es and en', () => {
    expect([...enLeaves.keys()].sort()).toEqual([...esLeaves.keys()].sort());
  });

  it('keeps the same placeholders and no empty texts', () => {
    for (const [key, text] of esLeaves) {
      expect(text.trim(), key).not.toBe('');
      expect(placeholders(enLeaves.get(key) ?? ''), key).toEqual(placeholders(text));
    }
  });
});
