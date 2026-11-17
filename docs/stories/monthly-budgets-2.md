# Story: Calcular estado del presupuesto

**ID:** monthly-budgets-2
**Epic:** monthly-budgets
**Sprint:** 5
**Status:** todo
**Points:** 2

## Context

Como usuario quiero saber si voy bien, cerca o por encima del límite para reaccionar a tiempo. Contribuye a la épica «Presupuestos mensuales» (F3).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-022: Umbrales de estado — estados `ok` / `cerca` / `cerca` / `superado` (ok < 80 %, cerca 80–100 % inclusive, superado > 100 %) (TEST-BUD-002)
- [ ] AC-023: Cálculo del gasto mensual — 130,00 € (neto de devoluciones, mínimo 0, por fecha de operación y mes natural) (TEST-BUD-003)

## Technical Notes

Umbral del 80 % pendiente de confirmar (D3).

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
