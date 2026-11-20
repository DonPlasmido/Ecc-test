# Story: Auditoría WCAG 2.2 AA

**ID:** app-platform-3
**Epic:** app-platform
**Sprint:** 8
**Status:** todo
**Points:** 5

## Context

Como usuario con discapacidad quiero usar toda la app con teclado y lector de pantalla para gestionar mis finanzas de forma autónoma. Contribuye a la épica «Plataforma: PWA accesible, offline y con temas» (F8).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-051: Sin violaciones axe WCAG 2.2 A/AA — 0 violaciones de impacto `serious` o `critical` en las 12 combinaciones (TEST-A11Y-001)
- [ ] AC-052: Flujo completo con teclado — el flujo se completa; el foco es siempre visible y no queda atrapado; los diálogos devuelven el foco al cerrar (TEST-A11Y-002)
- [ ] AC-053: Móvil y objetivos táctiles — no hay scroll horizontal y los controles interactivos miden ≥ 24×24 px CSS (WCAG 2.5.8) (TEST-A11Y-003)
- [ ] AC-054: Revisión con lector de pantalla — cada control tiene nombre accesible y los cambios de estado se anuncian; resultado registrado en el registro de tests (TEST-A11Y-004)

## Technical Notes

La accesibilidad se trabaja en cada historia de UI; esta historia cierra la auditoría completa.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
