# TESTS.md — Activos de test y puntos de test requeridos

> Este registro responde: ¿qué tests existen?, ¿qué reglas requieren protección?, ¿dónde está la evidencia?
> Fuente de los criterios: `docs/acceptance-criteria.md` (no se copian aquí). Historias: `docs/stories/`.
> Estado de todos los TEST-IDs: **pendiente** (equivale a `missing` en la skill `test-collaboration`): aún no existe código ni evidencia.

## 1. Puntos de entrada de test

Previstos; ninguno existe todavía (no hay `package.json`). Se confirmarán al crear el proyecto.

| Grupo de ejecución | Comando previsto | Cuándo ejecutar | Dependencias externas |
|---|---|---|---|
| tests por defecto | `npm test` (Vitest + jsdom + fake-indexeddb) | Antes de cada commit / CI | Ninguna |
| cobertura | `npm run test:coverage` (umbral 80 %) | CI | Ninguna |
| benchmark | `npm run bench` (tinybench, falla si se supera el umbral) | CI y cambios en filtrado/importación | Ninguna; datos sintéticos con semilla |
| E2E especializado | `npm run e2e` (Playwright, perfil Pixel 7, contra `vite preview` con base `/Ecc-test/`) | Pre-release y CI | Navegador Playwright |
| accesibilidad | `npm run e2e -- --grep @a11y` (@axe-core/playwright) | Cambios de UI y pre-release | Navegador Playwright |
| manual | Revisión con lector de pantalla (§5) | Pre-release | Persona + TalkBack/NVDA |

## 2. Mapa de activos de test

Niveles controlados: `unit`, `integration`, `contract`, `E2E`, `smoke`. Propósitos: `rule protection`, `critical path`, `regression protection`, `specialized protection`.

| Módulo o flujo | Nivel | Propósito | Grupo | Dependencias externas | Ubicación prevista | Evaluación |
|---|---|---|---|---|---|---|
| Importación (parser, normalizador, detector de columnas, deduplicación) | unit, integration | rule protection, critical path | tests por defecto | ninguna | `src/features/import/**/*.test.ts` | missing |
| Categorización (motor de reglas) | unit, integration | rule protection | tests por defecto | ninguna | `src/features/categorization/**/*.test.ts` | missing |
| Presupuestos | unit, integration | rule protection | tests por defecto | ninguna | `src/features/budgets/**/*.test.ts` | missing |
| Panel (agregaciones) | unit | rule protection | tests por defecto | ninguna | `src/features/dashboard/**/*.test.ts` | missing |
| Lista de movimientos (filtro, edición) | unit, integration, E2E | rule protection, specialized protection | tests por defecto / benchmark / E2E | ninguna | `src/features/transactions/**`, `bench/`, `e2e/` | missing |
| Copia cifrada | integration, contract | rule protection, critical path | tests por defecto | WebCrypto real | `src/features/backup/**/*.test.ts` | missing |
| i18n | unit, E2E | rule protection, critical path | tests por defecto / E2E | ninguna | `src/i18n/**/*.test.ts`, `e2e/` | missing |
| PWA, offline, tema, despliegue, privacidad | smoke, E2E | critical path | E2E especializado | navegador | `e2e/` | missing |
| Accesibilidad | E2E + manual | rule protection, critical path | accesibilidad / manual | navegador, lector de pantalla | `e2e/a11y/` | missing |

Recuento: 55 criterios obligatorios/importantes/opcionales con TEST-ID; 0 activos existentes; 0 posibles duplicados; 0 posibles obsoletos.

## 3. Evidencia de contrato entre fronteras

La app no tiene API cliente/servidor. La única frontera de contrato es el **archivo de copia `.ccbackup` v1** (lo produce una versión de la app y lo consume otra).

| Frontera | Fuente única del contrato | Validación del contrato | Evidencia productor | Evidencia consumidor | Evidencia de integración | Evaluación |
|---|---|---|---|---|---|---|
| Archivo `.ccbackup` v1 | `src/features/backup/backup-format.schema.json` (por crear) | pendiente | TEST-BAK-001 (serialización real) | TEST-BAK-005 (lectura y rechazo de versión) | TEST-BAK-003 (ida y vuelta) | missing |

## 4. Puntos de test requeridos

Estado de todos: **pendiente**. Campos `Archivo`, `Nodo`, `Comando` y `Evidencia` se completarán al implementar cada historia.

### Importación

#### TEST-IMP-001 — CSV español básico se importa con importes en céntimos

