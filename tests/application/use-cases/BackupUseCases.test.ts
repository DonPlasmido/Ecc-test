import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportEncryptedBackupUseCase } from '@/application/use-cases/ExportEncryptedBackupUseCase';
import { ImportEncryptedBackupUseCase } from '@/application/use-cases/ImportEncryptedBackupUseCase';
import { WebCryptoBackupCipher } from '@/infrastructure/crypto/WebCryptoBackupCipher';
import { rule, tx } from '../../domain/builders';
import { createWorld, type World } from '../harness';

const PASSWORD = 'una-contraseña-segura-123';
const cipher = new WebCryptoBackupCipher({ iterations: 1000, iterationLimits: { min: 1, max: 2_000_000 } });

let w: World;
let onDataChanged: ReturnType<typeof vi.fn<() => void>>;

function exporter(): ExportEncryptedBackupUseCase {
  return new ExportEncryptedBackupUseCase({ snapshot: w.snapshot, cipher, clock: w.clock, settings: w.settings });
}

function importer(snapshot = w.snapshot): ImportEncryptedBackupUseCase {
  return new ImportEncryptedBackupUseCase({ snapshot, cipher, onDataChanged });
}

function seed(world: World): void {
  world.state.transactions.set('tx-1', tx({ rawDescription: 'MERCADONA VALENCIA', normalizedDescription: 'MERCADONA VALENCIA' }));
  world.state.rules.set('rule-1', rule());
}

beforeEach(() => {
  w = createWorld();
  onDataChanged = vi.fn<() => void>();
  seed(w);
});

async function backupBytes(): Promise<Uint8Array> {
  const result = await exporter().execute({ password: PASSWORD });
  if (!result.ok) throw new Error('export failed');
  return result.value.bytes;
}

describe('ExportEncryptedBackupUseCase', () => {
  it('rejects passwords shorter than 12 characters with backup.weakPassword', async () => {
    const result = await exporter().execute({ password: 'short-pass1' });

    expect(result).toEqual({ ok: false, error: { code: 'backup.weakPassword', details: { expected: 12 } } });
    expect(w.state.settings).toBeNull();
  });

  it('accepts a password of exactly 12 characters', async () => {
    const result = await exporter().execute({ password: '123456789012' });

    expect(result.ok).toBe(true);
  });

  it('names the file after the clock date with the .ccbackup extension', async () => {
    const result = await exporter().execute({ password: PASSWORD });

    expect(result.ok && result.value.fileName).toBe('cuentas-claras-2026-03-15.ccbackup');
  });

  it('never leaves plaintext descriptions in the bytes', async () => {
    const bytes = await backupBytes();

    expect(new TextDecoder('latin1').decode(bytes)).not.toContain('MERCADONA');
  });

  it('produces different bytes on every export (fresh salt and IV)', async () => {
    const first = await backupBytes();
    const second = await backupBytes();

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
  });

  it('records lastBackupAt in settings, keeping existing settings', async () => {
    w.state.settings = { locale: 'en', theme: 'dark' };

    await exporter().execute({ password: PASSWORD });

    expect(w.state.settings).toEqual({ locale: 'en', theme: 'dark', lastBackupAt: '2026-03-15T10:00:00.000Z' });
  });

  it('creates default settings when none exist yet', async () => {
    await exporter().execute({ password: PASSWORD });

    expect(w.state.settings).toEqual({ locale: 'es', theme: 'system', lastBackupAt: '2026-03-15T10:00:00.000Z' });
  });

  it('does not update lastBackupAt when encryption fails', async () => {
    const failing = { encrypt: () => Promise.reject(new Error('boom')), decrypt: cipher.decrypt.bind(cipher) };
    const useCase = new ExportEncryptedBackupUseCase({ snapshot: w.snapshot, cipher: failing, clock: w.clock, settings: w.settings });

    await expect(useCase.execute({ password: PASSWORD })).rejects.toThrow('boom');
    expect(w.state.settings).toBeNull();
  });
});

