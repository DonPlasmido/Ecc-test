# ADR-0005: Estado de UI con React nativo, URL del hash router y versión del índice

**Date**: 2026-11-17
**Status**: accepted
**Deciders**: agente `architect` (ECC); validado por el responsable del proyecto (2026-11-17)

## Context

La UI necesita mostrar datos persistidos que cambian tras importar, recategorizar o restaurar, mantener
filtros de la lista y estado local de formularios. Las versiones verificadas del brief no incluyen ninguna
librería de estado ni de caché de consultas. GitHub Pages sirve una SPA estática bajo `/Ecc-test/` sin
reescrituras de rutas.

## Decision

Tres tipos de estado, sin librería global:
1. **Datos persistidos**: siempre a través de casos de uso (`AppContainer` por `ContainerContext`). Un hook
   `useAsyncQuery(key, fn)` cachea por clave y se invalida cuando cambia `TransactionIndex.version`, observada con
   `useSyncExternalStore` (`useDataVersion`).
2. **Navegación y filtros**: en la URL con `createHashRouter` de react-router-dom 7 (`#/transactions?q=…&cat=…`).
3. **Estado local**: `useState`/`useReducer` en el componente; borradores de importación en el caso de uso (`previewId`).

## Alternatives Considered

### Alternativa 1: Zustand / Redux Toolkit
- **Pros**: store global con devtools, patrones conocidos.
- **Cons**: dependencia no verificada; duplicaría en memoria datos que ya están en el índice y en IDB.
- **Why not**: el índice en memoria ya es la fuente de lectura; un store adicional crearía dos verdades.

### Alternativa 2: TanStack Query como caché de datos locales
- **Pros**: invalidación, estados de carga, deduplicación de peticiones.
- **Cons**: pensado para red; dependencia no verificada; peso.
- **Why not**: el invalidador por versión cubre el caso con ~60 líneas.

### Alternativa 3: `BrowserRouter` con 404.html de redirección
- **Pros**: URLs limpias.
- **Cons**: truco frágil en GitHub Pages, peor para el service worker y el modo offline.
- **Why not**: el hash router funciona sin configuración en Pages y offline.

## Consequences

### Positive
- Cero dependencias nuevas; una sola fuente de verdad de lectura.
- Filtros enlazables y conservados al recargar o volver atrás.
- La UI depende solo de puertos de entrada: tests con `createTestContainer` y fakes.

### Negative
- Invalidación global por versión: un cambio refresca todas las consultas visibles (aceptable: son en memoria y baratas).
- Hay que escribir y probar `useAsyncQuery` propio (carrera de peticiones, cancelación con `AbortSignal`).

### Risks
- Re-renderizados excesivos con 100k. Mitigación: consultas en memoria memoizadas por `(key, version)` y componentes de fila memorizados.
