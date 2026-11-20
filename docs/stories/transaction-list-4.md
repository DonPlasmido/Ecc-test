# Story: Benchmark de filtrado en CI

**ID:** transaction-list-4
**Epic:** transaction-list
**Sprint:** 3
**Status:** todo
**Points:** 3

## Context

Como equipo queremos un benchmark que falle si el filtrado de 100.000 movimientos supera el umbral para evitar regresiones de rendimiento. Contribuye a la épica «Lista de movimientos» (F5).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-032: Benchmark de filtrado de 100.000 movimientos — filtrado: **p95 ≤ 50 ms** y media ≤ 25 ms; filtrado + ordenación: p95 ≤ 100 ms; mínimo 30 iteraciones tras calentamiento, en el runner de CI (`ubuntu-latest`, Node LTS) (TEST-LIST-002)
- [ ] AC-014: Rendimiento de importación de 100.000 filas — media ≤ 2.000 ms en el runner de CI; la UI muestra progreso durante la importación real (TEST-IMP-014)

## Technical Notes

tinybench; `npm run bench` en CI.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
