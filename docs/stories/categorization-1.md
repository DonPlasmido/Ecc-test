# Story: Categorizar por reglas «contiene»

**ID:** categorization-1
**Epic:** categorization
**Sprint:** 4
**Status:** todo
**Points:** 3

## Context

Como usuario quiero que los movimientos se categoricen solos según su concepto para no hacerlo uno a uno. Contribuye a la épica «Categorización por reglas» (F2).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-015: Regla «concepto contiene» insensible a mayúsculas y tildes — los dos primeros se categorizan (Supermercado, Ocio); `MERCADO CENTRAL` queda «Sin categoría» (TEST-CAT-001)
- [ ] AC-017: Aplicación automática al importar — cada movimiento queda con la categoría de la primera regla coincidente o «Sin categoría» (TEST-CAT-003)

## Technical Notes

Depende de import-statements-1.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