- Estado: pendiente
- Propósito: rule protection, critical path
- Fuente: AC-001 (`docs/acceptance-criteria.md`) · historia `import-statements-1`, `import-statements-2`
- Entrada representativa: ver «Escenario» de AC-001
- Expectativa observable: ver «Esperado» de AC-001
- Nivel: unit, integration
- Grupo de ejecución: tests por defecto
- Frontera: parser y repositorio reales; IndexedDB con fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-002 — Normalización de importes y fechas en los límites

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-002 (`docs/acceptance-criteria.md`) · historia `import-statements-2`
- Entrada representativa: ver «Escenario» de AC-002
- Expectativa observable: ver «Esperado» de AC-002
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: función pura, sin E/S
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-003 — Codificaciones UTF-8 con BOM y Windows-1252

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-003 (`docs/acceptance-criteria.md`) · historia `import-statements-2`
- Entrada representativa: ver «Escenario» de AC-003
- Expectativa observable: ver «Esperado» de AC-003
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: fixtures binarios reales
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-004 — XLSX equivalente al CSV

- Estado: pendiente
- Propósito: rule protection, critical path
- Fuente: AC-004 (`docs/acceptance-criteria.md`) · historia `import-statements-3`
- Entrada representativa: ver «Escenario» de AC-004
- Expectativa observable: ver «Esperado» de AC-004
- Nivel: integration
- Grupo de ejecución: tests por defecto
- Frontera: exceljs real sobre fixture en disco
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-005 — Detección automática de columnas

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-005 (`docs/acceptance-criteria.md`) · historia `import-statements-4`
- Entrada representativa: ver «Escenario» de AC-005
- Expectativa observable: ver «Esperado» de AC-005
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: detector puro sobre filas ya leídas
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-006 — Vista previa y corrección manual sin escritura previa

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-006 (`docs/acceptance-criteria.md`) · historia `import-statements-4`
- Entrada representativa: ver «Escenario» de AC-006
- Expectativa observable: ver «Esperado» de AC-006
- Nivel: unit, E2E
- Grupo de ejecución: tests por defecto / E2E especializado
- Frontera: UI real; E2E con navegador real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-007 — Columnas obligatorias sin asignar

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-007 (`docs/acceptance-criteria.md`) · historia `import-statements-4`
- Entrada representativa: ver «Escenario» de AC-007
- Expectativa observable: ver «Esperado» de AC-007
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: UI real, sin persistencia
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-008 — Filas inválidas informadas y excluidas

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-008 (`docs/acceptance-criteria.md`) · historia `import-statements-2`
- Entrada representativa: ver «Escenario» de AC-008
- Expectativa observable: ver «Esperado» de AC-008
- Nivel: integration
- Grupo de ejecución: tests por defecto
- Frontera: fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-009 — Importación atómica ante fallo de escritura

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-009 (`docs/acceptance-criteria.md`) · historia `import-statements-1`
- Entrada representativa: ver «Escenario» de AC-009
- Expectativa observable: ver «Esperado» de AC-009
- Nivel: integration
- Grupo de ejecución: tests por defecto
- Frontera: fake-indexeddb con fallo inyectado
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-010 — Reimportación exacta no duplica

- Estado: pendiente
- Propósito: rule protection, regression protection
- Fuente: AC-010 (`docs/acceptance-criteria.md`) · historia `import-statements-5`
- Entrada representativa: ver «Escenario» de AC-010
- Expectativa observable: ver «Esperado» de AC-010
- Nivel: integration
- Grupo de ejecución: tests por defecto
- Frontera: fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-011 — Solape parcial entre extractos

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-011 (`docs/acceptance-criteria.md`) · historia `import-statements-5`
- Entrada representativa: ver «Escenario» de AC-011
- Expectativa observable: ver «Esperado» de AC-011
- Nivel: integration
- Grupo de ejecución: tests por defecto
- Frontera: fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-012 — Movimientos legítimos idénticos se cuentan como multiconjunto

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-012 (`docs/acceptance-criteria.md`) · historia `import-statements-5`
- Entrada representativa: ver «Escenario» de AC-012
- Expectativa observable: ver «Esperado» de AC-012
- Nivel: unit, integration
- Grupo de ejecución: tests por defecto
- Frontera: fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-013 — Revisar y forzar duplicados omitidos

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-013 (`docs/acceptance-criteria.md`) · historia `import-statements-5`
- Entrada representativa: ver «Escenario» de AC-013
- Expectativa observable: ver «Esperado» de AC-013
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: UI real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-IMP-014 — Rendimiento de importación de 100.000 filas

