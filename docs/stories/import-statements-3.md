# Story: Importar XLSX

**ID:** import-statements-3
**Epic:** import-statements
**Sprint:** 2
**Status:** todo
**Points:** 3

## Context

Como usuario quiero importar el Excel de mi banco para usar el formato que me ofrece. Contribuye a la épica «Importación de extractos bancarios» (F1).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-004: XLSX equivalente al CSV — el resultado normalizado es igual (deep-equal) al del CSV equivalente; se usa la primera hoja con cabecera reconocible (TEST-IMP-004)

## Technical Notes

Depende de import-statements-2 (normalizador compartido). exceljs.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
