import { describe, expect, it } from 'vitest';
import type { AccountId } from '@/domain/account/Account';
import type { CategoryId } from '@/domain/category/Category';
import { createTestContainer } from '@/composition/createTestContainer';

const PASSWORD = 'una-contrasena-larga-123';

const CSV = 'Fecha;Concepto;Importe\n01/08/2026;NETFLIX.COM;-12,99\n02/08/2026;NOMINA EMPRESA;1.850,00\n';

function file(): { name: string; bytes: ArrayBuffer } {
  const bytes = new TextEncoder().encode(CSV);
  return { name: 'mov.csv', bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
}

describe('createTestContainer', () => {
  it('starts hydrated with default categories and no data', async () => {
    const c = await createTestContainer();
    expect(c.indexStore.getSnapshot()).toMatchObject({ size: 0, hydration: { status: 'ready' } });
    expect((await c.manageCatalog.listCategories()).length).toBeGreaterThan(0);
  });

  it('is deterministic: sequential ids and a fixed clock', async () => {
    const c = await createTestContainer();
    const saved = await c.manageCatalog.saveAccount({ name: 'Cuenta', ibanLast4: null });
    expect(saved.ok && saved.value.id).toMatch(/^id-\d+$/);
    expect(saved.ok && saved.value.createdAt).toBe('2026-03-15T10:00:00.000Z');
  });

  it('imports a statement and the index and store reflect it', async () => {
    const c = await createTestContainer();
    const account = await c.manageCatalog.saveAccount({ name: 'Cuenta', ibanLast4: null });
    if (!account.ok) throw new Error('account');
    const preview = await c.importStatement.preview(file());
    if (!preview.ok) throw new Error('preview');
    const result = await c.importStatement.commit({
      previewId: preview.value.previewId,
      accountId: account.value.id as AccountId,
      mapping: preview.value.suggestedMapping,
    });
    expect(result.ok && result.value.inserted).toBe(2);
    await c.whenIndexIdle();
    expect(c.indexStore.getSnapshot().size).toBe(2);
  });

  it('round-trips an encrypted backup with the fast cipher', async () => {
    const source = await createTestContainer();
    await source.manageCatalog.saveAccount({ name: 'Cuenta', ibanLast4: '1234' });
    const backup = await source.exportEncryptedBackup.execute({ password: PASSWORD });
    if (!backup.ok) throw new Error('export');

    const target = await createTestContainer();
    const imported = await target.importEncryptedBackup.execute({ bytes: backup.value.bytes, password: PASSWORD });
    expect(imported.ok).toBe(true);
    expect(await target.manageCatalog.listAccounts()).toHaveLength(1);
  });

  it('lets tests override ports', async () => {
    const c = await createTestContainer({ storage: { requestPersistence: () => Promise.resolve(true), estimate: () => Promise.resolve({ usageBytes: 1, quotaBytes: 2 }) } });
    expect(await c.storage.estimate()).toEqual({ usageBytes: 1, quotaBytes: 2 });
    expect(await c.storage.requestPersistence()).toBe(true);
    expect((await c.manageCatalog.listCategories()).some((x) => x.id === ('cat-groceries' as CategoryId))).toBe(true);
  });
});
