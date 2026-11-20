# Story: Lista virtualizada de movimientos

**ID:** transaction-list-1
**Epic:** transaction-list
**Sprint:** 3
**Status:** todo
**Points:** 5

## Context

Como usuario quiero desplazarme por todos mis movimientos sin bloqueos aunque tenga 100.000 para revisarlos con comodidad. Contribuye a la épica «Lista de movimientos» (F5).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-031: Lista virtualizada con 100.000 movimientos — el DOM contiene ≤ 100 filas `[role=row]` en todo momento y el último movimiento es visible al final del scroll (TEST-LIST-001)

## Technical Notes

Depende de import-statements-1. Generador de datos sintéticos con semilla compartido con transaction-list-4.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