- Estado: pendiente
- Propósito: specialized protection
- Fuente: AC-014 (`docs/acceptance-criteria.md`) · historia `import-statements-5`, `transaction-list-4`
- Entrada representativa: ver «Escenario» de AC-014
- Expectativa observable: ver «Esperado» de AC-014
- Nivel: unit
- Grupo de ejecución: benchmark
- Frontera: datos sintéticos en memoria, sin IndexedDB
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

### Categorización

#### TEST-CAT-001 — Regla «concepto contiene» insensible a mayúsculas y tildes

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-015 (`docs/acceptance-criteria.md`) · historia `categorization-1`
- Entrada representativa: ver «Escenario» de AC-015
- Expectativa observable: ver «Esperado» de AC-015
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: motor de reglas puro
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-CAT-002 — Prioridad determinista

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-016 (`docs/acceptance-criteria.md`) · historia `categorization-2`
- Entrada representativa: ver «Escenario» de AC-016
- Expectativa observable: ver «Esperado» de AC-016
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: motor de reglas puro
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-CAT-003 — Aplicación automática al importar

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-017 (`docs/acceptance-criteria.md`) · historia `categorization-1`
- Entrada representativa: ver «Escenario» de AC-017
- Expectativa observable: ver «Esperado» de AC-017
- Nivel: integration
- Grupo de ejecución: tests por defecto
- Frontera: fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-CAT-004 — Categoría manual protegida

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-018 (`docs/acceptance-criteria.md`) · historia `categorization-3`
- Entrada representativa: ver «Escenario» de AC-018
- Expectativa observable: ver «Esperado» de AC-018
- Nivel: integration
- Grupo de ejecución: tests por defecto
- Frontera: fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-CAT-005 — Propuesta de regla al recategorizar

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-019 (`docs/acceptance-criteria.md`) · historia `categorization-3`
- Entrada representativa: ver «Escenario» de AC-019
- Expectativa observable: ver «Esperado» de AC-019
- Nivel: unit, E2E
- Grupo de ejecución: tests por defecto / E2E especializado
- Frontera: UI real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-CAT-006 — Validación de reglas y categorías

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-020 (`docs/acceptance-criteria.md`) · historia `categorization-4`
- Entrada representativa: ver «Escenario» de AC-020
- Expectativa observable: ver «Esperado» de AC-020
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: validación pura + UI
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

### Presupuestos

#### TEST-BUD-001 — Definir presupuesto mensual

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-021 (`docs/acceptance-criteria.md`) · historia `monthly-budgets-1`
- Entrada representativa: ver «Escenario» de AC-021
- Expectativa observable: ver «Esperado» de AC-021
- Nivel: unit, integration
- Grupo de ejecución: tests por defecto
- Frontera: fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-BUD-002 — Umbrales de estado

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-022 (`docs/acceptance-criteria.md`) · historia `monthly-budgets-2`
- Entrada representativa: ver «Escenario» de AC-022
- Expectativa observable: ver «Esperado» de AC-022
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: función pura
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-BUD-003 — Cálculo del gasto mensual

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-023 (`docs/acceptance-criteria.md`) · historia `monthly-budgets-2`
- Entrada representativa: ver «Escenario» de AC-023
- Expectativa observable: ver «Esperado» de AC-023
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: función pura
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-BUD-004 — Estado visible sin depender del color

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-024 (`docs/acceptance-criteria.md`) · historia `monthly-budgets-3`
- Entrada representativa: ver «Escenario» de AC-024
- Expectativa observable: ver «Esperado» de AC-024
- Nivel: unit, E2E
- Grupo de ejecución: tests por defecto / accesibilidad
- Frontera: UI real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

### Panel

