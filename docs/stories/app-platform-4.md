# Story: Despliegue en GitHub Pages y privacidad

**ID:** app-platform-4
**Epic:** app-platform
**Sprint:** 1
**Status:** todo
**Points:** 2

## Context

Como usuario quiero acceder a la app en su URL pública sabiendo que mis datos no salen del navegador para confiar en ella. Contribuye a la épica «Plataforma: PWA accesible, offline y con temas» (F8).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-047: Despliegue bajo `/Ecc-test/` — ninguna petición de recurso devuelve 404 y el enrutado funciona al recargar en una ruta profunda (TEST-PWA-001)
- [ ] AC-055: Ningún dato sale del navegador — 0 peticiones a orígenes distintos del de la app y ninguna petición con datos de movimientos en URL o cuerpo (TEST-PWA-005)

## Technical Notes

Base `/Ecc-test/`. El test de privacidad (AC-055) se amplía en cada sprint.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
