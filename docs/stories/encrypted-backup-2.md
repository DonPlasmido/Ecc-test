# Story: Restaurar copia cifrada

**ID:** encrypted-backup-2
**Epic:** encrypted-backup
**Sprint:** 7
**Status:** todo
**Points:** 5

## Context

Como usuario quiero restaurar una copia en otro dispositivo para recuperar mis datos. Contribuye a la épica «Copia de seguridad cifrada» (F6).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-038: Ida y vuelta completa — todas las tablas son iguales (deep-equal) a las originales (TEST-BAK-003)
- [ ] AC-041: Restauración confirmada y atómica — antes de reemplazar se muestra un resumen (nº de movimientos, reglas, presupuestos, fecha de la copia) y se pide confirmación; con el fallo, los datos previos quedan intactos (TEST-BAK-006)

## Technical Notes

Depende de encrypted-backup-1. Modo reemplazo vs. fusión pendiente (D2).

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