describe('ImportEncryptedBackupUseCase', () => {
  it('restores every table after wiping the database (round trip)', async () => {
    const bytes = await backupBytes();
    const before = await w.snapshot.exportAll();
    const target = createWorld();
    target.state.transactions.set('other', tx({ id: 'other' as never, dedupKey: 'zzz#0' as never }));

    const result = await importer(target.snapshot).execute({ bytes, password: PASSWORD });

    expect(result).toEqual({ ok: true, value: { transactions: 1, exportedAt: '2026-03-15T10:00:00.000Z' } });
    const after = await target.snapshot.exportAll();
    expect({ ...after, exportedAt: '' }).toEqual({ ...before, exportedAt: '', settings: after.settings });
    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  it('writes nothing with a wrong password', async () => {
    const bytes = await backupBytes();
    const target = createWorld();
    const before = structuredClone(target.state);

    const result = await importer(target.snapshot).execute({ bytes, password: 'otra-contraseña-distinta' });

    expect(result).toEqual({ ok: false, error: { code: 'backup.wrongPasswordOrCorrupted' } });
    expect(target.state).toEqual(before);
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  it('writes nothing when one ciphertext byte is flipped', async () => {
    const bytes = (await backupBytes()).slice();
    bytes[bytes.length - 5] = (bytes[bytes.length - 5] ?? 0) ^ 1;
    const target = createWorld();
    const before = structuredClone(target.state);

    const result = await importer(target.snapshot).execute({ bytes, password: PASSWORD });

    expect(result.ok).toBe(false);
    expect(target.state).toEqual(before);
  });

  it('writes nothing with a truncated file', async () => {
    const bytes = (await backupBytes()).slice(0, 20);
    const target = createWorld();
    const before = structuredClone(target.state);

    const result = await importer(target.snapshot).execute({ bytes, password: PASSWORD });

    expect(result.ok).toBe(false);
    expect(target.state).toEqual(before);
  });

  it('rejects authenticated but malformed JSON as invalid snapshot', async () => {
    const bytes = await cipher.encrypt(new TextEncoder().encode('{not json'), PASSWORD);
    const target = createWorld();
    const before = structuredClone(target.state);

    const result = await importer(target.snapshot).execute({ bytes, password: PASSWORD });

    expect(result).toEqual({ ok: false, error: { code: 'backup.invalidSnapshot' } });
    expect(target.state).toEqual(before);
  });

  it('rejects an authenticated snapshot that fails validation without writing', async () => {
    const snapshot = await w.snapshot.exportAll();
    const broken = { ...snapshot, transactions: [{ ...tx(), amount: { cents: 0.5 } }] };
    const bytes = await cipher.encrypt(new TextEncoder().encode(JSON.stringify(broken)), PASSWORD);
    const target = createWorld();
    const before = structuredClone(target.state);

    const result = await importer(target.snapshot).execute({ bytes, password: PASSWORD });

    expect(result).toEqual({ ok: false, error: { code: 'backup.invalidSnapshot', details: expect.anything() } });
    expect(target.state).toEqual(before);
  });

  it('rejects an authenticated snapshot with a newer format version', async () => {
    const snapshot = await w.snapshot.exportAll();
    const bytes = await cipher.encrypt(new TextEncoder().encode(JSON.stringify({ ...snapshot, formatVersion: 99 })), PASSWORD);

    const result = await importer().execute({ bytes, password: PASSWORD });

    expect(result.ok === false && result.error.code).toBe('backup.unsupportedVersion');
  });

  it('maps a quota failure while replacing to storage.quotaExceeded', async () => {
    const bytes = await backupBytes();
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    const snapshot = { exportAll: w.snapshot.exportAll.bind(w.snapshot), replaceAll: () => Promise.reject(quota) };

    const result = await importer(snapshot).execute({ bytes, password: PASSWORD });

    expect(result).toEqual({ ok: false, error: { code: 'storage.quotaExceeded' } });
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  it('rethrows unexpected write failures', async () => {
    const bytes = await backupBytes();
    const snapshot = { exportAll: w.snapshot.exportAll.bind(w.snapshot), replaceAll: () => Promise.reject(new Error('disk on fire')) };

    await expect(importer(snapshot).execute({ bytes, password: PASSWORD })).rejects.toThrow('disk on fire');
  });

  it('works without an onDataChanged callback', async () => {
    const bytes = await backupBytes();

    const result = await new ImportEncryptedBackupUseCase({ snapshot: w.snapshot, cipher }).execute({ bytes, password: PASSWORD });

    expect(result.ok).toBe(true);
  });
});
