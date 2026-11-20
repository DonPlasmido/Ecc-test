import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

function cspDirectives(): Map<string, string> {
  const match = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(html);
  if (!match?.[1]) throw new Error('index.html no declara CSP');
  const entries = match[1]
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part): [string, string] => {
      const [name = '', ...values] = part.split(/\s+/);
      return [name, values.join(' ')];
    });
  return new Map(entries);
}

describe('index.html CSP (L3)', () => {
  test.each([
    ['default-src', "'self'"],
    ['connect-src', "'self'"],
    ['img-src', "'self' data: blob:"],
    ['style-src', "'self' 'unsafe-inline'"],
    ['script-src', "'self'"],
    ['worker-src', "'self' blob:"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'none'"],
  ])('sets %s to %s', (directive, value) => {
    expect(cspDirectives().get(directive)).toBe(value);
  });
});