#### TEST-DASH-001 — Gasto por categoría del mes

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-025 (`docs/acceptance-criteria.md`) · historia `dashboard-1`
- Entrada representativa: ver «Escenario» de AC-025
- Expectativa observable: ver «Esperado» de AC-025
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: agregación pura
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-DASH-002 — Evolución de 12 meses

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-026 (`docs/acceptance-criteria.md`) · historia `dashboard-2`
- Entrada representativa: ver «Escenario» de AC-026
- Expectativa observable: ver «Esperado» de AC-026
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: agregación pura
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-DASH-003 — Ingresos frente a gastos

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-027 (`docs/acceptance-criteria.md`) · historia `dashboard-3`
- Entrada representativa: ver «Escenario» de AC-027
- Expectativa observable: ver «Esperado» de AC-027
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: agregación pura
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-DASH-004 — Saldo

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-028 (`docs/acceptance-criteria.md`) · historia `dashboard-4`
- Entrada representativa: ver «Escenario» de AC-028
- Expectativa observable: ver «Esperado» de AC-028
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: función pura
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-DASH-005 — Alternativa accesible de cada gráfico

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-029 (`docs/acceptance-criteria.md`) · historia `dashboard-1`
- Entrada representativa: ver «Escenario» de AC-029
- Expectativa observable: ver «Esperado» de AC-029
- Nivel: unit, E2E
- Grupo de ejecución: tests por defecto / accesibilidad
- Frontera: UI real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-DASH-006 — Panel vacío

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-030 (`docs/acceptance-criteria.md`) · historia `dashboard-1`
- Entrada representativa: ver «Escenario» de AC-030
- Expectativa observable: ver «Esperado» de AC-030
- Nivel: E2E
- Grupo de ejecución: E2E especializado
- Frontera: navegador real, BD vacía
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

### Lista de movimientos

#### TEST-LIST-001 — Lista virtualizada con 100.000 movimientos

- Estado: pendiente
- Propósito: specialized protection, critical path
- Fuente: AC-031 (`docs/acceptance-criteria.md`) · historia `transaction-list-1`
- Entrada representativa: ver «Escenario» de AC-031
- Expectativa observable: ver «Esperado» de AC-031
- Nivel: E2E
- Grupo de ejecución: E2E especializado
- Frontera: navegador real, datos sembrados
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-LIST-002 — Benchmark de filtrado de 100.000 movimientos

- Estado: pendiente
- Propósito: specialized protection
- Fuente: AC-032 (`docs/acceptance-criteria.md`) · historia `transaction-list-4`
- Entrada representativa: ver «Escenario» de AC-032
- Expectativa observable: ver «Esperado» de AC-032
- Nivel: unit
- Grupo de ejecución: benchmark
- Frontera: función pura en memoria
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-LIST-003 — Respuesta de la UI al buscar

- Estado: pendiente
- Propósito: specialized protection
- Fuente: AC-033 (`docs/acceptance-criteria.md`) · historia `transaction-list-2`
- Entrada representativa: ver «Escenario» de AC-033
- Expectativa observable: ver «Esperado» de AC-033
- Nivel: E2E
- Grupo de ejecución: E2E especializado
- Frontera: navegador real; umbral sensible al hardware
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-LIST-004 — Búsqueda y filtros combinables

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-034 (`docs/acceptance-criteria.md`) · historia `transaction-list-2`
- Entrada representativa: ver «Escenario» de AC-034
- Expectativa observable: ver «Esperado» de AC-034
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: función pura + UI
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-LIST-005 — Edición de movimiento

- Estado: pendiente
- Propósito: critical path, rule protection
- Fuente: AC-035 (`docs/acceptance-criteria.md`) · historia `transaction-list-3`
- Entrada representativa: ver «Escenario» de AC-035
- Expectativa observable: ver «Esperado» de AC-035
- Nivel: integration, E2E
- Grupo de ejecución: tests por defecto / E2E especializado
- Frontera: fake-indexeddb y navegador real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

### Copia cifrada

#### TEST-BAK-001 — Formato de exportación cifrada

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-036 (`docs/acceptance-criteria.md`) · historia `encrypted-backup-1`
- Entrada representativa: ver «Escenario» de AC-036
- Expectativa observable: ver «Esperado» de AC-036
- Nivel: integration, contract
- Grupo de ejecución: tests por defecto
- Frontera: WebCrypto real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-BAK-002 — Sin texto plano y sin reutilizar sal/IV

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-037 (`docs/acceptance-criteria.md`) · historia `encrypted-backup-1`
- Entrada representativa: ver «Escenario» de AC-037
- Expectativa observable: ver «Esperado» de AC-037
- Nivel: integration
- Grupo de ejecución: tests por defecto
- Frontera: WebCrypto real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-BAK-003 — Ida y vuelta completa

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-038 (`docs/acceptance-criteria.md`) · historia `encrypted-backup-2`
- Entrada representativa: ver «Escenario» de AC-038
- Expectativa observable: ver «Esperado» de AC-038
- Nivel: integration
- Grupo de ejecución: tests por defecto
- Frontera: WebCrypto real + fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-BAK-004 — Contraseña incorrecta

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-039 (`docs/acceptance-criteria.md`) · historia `encrypted-backup-3`
- Entrada representativa: ver «Escenario» de AC-039
- Expectativa observable: ver «Esperado» de AC-039
- Nivel: integration
- Grupo de ejecución: tests por defecto
- Frontera: WebCrypto real + fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-BAK-005 — Archivo manipulado o versión incompatible

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-040 (`docs/acceptance-criteria.md`) · historia `encrypted-backup-3`
- Entrada representativa: ver «Escenario» de AC-040
- Expectativa observable: ver «Esperado» de AC-040
- Nivel: integration, contract
- Grupo de ejecución: tests por defecto
- Frontera: WebCrypto real + fake-indexeddb
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-BAK-006 — Restauración confirmada y atómica

