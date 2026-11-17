import { describe, expect, test, vi } from 'vitest';
import { SystemClock } from '@/infrastructure/system/SystemClock';
import { CryptoRandomIdGenerator } from '@/infrastructure/system/CryptoRandomIdGenerator';
import { NavigatorStoragePersistence } from '@/infrastructure/system/NavigatorStoragePersistence';

describe('SystemClock', () => {
  test('now returns the ISO datetime of the current instant', () => {
    const clock = new SystemClock(() => new Date('2026-11-17T10:20:30.456Z'));
    expect(clock.now()).toBe('2026-11-17T10:20:30.456Z');
  });

  test('today uses the local calendar date, zero padded', () => {
    const clock = new SystemClock(() => new Date(2026, 0, 5, 23, 59, 59));
    expect(clock.today()).toBe('2026-01-05');
  });

  test('defaults to the real system time', () => {
    const clock = new SystemClock();
    expect(clock.now()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    expect(clock.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });
});

describe('CryptoRandomIdGenerator', () => {
  test('delegates to crypto.randomUUID', () => {
    const generator = new CryptoRandomIdGenerator({ randomUUID: () => 'fixed-uuid' });
    expect(generator.next()).toBe('fixed-uuid');
  });

  test('default generator yields distinct UUIDs', () => {
    const generator = new CryptoRandomIdGenerator();
    const a = generator.next();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
    expect(generator.next()).not.toBe(a);
  });
});

describe('NavigatorStoragePersistence', () => {
  test('requestPersistence returns the browser decision', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    expect(await new NavigatorStoragePersistence({ persist }).requestPersistence()).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  test('requestPersistence is false when the API is missing or throws', async () => {
    expect(await new NavigatorStoragePersistence(undefined).requestPersistence()).toBe(false);
    expect(await new NavigatorStoragePersistence({}).requestPersistence()).toBe(false);
    const failing = { persist: vi.fn().mockRejectedValue(new Error('denied')) };
    expect(await new NavigatorStoragePersistence(failing).requestPersistence()).toBe(false);
  });

  test('estimate maps usage and quota', async () => {
    const storage = { estimate: vi.fn().mockResolvedValue({ usage: 10, quota: 1000 }) };
    expect(await new NavigatorStoragePersistence(storage).estimate()).toEqual({ usageBytes: 10, quotaBytes: 1000 });
  });

  test('estimate defaults missing numbers to zero', async () => {
    const storage = { estimate: vi.fn().mockResolvedValue({}) };
    expect(await new NavigatorStoragePersistence(storage).estimate()).toEqual({ usageBytes: 0, quotaBytes: 0 });
  });

  test('estimate is null when unavailable or failing', async () => {
    expect(await new NavigatorStoragePersistence(undefined).estimate()).toBeNull();
    expect(await new NavigatorStoragePersistence({}).estimate()).toBeNull();
    const failing = { estimate: vi.fn().mockRejectedValue(new Error('x')) };
    expect(await new NavigatorStoragePersistence(failing).estimate()).toBeNull();
  });
});
