# Story: Persistir movimientos en IndexedDB

**ID:** import-statements-1
**Epic:** import-statements
**Sprint:** 1
**Status:** todo
**Points:** 3

## Context

Como usuario quiero que mis movimientos se guarden en el dispositivo para no perderlos al cerrar la app. Contribuye a la épica «Importación de extractos bancarios» (F1).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-001: CSV español básico se importa con importes en céntimos — se guardan exactamente 3 movimientos; el primero con `date = 2026-01-05`, `amountCents = -4510`, `balanceCents = 195490` y concepto literal; tras recargar la página siguen ahí (TEST-IMP-001)
- [ ] AC-009: Importación atómica ante fallo de escritura — la BD sigue con exactamente los 50 movimientos previos y se muestra un error comprensible (TEST-IMP-009)

## Technical Notes

Base de las demás historias. Repositorio con `idb`; importes en céntimos enteros; escritura en una única transacción.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
