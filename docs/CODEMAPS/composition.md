# Composition Codemap

<!-- Generated: 2026-11-20 | Files: src/composition/*.ts (6) -->

**Entry points:** `src/composition/createContainer.ts` (producción), `src/composition/createTestContainer.ts` (tests)

## Módulos

| Archivo | Export | Función |
|---|---|---|
| createContainer.ts | `createContainer(options?)` | `openDatabase(options.dbName)` → adaptadores reales → `buildContainer` |
| buildContainer.ts | `buildContainer(ports)`, `seedDefaultCategories` | Siembra categorías si el catálogo está vacío; crea `TransactionIndex`, `IndexSync`, casos de uso singleton; pide `storage.persist()` |
| buildContainer.ts | `ContainerPorts` | Puertos ya construidos (reales o fakes) |
| createTestContainer.ts | `createTestContainer(overrides)` | Igual, con fakes en memoria (`tests/fakes`) |
| IndexSync.ts | `IndexSync` | `hydrate()` con progreso; `notifyDataChanged` → `drain` → `reconcile` (upsert por tramos, `applyDeletes`); reintentos [200, 1000, 3000] ms; `whenIdle()` |
| container.types.ts | `AppContainer` | Solo puertos de entrada + `indexStore`, `settings`, `storage`, `whenIndexIdle`, `dispose` |

## Flujo de arranque

```
main.tsx ─ import() ─► createContainer ─► openDatabase (IDB)
                           └─► buildContainer ─► seedDefaultCategories
                                  ├─► IndexSync.hydrate()  (getAll por tramos → TransactionIndex)
                                  └─► casos de uso (inyección por constructor)
```

## Actualización del índice

- Importación, categorización, aprendizaje de reglas, catálogo, restaurar y borrar: llaman a `onDataChanged` (= `IndexSync.notifyDataChanged`) y el índice se reconcilia contra IndexedDB.
- Edición de descripción/nota (`QueryTransactionsUseCase.update`): escribe en el repositorio y llama a `index.applyUpserts` directamente. Es una excepción a la reconciliación completa; ver desviaciones en `docs/architecture.md`.

## Tests

`tests/composition/` (createTestContainer, seedDefaultCategories, IndexSync, fullFlow.integration).

## Related

[INDEX](INDEX.md) · [application](application.md) · [infrastructure](infrastructure.md) · [ui](ui.md)
