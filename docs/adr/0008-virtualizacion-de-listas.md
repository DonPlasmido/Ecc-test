# ADR-0008: Virtualización de la lista de movimientos con @tanstack/react-virtual y altura fija

**Date**: 2026-11-17
**Status**: accepted
**Deciders**: agente `architect` (ECC); validado por el responsable del proyecto (2026-11-17), que adopta la librería según `docs/research/search-first.md` (b)

## Context

La lista de movimientos debe ser fluida con 100.000 filas en un Pixel 7 (PRD: filtro < 200 ms, sin tirones).
Renderizar 100k nodos es inviable. La propuesta inicial de este ADR era un hook propio porque no había librería
verificada. La investigación search-first verificó `@tanstack/react-virtual` 3.14.25 (publicada 2026-11-01, MIT,
headless, compatible con React 19) y el council la aceptaba como alternativa a la versión a mano.

## Decision

Adoptamos `@tanstack/react-virtual` **3.14.25** (versión exacta fijada en `package.json`) detrás de un componente
fino `VirtualTransactionList` que aporta el marcado y la semántica accesible: `role="table"`/`role="grid"` con
`aria-rowcount` = total filtrado, `aria-rowindex` por fila, cabecera fija, navegación por teclado entre filas y
anuncio `aria-live` del total. Altura de fila fija (cómoda 56 px, compacta 44 px) con `overscan` para evitar
mediciones. Las filas visibles se piden a `QueryTransactions.page` en bloques de 100 cacheados por `resultId`;
el filtrado y el orden se hacen sobre el índice en memoria (ADR-0009), nunca re-renderizando la lista.

## Alternatives Considered

### Alternativa 1: hook propio `useVirtualRows` con altura fija (propuesta inicial y recomendación del council)
- **Pros**: sin dependencia; ~80 líneas con tests del cálculo de rango.
- **Cons**: mantenimiento propio de casos límite (orientación, scroll restoration, Safari/Chrome Android).
- **Why not**: ya hay una librería verificada, probada en producción y headless que no limita la accesibilidad.

### Alternativa 2: react-window 2.5.3
- **Pros**: maduro y ligero.
- **Cons**: API v2 nueva (`List`/`rowComponent`); menos control sobre la semántica de tabla.
- **Why not**: el enfoque headless de TanStack encaja mejor con el marcado accesible propio.

### Alternativa 3: react-virtuoso / virtua
- **Pros**: alturas automáticas (`TableVirtuoso`); virtua es muy ligero.
- **Cons**: virtuoso añade API y comportamiento implícito; virtua sigue en 0.x.
- **Why not**: más superficie o menos estabilidad de API sin beneficio para filas de altura fija.

### Alternativa 4: paginación clásica (páginas de 50)
- **Pros**: trivial y accesible.
- **Cons**: peor experiencia en móvil; el PRD pide lista fluida.
- **Why not**: no cumple la expectativa; se mantiene como modo de reserva.

## Consequences

### Positive
- DOM constante (~30–40 filas) independiente del total, con una librería mantenida y probada.
- Admite alturas variables (`measureElement`) y scroll a un índice si se necesitan más adelante.

### Negative
- Nueva dependencia (~64 KB descomprimido) que hay que mantener fijada a una versión exacta.
- En jsdom (Vitest) no renderiza filas sin dimensiones: los tests deben dar `initialRect` o simular medidas, y el scroll real se comprueba en Playwright.
- Altura fija: conceptos largos se truncan con elipsis (detalle completo en el diálogo de edición).

### Risks
- Cambios de API o regresiones en versiones nuevas (publica a menudo). Mitigación: versión exacta, actualizar solo versiones publicadas hace ≥ 2 semanas, uso confinado en `VirtualTransactionList`.
- Rendimiento en móvil. Mitigación: E2E en Pixel 7 con 100k sembrados midiendo tareas largas.
- Compatibilidad con React Compiler no verificada. Mitigación: comprobarla antes de activarlo.
