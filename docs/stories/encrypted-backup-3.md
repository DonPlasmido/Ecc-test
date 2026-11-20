# Story: Rechazar copias inválidas

**ID:** encrypted-backup-3
**Epic:** encrypted-backup
**Sprint:** 7
**Status:** todo
**Points:** 3

## Context

Como usuario quiero que una contraseña errónea o un archivo dañado no toquen mis datos para no perder información. Contribuye a la épica «Copia de seguridad cifrada» (F6).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-039: Contraseña incorrecta — mensaje «Contraseña incorrecta o archivo dañado»; la BD queda idéntica a su instantánea previa (TEST-BAK-004)
- [ ] AC-040: Archivo manipulado o versión incompatible — los tres casos se rechazan (fallo de autenticación GCM / «versión no compatible» / «archivo dañado») y la BD no cambia (TEST-BAK-005)

## Technical Notes

Depende de encrypted-backup-2.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
