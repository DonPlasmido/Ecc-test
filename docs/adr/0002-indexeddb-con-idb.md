# ADR-0002: IndexedDB con `idb` como persistencia, con transacciones de grano grueso

**Date**: 2026-11-17
**Status**: accepted
**Deciders**: agente `architect` (ECC); validado por el responsable del proyecto (2026-11-17)

## Context

El brief fija IndexedDB como persistencia y exige fluidez con 100.000 movimientos en un móvil (Pixel 7),
sin servidor. La API nativa de IndexedDB es de callbacks y propensa a errores (transacciones que se
autocierran al esperar promesas ajenas). Necesitamos esquema versionado, índices para consultas por fecha,
cuenta, categoría y lote, y atomicidad al importar extractos y restaurar copias.

## Decision

Usamos `idb` 8.0.4 con un `DBSchema` tipado. Base `cuentas-claras` v1 con stores `transactions`, `accounts`,
`categories`, `rules`, `budgets`, `importBatches`, `importProfiles` y `meta`. `transactions` tiene `keyPath: 'id'`
e índices `byDedupKey` (único), `byDate`, `byAccountDate`, `byCategoryDate` y `byImportBatch`. La atomicidad se
expresa con métodos de repositorio de grano grueso (`insertImport`, `updateMany`, `replaceAll`) que abren una
sola transacción y no esperan nada externo dentro de ella; no hay `UnitOfWork` genérico. La búsqueda y los
agregados no se resuelven en IndexedDB sino en el índice en memoria ([ADR-0009](0009-indice-de-lectura-en-memoria.md)).

## Alternatives Considered

### Alternativa 1: Dexie.js
- **Pros**: API de consultas rica, migraciones declarativas, `liveQuery`.
- **Cons**: no está en las versiones verificadas del brief; más peso; su modelo de consultas invita a filtrar en IDB, lento para texto libre.
- **Why not**: restricción de dependencias verificadas y `idb` cubre lo necesario con ~1 KB.

### Alternativa 2: SQLite WASM (OPFS)
- **Pros**: SQL, FTS5 para búsqueda de texto, agregados nativos.
- **Cons**: ~1 MB de WASM, requiere cabeceras COOP/COEP para OPFS síncrono (GitHub Pages no las permite), complejidad de worker.
- **Why not**: incompatible con el despliegue en GitHub Pages y contrario al brief.

### Alternativa 3: IndexedDB nativo sin envoltorio
- **Pros**: cero dependencias.
- **Cons**: mucho código de callbacks, fácil cometer errores de ciclo de vida de transacciones.
- **Why not**: `idb` ya está fijado y aporta promesas tipadas sin abstraer el modelo.

## Consequences

### Positive
- Esquema explícito y tipado; migraciones con `upgrade(db, oldVersion)` acumulativo y probadas con fake-indexeddb.
- Importaciones y restauraciones atómicas: o se escribe todo o nada.
- Índice único `byDedupKey` como red de seguridad de la deduplicación.

### Negative
- Las consultas complejas (texto, agregados) no se delegan a la BD; dependen del índice en memoria.
- `categoryId` no puede ser `null` (no se indexaría); se usa el centinela `UNCATEGORIZED`.

### Risks
- Desalojo de datos por el navegador. Mitigación: `navigator.storage.persist()` y recordatorio de copia cifrada.
- Rendimiento de escritura masiva en móvil. Mitigación: un único `await tx.done` por lote y benchmark de importación de 1.500 filas (< 2 s).
