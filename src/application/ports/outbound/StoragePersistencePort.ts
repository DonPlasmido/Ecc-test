/** Uso y cuota del almacenamiento del navegador. */
export interface StorageEstimate {
  readonly usageBytes: number;
  readonly quotaBytes: number;
}

/** Persistencia del almacenamiento (`navigator.storage`). */
export interface StoragePersistencePort {
  /** `true` si el navegador concede almacenamiento persistente. */
  requestPersistence(): Promise<boolean>;
  /** `null` si la API no está disponible. */
  estimate(): Promise<StorageEstimate | null>;
}
