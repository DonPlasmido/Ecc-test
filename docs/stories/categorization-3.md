# Story: Proponer regla al recategorizar

**ID:** categorization-3
**Epic:** categorization
**Sprint:** 5
**Status:** todo
**Points:** 3

## Context

Como usuario quiero que al corregir una categoría se me proponga una regla para que la app aprenda. Contribuye a la épica «Categorización por reglas» (F2).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-018: Categoría manual protegida — conserva «Regalos» (TEST-CAT-004)
- [ ] AC-019: Propuesta de regla al recategorizar — se propone una regla editable `contiene NETFLIX.COM → Ocio`; al aceptar se crea y se ofrece aplicarla a «5 movimientos más»; al rechazar no se crea nada (TEST-CAT-005)

## Technical Notes

Depende de categorization-1 y transaction-list-3.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
