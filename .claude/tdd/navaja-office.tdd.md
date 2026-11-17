# Evidencias TDD: Navaja Office

**Plan de origen**: plan aprobado en la conversación (`/plan`), fases 0–4. No hay `*.plan.md`.
**Gestor de paquetes**: npm (los scripts de ECC no están instalados; se usó el valor por defecto).
**Runner**: Vitest (`npm test`, `npm run test:coverage`) + Playwright (`npm run e2e`).

## Historias de usuario
1. Como persona con un Excel desordenado, quiero quitar duplicados, filas vacías y espacios, para tener datos limpios.
2. Como persona con varios Excel parecidos, quiero juntarlos en uno aunque las columnas estén en otro orden.
3. Como persona con una hoja de datos, quiero ver total, media, mínimo y máximo y un gráfico por grupos.
4. Como persona que envía cartas o facturas, quiero crear un Word por cada fila de un Excel a partir de una plantilla.

## RED → GREEN por fase

| Fase | RED (commit) | Evidencia RED | GREEN (commit) | Evidencia GREEN |
|---|---|---|---|---|
| 1 Limpiar | `5bdfab5` | 3 suites no encuentran `src/core/clean`, `src/core/files`, `src/io/excel` | `52ec465` | 27/27 |
| 2 Juntar | `ace9c04` | no encuentra `src/core/merge` | `d9b0d01` | 34/34 |
| 3 Resumen | `d6799b2` | no encuentra `src/core/summary` | `5f367dc` | 56/56 |
| 4 Word | `f9da67f` | no encuentra `src/io/word` | `fcedcd5` | 68/68 |
| Revisión | `017aba2` | `RangeError: Maximum call stack size exceeded`; cabecera «Origen» duplicada | `07bd4b7` | 70/70 |

## Qué garantizan las pruebas

| # | Garantía | Prueba | Tipo |
|---|---|---|---|
| 1 | Quita filas vacías y duplicadas, conserva la primera, no confunde 1 con "1", no muta la entrada | `tests/clean.test.ts` | unit |
| 2 | Rechaza .xls/.doc/vacíos/>15 MB con mensaje claro; avisa de que las macros de .xlsm se pierden | `tests/files.test.ts` | unit |
| 3 | Lee hojas, fórmulas (resultado guardado), enlaces, texto enriquecido y fechas; ida y vuelta exacta | `tests/excel.test.ts` | integración |
| 4 | Junta tablas emparejando columnas por nombre, deja huecos y avisa | `tests/merge.test.ts` | unit |
| 5 | Interpreta números en formato español; resumen y totales por grupo con «Otros»; 300.000 filas sin fallo | `tests/summary.test.ts` | unit |
| 6 | Rellena plantillas, nombra archivos sin repetir, avisa de columnas que faltan y de llaves mal cerradas | `tests/word.test.ts` | integración |
| 7 | Los 4 flujos completos funcionan en Chromium emulando un Android (Pixel 7) | `e2e/*.spec.ts` | E2E |

## Cobertura y huecos conocidos
- `npm run test:coverage`: 96,4 % sentencias, 89,4 % ramas, 98,6 % funciones (mínimo exigido: 80 %).
- La cobertura mide `src/core` y `src/io`. La interfaz (`src/ui`) se cubre con las 8 pruebas E2E, no con cobertura de líneas.
- No se ha probado en un móvil físico, solo en emulación de Chromium.
