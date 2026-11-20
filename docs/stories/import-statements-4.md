# Story: Detectar columnas con vista previa y corrección manual

**ID:** import-statements-4
**Epic:** import-statements
**Sprint:** 2
**Status:** todo
**Points:** 5

## Context

Como usuario quiero revisar y corregir qué columna es cada dato antes de guardar para evitar importaciones erróneas. Contribuye a la épica «Importación de extractos bancarios» (F1).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-005: Detección automática de columnas — el mapeo propuesto coincide con el esperado en los 6 fixtures (6/6); con `Cargo`/`Abono` el cargo se convierte en importe negativo (TEST-IMP-005)
- [ ] AC-006: Vista previa y corrección manual sin escritura previa — la vista previa se actualiza antes de confirmar; tras cancelar, el número de movimientos en IndexedDB no cambia (TEST-IMP-006)
- [ ] AC-007: Columnas obligatorias sin asignar — el botón «Importar» está deshabilitado y un mensaje nombra la columna que falta (anunciado por `aria-live`) (TEST-IMP-007)

## Technical Notes

Depende de import-statements-2.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
