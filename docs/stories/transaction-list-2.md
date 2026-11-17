# Story: Búsqueda y filtros

**ID:** transaction-list-2
**Epic:** transaction-list
**Sprint:** 4
**Status:** todo
**Points:** 5

## Context

Como usuario quiero buscar y filtrar movimientos para encontrar uno concreto rápidamente. Contribuye a la épica «Lista de movimientos» (F5).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-033: Respuesta de la UI al buscar — p95 (10 búsquedas) ≤ 200 ms desde el fin del debounce hasta que la lista filtrada y el contador están pintados; hidratación + render inicial de la lista ≤ 1.500 ms; ninguna tarea larga > 50 ms durante el scroll (TEST-LIST-003)
- [ ] AC-034: Búsqueda y filtros combinables — el resultado es la intersección (AND) de todos los filtros; búsqueda por subcadena sin distinguir mayúsculas ni tildes; se muestra el número de resultados (TEST-LIST-004)

## Technical Notes

Depende de transaction-list-1 y transaction-list-4.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