- Estado: pendiente
- Propósito: rule protection, critical path
- Fuente: AC-041 (`docs/acceptance-criteria.md`) · historia `encrypted-backup-2`
- Entrada representativa: ver «Escenario» de AC-041
- Expectativa observable: ver «Esperado» de AC-041
- Nivel: integration, unit
- Grupo de ejecución: tests por defecto
- Frontera: fake-indexeddb con fallo inyectado
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-BAK-007 — Contraseña: validación y no persistencia

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-042 (`docs/acceptance-criteria.md`) · historia `encrypted-backup-1`
- Entrada representativa: ver «Escenario» de AC-042
- Expectativa observable: ver «Esperado» de AC-042
- Nivel: unit, E2E
- Grupo de ejecución: tests por defecto / E2E especializado
- Frontera: UI real y almacenamiento real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-BAK-008 — Solo WebCrypto

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-043 (`docs/acceptance-criteria.md`) · historia `encrypted-backup-1`
- Entrada representativa: ver «Escenario» de AC-043
- Expectativa observable: ver «Esperado» de AC-043
- Nivel: smoke
- Grupo de ejecución: tests por defecto
- Frontera: lectura estática de package.json
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

### Idiomas

#### TEST-I18N-001 — Español por defecto y cambio persistente a inglés

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-044 (`docs/acceptance-criteria.md`) · historia `i18n-1`, `i18n-2`
- Entrada representativa: ver «Escenario» de AC-044
- Expectativa observable: ver «Esperado» de AC-044
- Nivel: E2E
- Grupo de ejecución: E2E especializado
- Frontera: navegador real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-I18N-002 — Claves completas en ambos idiomas

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-045 (`docs/acceptance-criteria.md`) · historia `i18n-1`, `i18n-2`
- Entrada representativa: ver «Escenario» de AC-045
- Expectativa observable: ver «Esperado» de AC-045
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: lectura de JSON
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-I18N-003 — Formatos locales de fecha e importe

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-046 (`docs/acceptance-criteria.md`) · historia `i18n-3`
- Entrada representativa: ver «Escenario» de AC-046
- Expectativa observable: ver «Esperado» de AC-046
- Nivel: unit
- Grupo de ejecución: tests por defecto
- Frontera: Intl real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

### Plataforma PWA

#### TEST-PWA-001 — Despliegue bajo `/Ecc-test/`

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-047 (`docs/acceptance-criteria.md`) · historia `app-platform-4`
- Entrada representativa: ver «Escenario» de AC-047
- Expectativa observable: ver «Esperado» de AC-047
- Nivel: smoke
- Grupo de ejecución: E2E especializado
- Frontera: build real servido localmente
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-PWA-002 — Instalable

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-048 (`docs/acceptance-criteria.md`) · historia `app-platform-1`
- Entrada representativa: ver «Escenario» de AC-048
- Expectativa observable: ver «Esperado» de AC-048
- Nivel: E2E
- Grupo de ejecución: E2E especializado
- Frontera: navegador real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-PWA-003 — Funciona sin conexión

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-049 (`docs/acceptance-criteria.md`) · historia `app-platform-1`
- Entrada representativa: ver «Escenario» de AC-049
- Expectativa observable: ver «Esperado» de AC-049
- Nivel: E2E
- Grupo de ejecución: E2E especializado
- Frontera: navegador real, red desactivada
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-PWA-004 — Modo claro/oscuro/sistema

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-050 (`docs/acceptance-criteria.md`) · historia `app-platform-2`
- Entrada representativa: ver «Escenario» de AC-050
- Expectativa observable: ver «Esperado» de AC-050
- Nivel: E2E
- Grupo de ejecución: E2E especializado
- Frontera: navegador real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

