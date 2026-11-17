# ADR-0008: Virtualización propia de la lista de movimientos con altura fija

**Date**: 2026-11-17
**Status**: proposed
**Deciders**: agente `architect` (ECC); pendiente de validación por el responsable del proyecto

## Context

La lista de movimientos debe ser fluida con 100.000 filas en un Pixel 7 (PRD: filtro < 200 ms, sin tirones).
Renderizar 100k nodos es inviable. Las versiones verificadas del brief no incluyen ninguna librería de
virtualización y la regla del proyecto exige versiones publicadas hace ≥ 2 semanas y verificadas.

## Decision

Implementamos un hook pequeño `useVirtualRows({ count, rowHeight, overscan, scrollElement })` en `ui/hooks`
con altura de fila fija (densidad cómoda: 56 px; compacta: 44 px), que calcula el rango visible con
`requestAnimationFrame` y `ResizeObserver`. `VirtualTransactionList` pide al caso de uso `QueryTransactions.page`
solo las filas visibles + overscan (bloques de 100 filas cacheados por `resultId`). Accesibilidad: `role="table"`
con `aria-rowcount` total y `aria-rowindex` por fila, navegación por teclado entre filas y anuncio `aria-live`
del total de resultados. El hook queda detrás del componente para poder sustituirlo.

## Alternatives Considered

### Alternativa 1: @tanstack/react-virtual
- **Pros**: probado, alturas variables, mantenimiento activo.
- **Cons**: no está en las versiones verificadas; habría que verificar versión y fecha de publicación.
- **Why not**: restricción del brief para el MVP; es el plan B preferente si el hook propio da problemas.

### Alternativa 2: react-window
- **Pros**: maduro y ligero.
- **Cons**: no verificado; API antigua con compatibilidad React 19 por confirmar.
- **Why not**: mismo motivo y menor actividad.

### Alternativa 3: paginación clásica (páginas de 50)
- **Pros**: trivial y accesible.
- **Cons**: peor experiencia en móvil; el PRD pide lista fluida.
- **Why not**: no cumple la expectativa; se mantiene como modo de reserva sin JS de scroll.

## Consequences

### Positive
- Sin dependencia nueva; ~80 líneas con tests unitarios del cálculo de rango.
- DOM constante (~30–40 filas) independiente del total.

### Negative
- Altura fija: conceptos largos se truncan con elipsis (el detalle completo se ve en el diálogo de edición).
- Mantenimiento propio de casos límite (cambio de orientación, scroll restoration).

### Risks
- "Not Invented Here" y bugs sutiles de scroll en Safari/Chrome Android. Mitigación: E2E en Pixel 7 con 100k sembrados midiendo tareas largas; sustituir por @tanstack/react-virtual tras verificar versión si falla.
