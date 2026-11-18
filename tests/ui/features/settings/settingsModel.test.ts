import { describe, expect, it } from 'vitest';
import {
  backupAge,
  exportPasswordProblem,
  formatBytes,
  matchesConfirmWord,
  passwordStrength,
} from '@/ui/features/settings/settingsModel';

const DAY = 86_400_000;
const NOW = Date.parse('2026-03-15T10:00:00.000Z');

describe('passwordStrength', () => {
  it.each([
    ['', 'tooShort'],
    ['abcdefghijk', 'tooShort'],
    ['abcdefghijkl', 'weak'],
    ['Abcdefghijk1', 'fair'],
    ['abcdefghijklmnop', 'fair'],
    ['Abcdefghijklmno1', 'strong'],
    ['una frase larga sin mas', 'strong'],
  ] as const)('rates %j as %s', (password, expected) => {
    expect(passwordStrength(password)).toBe(expected);
  });
});

describe('exportPasswordProblem', () => {
  it('reports how many characters are missing', () => {
    expect(exportPasswordProblem('1234567', '1234567')).toEqual({ kind: 'tooShort', missing: 5 });
  });

  it('reports a mismatching confirmation', () => {
    expect(exportPasswordProblem('123456789012', '123456789013')).toEqual({ kind: 'mismatch' });
  });

  it('accepts a long matching password', () => {
    expect(exportPasswordProblem('123456789012', '123456789012')).toBeNull();
  });
});

describe('backupAge', () => {
  it('is never when there is no valid date', () => {
    expect(backupAge(undefined, NOW)).toEqual({ kind: 'never' });
    expect(backupAge('not-a-date', NOW)).toEqual({ kind: 'never' });
  });

  it('is recent up to 30 days and overdue after that', () => {
    expect(backupAge(new Date(NOW - 30 * DAY).toISOString(), NOW)).toEqual({ kind: 'recent', days: 30 });
    expect(backupAge(new Date(NOW - 31 * DAY).toISOString(), NOW)).toEqual({ kind: 'overdue', days: 31 });
  });

  it('never returns negative days for a date in the future', () => {
    expect(backupAge(new Date(NOW + DAY).toISOString(), NOW)).toEqual({ kind: 'recent', days: 0 });
  });
});

describe('formatBytes', () => {
  it('uses the largest binary unit with Intl', () => {
    expect(formatBytes(512, 'en-GB')).toBe('512 byte');
    expect(formatBytes(1_572_864, 'es-ES')).toBe('1,5 MB');
    expect(formatBytes(2 * 1024 ** 3, 'en-GB')).toBe('2 GB');
  });
});

describe('matchesConfirmWord', () => {
  it('ignores case and surrounding spaces but not typos', () => {
    expect(matchesConfirmWord('  borrar ', 'BORRAR')).toBe(true);
    expect(matchesConfirmWord('borra', 'BORRAR')).toBe(false);
  });
});
