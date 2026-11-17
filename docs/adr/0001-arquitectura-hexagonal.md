# ADR-0001: Arquitectura hexagonal (Ports & Adapters) por capas en `src/`

**Date**: 2026-11-17
**Status**: proposed
**Deciders**: agente `architect` (ECC); pendiente de validación por el responsable del proyecto

## Context

Cuentas Claras es una SPA sin backend con lógica de negocio no trivial (parseo de formatos bancarios,
deduplicación, reglas con prioridad, presupuestos) y varias tecnologías de borde (IndexedDB, papaparse,
exceljs, WebCrypto, React). El objetivo del proyecto es demostrar ingeniería con cobertura ≥ 80 %, y la
mayoría de reglas deben probarse sin navegador. Sin fronteras explícitas, la lógica acabaría en hooks de React
y en callbacks de IndexedDB, imposible de probar de forma aislada.

## Decision

Usamos Ports & Adapters con cuatro carpetas por capa: `src/domain` (puro, sin dependencias externas),
`src/application` (casos de uso + puertos de entrada/salida + índice de lectura), `src/infrastructure`
(adaptadores de salida) y `src/ui` (adaptador de entrada React), más un único composition root en
`src/composition/createContainer.ts`. Las dependencias apuntan hacia dentro y se verifican con
`no-restricted-imports` de ESLint y un test de arquitectura.

## Alternatives Considered

### Alternativa 1: estructura por feature en `src/features/*` (React-first)
- **Pros**: cercanía de archivos por funcionalidad; habitual en proyectos React.
- **Cons**: la frontera dominio/infraestructura depende de la disciplina; los hooks tienden a mezclar E/S y reglas.
- **Why not**: el brief pide capas explícitas y testeables; dentro de cada capa sí agrupamos por feature (`domain/rule`, `ui/features/import`).

### Alternativa 2: hexagonal feature-first (`src/features/<x>/{domain,application,adapters}`)
- **Pros**: recomendada por la skill para servicios con muchos bounded contexts.
- **Cons**: aquí hay un único contexto (finanzas personales) con entidades muy compartidas (Transaction la usan todas las features); generaría imports cruzados entre features.
- **Why not**: un solo bounded context no justifica la fragmentación.

### Alternativa 3: capas simples sin puertos (servicios que llaman a idb directamente)
- **Pros**: menos archivos e interfaces.
- **Cons**: los tests de casos de uso necesitarían fake-indexeddb para todo; cambiar de almacenamiento o parser tocaría la lógica.
- **Why not**: contradice el objetivo de testabilidad y la exigencia de copias/importaciones verificables.

## Consequences

### Positive
- Dominio y casos de uso probados con Vitest puro y fakes en memoria, rápidos y deterministas.
- Las suites de contrato garantizan que fakes y adaptadores reales se comportan igual.
- Cambiar exceljs, recharts o el almacenamiento queda confinado a un adaptador.

### Negative
- Más archivos e indirección (interfaces de puerto, mappers, composition root).
- Cada nuevo efecto lateral exige definir un puerto antes de usarlo.

### Risks
- Puertos "con forma de tecnología" (p. ej. exponer `IDBKeyRange`). Mitigación: los puertos usan tipos de dominio y métodos de grano grueso (`insertImport`, `replaceAll`); revisión con `code-reviewer`.
- Sobreingeniería de puertos de entrada para CRUD trivial. Mitigación: `ManageCatalog` agrupa el CRUD (YAGNI).
