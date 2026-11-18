import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSnapshotPort } from '@/application/ports/outbound/DataSnapshotPort';
import { DeleteAllDataUseCase } from '@/application/use-cases/DeleteAllDataUseCase';
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories';
import { rule, tx } from '../../domain/builders';
import { createWorld, type World } from '../harness';

let w: World;
let onDataChanged: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  w = createWorld();
  onDataChanged = vi.fn<() => void>();
  w.state.transactions.set('tx-1', tx());
  w.state.rules.set('rule-1', rule());
  w.state.settings = { locale: 'es', theme: 'dark', lastBackupAt: '2026-01-01T00:00:00.000Z' };
});

describe('DeleteAllDataUseCase', () => {
  it('empties every store, restores the default categories and notifies the index', async () => {
    // Act
    const result = await new DeleteAllDataUseCase({ snapshot: w.snapshot, onDataChanged }).execute();

    // Assert
    expect(result.ok).toBe(true);
    const after = await w.snapshot.exportAll();
    expect(after.transactions).toEqual([]);
    expect(after.rules).toEqual([]);
    expect(after.accounts).toEqual([]);
    expect(after.budgets).toEqual([]);
    expect(after.settings).toBeNull();
    expect(after.categories.map((c) => c.id).sort()).toEqual(DEFAULT_CATEGORIES.map((c) => c.id).sort());
    expect(onDataChanged).toHaveBeenCalledOnce();
  });

  it('maps a quota failure to storage.quotaExceeded and does not notify', async () => {
    // Arrange
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    const failing: DataSnapshotPort = { exportAll: () => w.snapshot.exportAll(), replaceAll: () => Promise.reject(quota) };

    // Act
    const result = await new DeleteAllDataUseCase({ snapshot: failing, onDataChanged }).execute();

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('storage.quotaExceeded');
    expect(onDataChanged).not.toHaveBeenCalled();
  });
});