### Accesibilidad

#### TEST-A11Y-001 — Sin violaciones axe WCAG 2.2 A/AA

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-051 (`docs/acceptance-criteria.md`) · historia `app-platform-3`
- Entrada representativa: ver «Escenario» de AC-051
- Expectativa observable: ver «Esperado» de AC-051
- Nivel: E2E
- Grupo de ejecución: accesibilidad
- Frontera: navegador real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-A11Y-002 — Flujo completo con teclado

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-052 (`docs/acceptance-criteria.md`) · historia `app-platform-3`
- Entrada representativa: ver «Escenario» de AC-052
- Expectativa observable: ver «Esperado» de AC-052
- Nivel: E2E
- Grupo de ejecución: accesibilidad
- Frontera: navegador real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-A11Y-003 — Móvil y objetivos táctiles

- Estado: pendiente
- Propósito: rule protection
- Fuente: AC-053 (`docs/acceptance-criteria.md`) · historia `app-platform-3`
- Entrada representativa: ver «Escenario» de AC-053
- Expectativa observable: ver «Esperado» de AC-053
- Nivel: E2E
- Grupo de ejecución: accesibilidad
- Frontera: navegador real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

#### TEST-A11Y-004 — Revisión con lector de pantalla

- Estado: pendiente
- Propósito: critical path
- Fuente: AC-054 (`docs/acceptance-criteria.md`) · historia `app-platform-3`
- Entrada representativa: ver «Escenario» de AC-054
- Expectativa observable: ver «Esperado» de AC-054
- Nivel: manual
- Grupo de ejecución: manual
- Frontera: lector de pantalla real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

### Plataforma PWA

#### TEST-PWA-005 — Ningún dato sale del navegador

- Estado: pendiente
- Propósito: rule protection, critical path
- Fuente: AC-055 (`docs/acceptance-criteria.md`) · historia `app-platform-4`
- Entrada representativa: ver «Escenario» de AC-055
- Expectativa observable: ver «Esperado» de AC-055
- Nivel: E2E
- Grupo de ejecución: E2E especializado
- Frontera: navegador real
- Archivo: pendiente · Nodo: pendiente · Comando: pendiente
- Evidencia: pendiente

## 5. Salidas de verificación manual

| Fuente | Por qué no se automatiza | Pasos manuales | Evidencia de aprobación | Responsable |
|---|---|---|---|---|
| AC-054 / TEST-A11Y-004 | axe no evalúa la calidad de los anuncios ni el orden de lectura percibido | Recorrer importar, lista, panel y copia con TalkBack (Pixel) y NVDA (escritorio) | Acta con fecha, versión, lector y hallazgos | pendiente |
| AC-052 / TEST-A11Y-002 (complemento) | La visibilidad del foco requiere juicio humano además del E2E | Recorrido con teclado en tema claro y oscuro | Capturas + acta | pendiente |

## 6. Huecos actuales y acciones

| Prioridad | TEST-ID o activo | Hueco | Siguiente acción | Estado |
|---|---|---|---|---|
| P0 | Todos | No existe proyecto ni runner | Crear `package.json`, Vitest, Playwright y `npm run bench` (sprint 1) | pendiente |
| P0 | TEST-IMP-010…012 | Clave de deduplicación sin confirmar (D1) | Confirmar D1 antes del sprint 3 | pendiente |
| P0 | TEST-LIST-002 | Umbral de benchmark sin validar en el runner real | Medir línea base en CI en el sprint 3 y registrar valor | pendiente |
| P1 | TEST-BAK-001…008 | Modo de restauración sin confirmar (D2); falta esquema del formato | Confirmar D2 y crear `backup-format.schema.json` | pendiente |
| P1 | TEST-PWA-005 | Privacidad debe ampliarse en cada sprint | Añadir cada flujo nuevo al recorrido E2E | pendiente |

## 7. Disparadores de mantenimiento

- Cambian directorios de test, configuración, CI o comandos estándar: reescanear el área afectada.
- Se añade o revisa un criterio `AC-NNN` o un bug: crear o enlazar un TEST-ID.
- Cambia el formato `.ccbackup`: revalidar contrato y ejecutar TEST-BAK-001, -003 y -005.
- Antes de pasar una historia a `review`: completar archivo, nodo, comando, código de salida y evidencia de sus TEST-IDs.
