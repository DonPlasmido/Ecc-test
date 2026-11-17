# Story: Importar CSV de bancos españoles

**ID:** import-statements-2
**Epic:** import-statements
**Sprint:** 2
**Status:** todo
**Points:** 5

## Context

Como usuario quiero importar el CSV de mi banco tal cual lo descargo para no tener que editarlo. Contribuye a la épica «Importación de extractos bancarios» (F1).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-001: CSV español básico se importa con importes en céntimos — se guardan exactamente 3 movimientos; el primero con `date = 2026-01-05`, `amountCents = -4510`, `balanceCents = 195490` y concepto literal; tras recargar la página siguen ahí (TEST-IMP-001)
- [ ] AC-002: Normalización de importes y fechas en los límites — `1.234.567,89 → 123456789`, `-0,01 → -1`, `+12,00 → 1200`, `12 → 1200`, `12,30- → -1230` (signo final), `1/2/2026 → 2026-02-01`; `31/02/2026`, `2026/13/01`, `abc` y `1,2,3` se rechazan con motivo (TEST-IMP-002)
- [ ] AC-003: Codificaciones UTF-8 con BOM y Windows-1252 — ambas producen movimientos idénticos y la cabecera se reconoce; no aparece mojibake (`Ã©`, `�`) (TEST-IMP-003)
- [ ] AC-008: Filas inválidas informadas y excluidas — el resumen muestra «8 válidas, 2 con errores» con número de línea y motivo; solo se guardan 8 (TEST-IMP-008)

## Technical Notes

Depende de import-statements-1. papaparse con `delimiter: ';'`.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
