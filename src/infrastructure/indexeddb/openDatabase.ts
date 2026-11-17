import { openDB } from 'idb';
import { DB_NAME, DB_VERSION, upgradeSchema, type CuentasClarasDatabase, type CuentasClarasDB } from './schema';

/**
 * Abre (y migra si hace falta) la base. Si otra pestaña pide una versión mayor,
 * esta conexión se cierra para no bloquear la actualización.
 */
export function openDatabase(name: string = DB_NAME): Promise<CuentasClarasDatabase> {
  return openDB<CuentasClarasDB>(name, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      upgradeSchema(db, oldVersion, transaction);
    },
    blocking(_current, _blocked, event) {
      (event.target as IDBDatabase).close();
    },
  });
}
