# Story: Detectar duplicados al reimportar

**ID:** import-statements-5
**Epic:** import-statements
**Sprint:** 3
**Status:** todo
**Points:** 5

## Context

Como usuario quiero reimportar extractos solapados sin duplicar movimientos para mantener los totales fiables. Contribuye a la épica «Importación de extractos bancarios» (F1).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-010: Reimportación exacta no duplica — resumen «0 nuevos, 50 duplicados omitidos»; el total sigue siendo 50 (TEST-IMP-010)
- [ ] AC-011: Solape parcial entre extractos — se insertan 25 y se omiten 20; total 75 (TEST-IMP-011)
- [ ] AC-012: Movimientos legítimos idénticos se cuentan como multiconjunto — 1.ª importación: 2 nuevos; reimportación: 0 nuevos; archivo con 3 copias: 1 nuevo. Clave = fecha + importe en céntimos + concepto normalizado (trim, espacios colapsados, mayúsculas, sin tildes) + saldo si existe (TEST-IMP-012)
- [ ] AC-013: Revisar y forzar duplicados omitidos — solo ese movimiento se añade (TEST-IMP-013)
- [ ] AC-014: Rendimiento de importación de 100.000 filas — media ≤ 2.000 ms en el runner de CI; la UI muestra progreso durante la importación real (TEST-IMP-014)

## Technical Notes

Clave de deduplicación pendiente de confirmar (ver decisión D1 en acceptance-criteria.md).

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
