# Story: PWA instalable y offline

**ID:** app-platform-1
**Epic:** app-platform
**Sprint:** 8
**Status:** todo
**Points:** 5

## Context

Como usuario quiero instalar la app en el móvil y usarla sin conexión para consultarla en cualquier lugar. Contribuye a la épica «Plataforma: PWA accesible, offline y con temas» (F8).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-048: Instalable — incluye `name`, `short_name`, iconos 192 y 512 px (uno `maskable`), `start_url` y `scope` `/Ecc-test/`, `display: standalone`; hay service worker registrado (TEST-PWA-002)
- [ ] AC-049: Funciona sin conexión — la app carga, muestra los datos guardados y la importación funciona (TEST-PWA-003)

## Technical Notes

vite-plugin-pwa.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
