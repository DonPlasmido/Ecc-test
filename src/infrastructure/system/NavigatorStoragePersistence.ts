import type {
  StorageEstimate,
  StoragePersistencePort,
} from '@/application/ports/outbound/StoragePersistencePort';

type StorageLike = Partial<Pick<StorageManager, 'persist' | 'estimate'>>;

/** `navigator.storage` con degradación elegante si el navegador no ofrece la API. */
export class NavigatorStoragePersistence implements StoragePersistencePort {
  constructor(private readonly storage: StorageLike | undefined = globalThis.navigator?.storage) {}

  async requestPersistence(): Promise<boolean> {
    if (typeof this.storage?.persist !== 'function') return false;
    try {
      return await this.storage.persist();
    } catch {
      return false;
    }
  }

  async estimate(): Promise<StorageEstimate | null> {
    if (typeof this.storage?.estimate !== 'function') return null;
    try {
      const { usage = 0, quota = 0 } = await this.storage.estimate();
      return { usageBytes: usage, quotaBytes: quota };
    } catch {
      return null;
    }
  }
}
