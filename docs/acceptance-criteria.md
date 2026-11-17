# Acceptance Brief: Cuentas Claras

**Status:** Draft
**Revision:** 1
**Prepared for:** equipo de desarrollo y agentes ECC que implementen las historias de `docs/stories/`
**Approval required before risky work:** Yes - las decisiones D1 (clave de deduplicación) y D2 (modo de restauración) afectan a pérdida o duplicación de datos y deben confirmarse antes de implementar `import-statements-5` y `encrypted-backup-2`.

Formato de cada criterio (skill `intent-driven-development`): **Escenario (Dado)**, **Acción (Cuando)**, **Esperado (Entonces)**, **No debe**, **Verificación**, **Prioridad**. Cada criterio enlaza a su historia (`docs/stories/`) y a su TEST-ID (`docs/TESTS.md`). Los IDs `AC-NNN` son estables: no se renumeran; un criterio que cambie se marca `[revised]`.

## Revision Log

| Rev | Date | Changed criteria | Reason |
| --- | --- | --- | --- |
| 1 | 2026-11-17 | — | Borrador inicial a partir de `docs/BRIEF.md` |

## Goal

Una persona puede importar sus extractos bancarios españoles, categorizarlos, presupuestar y analizar sus finanzas en el móvil, sin conexión y sin que ningún dato salga de su navegador.

## Scope

**In scope**
- Las 8 funcionalidades de `docs/BRIEF.md`: importación CSV/XLSX con deduplicación, categorización por reglas, presupuestos mensuales, panel, lista de movimientos (100.000), copia cifrada, idiomas es/en, accesibilidad + offline + temas.
- Publicación en GitHub Pages bajo `/Ecc-test/`.

**Out of scope**
- Backend, cuentas de usuario, sincronización entre dispositivos o en la nube.
- Conexión directa con bancos (PSD2/agregadores) y formatos OFX, QIF, Norma 43 o PDF.
- Multi-moneda (se asume EUR) y multi-cuenta consolidada.
- Recuperación de contraseña de la copia cifrada.

## Context

**Discovered facts** (verificados en el repositorio)
- El repositorio solo contiene `docs/BRIEF.md` y el kit ECC en `.claude/`; no hay código, tests, CI ni `package.json` todavía.
- El brief fija el stack: React 19 + TypeScript strict + Vite 8, Vitest 5, Playwright 1.63 (Pixel 7), IndexedDB (`idb`, `fake-indexeddb` en tests), WebCrypto, papaparse, exceljs, recharts, i18next, vite-plugin-pwa, tinybench, @axe-core/playwright.

**Product/business constraints** (del brief)
- Local-first, sin servidor; todo el procesamiento en el dispositivo.
- Formatos españoles: `;`, coma decimal, `dd/mm/aaaa`, cabeceras variables.
- Fluidez con 100.000 movimientos; WCAG 2.2 AA; español por defecto e inglés.
- Cifrado solo con WebCrypto. Dependencias publicadas hace ≥ 2 semanas.

**Assumptions** (a confirmar por el responsable de producto)
- A1. Moneda única EUR; importes almacenados como enteros en céntimos.
- A2. Codificaciones soportadas: UTF-8 (con/sin BOM) y Windows-1252.
- A3. Tamaño máximo de archivo de importación: 100.000 filas / 20 MB.
- A4. Umbral «cerca» del presupuesto: 80 %; el gasto se calcula neto de devoluciones dentro de la categoría.
- A5. Contraseña de copia: mínimo 8 caracteres; PBKDF2-SHA-256 con 600.000 iteraciones (recomendación OWASP vigente).
- A6. Umbrales de rendimiento medidos en el runner de CI `ubuntu-latest` (Node LTS); los umbrales E2E (AC-033) son orientativos porque Playwright no limita CPU al emular Pixel 7.
- A7. Saldo: se toma de la columna «Saldo» del extracto cuando existe; si no, se estima.

**Dependencies and constraints**
- GitHub Pages sirve estático: no hay cabeceras HTTP personalizadas ni reescrituras (enrutado SPA con fallback `404.html` o hash).
- Las APIs `crypto.subtle` e IndexedDB requieren contexto seguro (HTTPS o localhost).

## Risk Review

| Risk area | Applies? | Required handling |
| --- | --- | --- |
| Security/privacy | Yes | Solo WebCrypto (AC-036, AC-043); sin texto plano (AC-037); contraseña nunca persistida (AC-042); 0 peticiones a terceros (AC-055); revisión con `security-reviewer`. |
| Persistent data/migration | Yes | Importación y restauración atómicas (AC-009, AC-041); deduplicación (AC-010–AC-012); versión en el formato de copia (AC-040). |
| External effects/cost | No | Sin servicios externos; benchmarks y E2E en local/CI con datos sintéticos. |
| Compatibility/API | Yes | El formato `.ccbackup` v1 es un contrato de archivo: cambios futuros deben mantener la lectura de v1. |
| UX/accessibility | Yes | axe automático (AC-051), teclado (AC-052), objetivos táctiles (AC-053), revisión manual con lector de pantalla (AC-054). |
| Performance | Yes | Benchmark de filtrado 100k con umbral que falla CI (AC-032), importación 100k (AC-014), virtualización (AC-031). |

## Umbral de rendimiento elegido

| Medición | Condiciones | Umbral | Criterio |
| --- | --- | --- | --- |
| Filtrado combinado de 100.000 movimientos | tinybench, ≥ 30 iteraciones tras calentamiento, datos con semilla fija, CI `ubuntu-latest` | **p95 ≤ 50 ms**, media ≤ 25 ms | AC-032 |
| Filtrado + ordenación por fecha | igual | p95 ≤ 100 ms | AC-032 |
| Importar (parse + normalizar + deduplicar) 100.000 filas contra 100.000 existentes | tinybench | media ≤ 2.000 ms | AC-014 |
| Actualización de la lista al buscar | Playwright Pixel 7, 100k sembrados | ≤ 300 ms tras la última pulsación | AC-033 |
| Filas en el DOM | lista con 100k | ≤ 100 `[role=row]` | AC-031 |

## Acceptance Criteria

### F1 · Importación de extractos bancarios

#### AC-001: CSV español básico se importa con importes en céntimos
- **Escenario (Dado):** fixture sintético `bank-es-basic.csv` (UTF-8, separador `;`, cabecera `Fecha operación;Concepto;Importe;Saldo`, 3 filas, p. ej. `05/01/2026;COMPRA MERCADONA 123;-45,10;1.954,90`)
- **Acción (Cuando):** el usuario selecciona el archivo, acepta el mapeo propuesto y pulsa «Importar»
- **Esperado (Entonces):** se guardan exactamente 3 movimientos; el primero con `date = 2026-01-05`, `amountCents = -4510`, `balanceCents = 195490` y concepto literal; tras recargar la página siguen ahí
- **No debe:** interpretar `05/01` como 1 de mayo ni almacenar importes como coma flotante
- **Verificación:** unit (parser) + integration (parser → repositorio con fake-indexeddb)
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-1`, `import-statements-2` · **Tests:** `TEST-IMP-001`

#### AC-002: Normalización de importes y fechas en los límites
- **Escenario (Dado):** tabla de valores de entrada
- **Acción (Cuando):** se normaliza cada valor
- **Esperado (Entonces):** `1.234.567,89 → 123456789`, `-0,01 → -1`, `+12,00 → 1200`, `12 → 1200`, `1/2/2026 → 2026-02-01`; `31/02/2026`, `2026/13/01`, `abc` y `1,2,3` se rechazan con motivo
- **No debe:** aceptar silenciosamente un valor ambiguo o redondear céntimos
- **Verificación:** unit table-driven
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-2` · **Tests:** `TEST-IMP-002`

#### AC-003: Codificaciones UTF-8 con BOM y Windows-1252
- **Escenario (Dado):** el mismo extracto guardado en UTF-8 con BOM y en Windows-1252 con conceptos `CAFÉ ÑOÑO` y cabecera `Fecha operación`
- **Acción (Cuando):** se importa cada variante
- **Esperado (Entonces):** ambas producen movimientos idénticos y la cabecera se reconoce; no aparece mojibake (`Ã©`, `�`)
- **Verificación:** unit (decodificación) con fixtures binarios
- **Prioridad:** Importante
- **Historias:** `import-statements-2` · **Tests:** `TEST-IMP-003`

#### AC-004: XLSX equivalente al CSV
- **Escenario (Dado):** fixture `bank-es.xlsx` con 4 líneas de cabecera del banco antes de la tabla, fechas como celdas de fecha de Excel y como texto `dd/mm/aaaa`, importes numéricos
- **Acción (Cuando):** se importa el archivo
- **Esperado (Entonces):** el resultado normalizado es igual (deep-equal) al del CSV equivalente; se usa la primera hoja con cabecera reconocible
- **No debe:** desplazar fechas un día por zona horaria
- **Verificación:** integration con exceljs y fixture real
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-3` · **Tests:** `TEST-IMP-004`

#### AC-005: Detección automática de columnas
- **Escenario (Dado):** 6 fixtures con variantes de cabecera: `Fecha operación`/`F. Valor`/`Fecha`; `Concepto`/`Descripción`/`Movimiento`; `Importe`/`Cantidad` o par `Cargo`+`Abono`; `Saldo`/`Saldo disponible`; cabecera en cualquiera de las 20 primeras filas
- **Acción (Cuando):** se abre la vista previa
- **Esperado (Entonces):** el mapeo propuesto coincide con el esperado en los 6 fixtures (6/6); con `Cargo`/`Abono` el cargo se convierte en importe negativo
- **Verificación:** unit con fixtures
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-4` · **Tests:** `TEST-IMP-005`

#### AC-006: Vista previa y corrección manual sin escritura previa
- **Escenario (Dado):** archivo cargado y vista previa abierta (primeras 20 filas normalizadas y un selector por columna)
- **Acción (Cuando):** el usuario reasigna la columna «Importe» a otra columna y después pulsa «Cancelar»
- **Esperado (Entonces):** la vista previa se actualiza antes de confirmar; tras cancelar, el número de movimientos en IndexedDB no cambia
- **No debe:** escribir en IndexedDB antes de pulsar «Importar»
- **Verificación:** component test (RTL) + E2E Pixel 7
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-4` · **Tests:** `TEST-IMP-006`

#### AC-007: Columnas obligatorias sin asignar
- **Escenario (Dado):** mapeo sin columna de fecha o sin columna de importe
- **Acción (Cuando):** el usuario intenta importar
- **Esperado (Entonces):** el botón «Importar» está deshabilitado y un mensaje nombra la columna que falta (anunciado por `aria-live`)
- **No debe:** escribir ningún movimiento
- **Verificación:** component test (RTL)
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-4` · **Tests:** `TEST-IMP-007`

#### AC-008: Filas inválidas informadas y excluidas
- **Escenario (Dado):** archivo de 10 filas con fecha `31/02/2026` en la línea 4 e importe `abc` en la línea 9
- **Acción (Cuando):** se abre el resumen y el usuario confirma
- **Esperado (Entonces):** el resumen muestra «8 válidas, 2 con errores» con número de línea y motivo; solo se guardan 8
- **No debe:** abortar toda la importación por una fila mala ni importar filas inválidas
- **Verificación:** integration (parser + repositorio)
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-2` · **Tests:** `TEST-IMP-008`

#### AC-009: Importación atómica ante fallo de escritura
- **Escenario (Dado):** BD con 50 movimientos previos; importación de 1.000 filas y fallo simulado (`QuotaExceededError`) al escribir la fila 500
- **Acción (Cuando):** se ejecuta la importación
- **Esperado (Entonces):** la BD sigue con exactamente los 50 movimientos previos y se muestra un error comprensible
- **No debe:** dejar una importación parcial
- **Verificación:** integration con fake-indexeddb e inyección de fallo
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-1` · **Tests:** `TEST-IMP-009`

#### AC-010: Reimportación exacta no duplica
- **Escenario (Dado):** BD con el fixture A importado (50 movimientos)
- **Acción (Cuando):** se vuelve a importar A
- **Esperado (Entonces):** resumen «0 nuevos, 50 duplicados omitidos»; el total sigue siendo 50
- **No debe:** crear movimientos repetidos
- **Verificación:** integration
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-5` · **Tests:** `TEST-IMP-010`

#### AC-011: Solape parcial entre extractos
- **Escenario (Dado):** BD con el fixture A (1–31 ene); fixture B (15 ene–15 feb) comparte 20 movimientos con A y aporta 25 nuevos
- **Acción (Cuando):** se importa B
- **Esperado (Entonces):** se insertan 25 y se omiten 20; total 75
- **Verificación:** integration
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-5` · **Tests:** `TEST-IMP-011`

#### AC-012: Movimientos legítimos idénticos se cuentan como multiconjunto
- **Escenario (Dado):** archivo con 2 movimientos idénticos el mismo día (`CAFE BAR`, `-2,50`, sin saldo)
- **Acción (Cuando):** se importa una vez, se reimporta, y luego se importa un archivo con 3 copias
- **Esperado (Entonces):** 1.ª importación: 2 nuevos; reimportación: 0 nuevos; archivo con 3 copias: 1 nuevo. Clave = fecha + importe en céntimos + concepto normalizado (trim, espacios colapsados, mayúsculas, sin tildes) + saldo si existe
- **No debe:** descartar el segundo café legítimo
- **Verificación:** unit (clave) + integration
- **Prioridad:** Obligatorio
- **Historias:** `import-statements-5` · **Tests:** `TEST-IMP-012`

#### AC-013: Revisar y forzar duplicados omitidos
- **Escenario (Dado):** una importación con duplicados omitidos
- **Acción (Cuando):** el usuario abre «Ver omitidos» y marca uno como «Importar igualmente»
- **Esperado (Entonces):** solo ese movimiento se añade
- **Verificación:** component test
- **Prioridad:** Opcional
- **Historias:** `import-statements-5` · **Tests:** `TEST-IMP-013`

#### AC-014: Rendimiento de importación de 100.000 filas
- **Escenario (Dado):** CSV sintético de 100.000 filas (semilla fija) y BD con 100.000 movimientos previos
- **Acción (Cuando):** se ejecuta el benchmark `parse + normalizar + deduplicar`
- **Esperado (Entonces):** media ≤ 2.000 ms en el runner de CI; la UI muestra progreso durante la importación real
- **Verificación:** benchmark tinybench (`npm run bench`) con umbral que falla el job
- **Entorno/seguridad:** solo datos sintéticos generados con semilla; nunca extractos reales.
- **Prioridad:** Importante
- **Historias:** `import-statements-5`, `transaction-list-4` · **Tests:** `TEST-IMP-014`

### F2 · Categorización por reglas

#### AC-015: Regla «concepto contiene» insensible a mayúsculas y tildes
- **Escenario (Dado):** regla `contiene MERCADONA → Supermercado` y regla `contiene cafe → Ocio`
- **Acción (Cuando):** se aplican a `COMPRA MERCADONA VALENCIA`, `CAFÉ CENTRAL` y `MERCADO CENTRAL`
- **Esperado (Entonces):** los dos primeros se categorizan (Supermercado, Ocio); `MERCADO CENTRAL` queda «Sin categoría»
- **Verificación:** unit
- **Prioridad:** Obligatorio
- **Historias:** `categorization-1` · **Tests:** `TEST-CAT-001`

#### AC-016: Prioridad determinista
- **Escenario (Dado):** reglas `AMAZON PRIME → Suscripciones` (prioridad 1) y `AMAZON → Compras` (prioridad 2); dos reglas con la misma prioridad
- **Acción (Cuando):** se categoriza `AMAZON PRIME ES` y luego se reordenan las reglas
- **Esperado (Entonces):** gana la de mayor prioridad (número menor); tras reordenar y reaplicar, cambia el resultado; en empate gana la creada antes
- **No debe:** resultado dependiente del orden de almacenamiento
- **Verificación:** unit
- **Prioridad:** Obligatorio
- **Historias:** `categorization-2` · **Tests:** `TEST-CAT-002`

#### AC-017: Aplicación automática al importar
- **Escenario (Dado):** reglas existentes
- **Acción (Cuando):** se importan movimientos nuevos
- **Esperado (Entonces):** cada movimiento queda con la categoría de la primera regla coincidente o «Sin categoría»
- **Verificación:** integration
- **Prioridad:** Obligatorio
- **Historias:** `categorization-1` · **Tests:** `TEST-CAT-003`

#### AC-018: Categoría manual protegida
- **Escenario (Dado):** movimiento categorizado a mano como «Regalos»
- **Acción (Cuando):** se reaplican todas las reglas
- **Esperado (Entonces):** conserva «Regalos»
- **No debe:** sobrescribir decisiones manuales
- **Verificación:** integration
- **Prioridad:** Obligatorio
- **Historias:** `categorization-3` · **Tests:** `TEST-CAT-004`

#### AC-019: Propuesta de regla al recategorizar
- **Escenario (Dado):** movimiento `NETFLIX.COM 1234` sin categoría y otros 5 movimientos sin categoría que contienen `NETFLIX.COM`
- **Acción (Cuando):** el usuario lo cambia a «Ocio»
- **Esperado (Entonces):** se propone una regla editable `contiene NETFLIX.COM → Ocio`; al aceptar se crea y se ofrece aplicarla a «5 movimientos más»; al rechazar no se crea nada
- **No debe:** crear reglas sin confirmación explícita
- **Verificación:** component test + E2E
- **Prioridad:** Obligatorio
- **Historias:** `categorization-3` · **Tests:** `TEST-CAT-005`

#### AC-020: Validación de reglas y categorías
- **Escenario (Dado):** formulario de regla
- **Acción (Cuando):** se guarda con texto vacío, de 1 carácter o con categoría inexistente; o se intenta borrar una categoría usada
- **Esperado (Entonces):** se rechaza con mensaje asociado al campo; borrar una categoría usada exige elegir categoría de reemplazo
- **No debe:** dejar movimientos con categoría huérfana
- **Verificación:** unit + component test
- **Prioridad:** Importante
- **Historias:** `categorization-4` · **Tests:** `TEST-CAT-006`

### F3 · Presupuestos mensuales

#### AC-021: Definir presupuesto mensual
- **Escenario (Dado):** categoría «Supermercado» sin presupuesto
- **Acción (Cuando):** se guarda 300,00 €; luego se intenta 0, -5 y 12,345
- **Esperado (Entonces):** 300,00 € persiste tras recargar (30000 céntimos); 0, negativos y más de 2 decimales se rechazan
- **Verificación:** unit + integration
- **Prioridad:** Obligatorio
- **Historias:** `monthly-budgets-1` · **Tests:** `TEST-BUD-001`

#### AC-022: Umbrales de estado
- **Escenario (Dado):** presupuesto 300,00 €
- **Acción (Cuando):** el gasto del mes es 239,99 / 240,00 / 300,00 / 300,01 €
- **Esperado (Entonces):** estados `ok` / `cerca` / `cerca` / `superado` (ok < 80 %, cerca 80–100 % inclusive, superado > 100 %)
- **Verificación:** unit table-driven
- **Prioridad:** Obligatorio
- **Historias:** `monthly-budgets-2` · **Tests:** `TEST-BUD-002`

#### AC-023: Cálculo del gasto mensual
- **Escenario (Dado):** en enero: gastos -100,00 y -50,00 € y devolución +20,00 € en «Supermercado»; un gasto de -30,00 € el 1 de febrero
- **Acción (Cuando):** se calcula el gasto de enero
- **Esperado (Entonces):** 130,00 € (neto de devoluciones, mínimo 0, por fecha de operación y mes natural)
- **No debe:** contar movimientos de otro mes o categoría
- **Verificación:** unit
- **Prioridad:** Obligatorio
- **Historias:** `monthly-budgets-2` · **Tests:** `TEST-BUD-003`

#### AC-024: Estado visible sin depender del color
- **Escenario (Dado):** presupuestos en los tres estados
- **Acción (Cuando):** se abre la pantalla de presupuestos
- **Esperado (Entonces):** cada estado muestra texto («Bien», «Cerca», «Superado») + icono + porcentaje; contraste AA
- **No debe:** comunicar el estado solo con color
- **Verificación:** component test + axe
- **Prioridad:** Obligatorio
- **Historias:** `monthly-budgets-3` · **Tests:** `TEST-BUD-004`

### F4 · Panel financiero

#### AC-025: Gasto por categoría del mes
- **Escenario (Dado):** dataset sintético con sumas conocidas por categoría para marzo 2026
- **Acción (Cuando):** se abre el panel en marzo 2026
- **Esperado (Entonces):** los datos del gráfico y de su tabla alternativa coinciden al céntimo con lo esperado
- **Verificación:** unit (agregación) + component test
- **Prioridad:** Obligatorio
- **Historias:** `dashboard-1` · **Tests:** `TEST-DASH-001`

#### AC-026: Evolución de 12 meses
- **Escenario (Dado):** movimientos en 8 de los últimos 12 meses
- **Acción (Cuando):** se abre el panel
- **Esperado (Entonces):** aparecen 12 meses; los 4 sin movimientos muestran 0
- **Verificación:** unit
- **Prioridad:** Obligatorio
- **Historias:** `dashboard-2` · **Tests:** `TEST-DASH-002`

#### AC-027: Ingresos frente a gastos
- **Escenario (Dado):** mes con ingresos +2.000,00 € y gastos -1.234,56 €
- **Acción (Cuando):** se calcula el resumen del mes
- **Esperado (Entonces):** ingresos 2.000,00 €, gastos 1.234,56 €, ahorro 765,44 €
- **Verificación:** unit
- **Prioridad:** Obligatorio
- **Historias:** `dashboard-3` · **Tests:** `TEST-DASH-003`

#### AC-028: Saldo
- **Escenario (Dado):** movimientos con columna «Saldo» y otros sin ella
- **Acción (Cuando):** se muestra el saldo
- **Esperado (Entonces):** si el movimiento más reciente tiene saldo, se muestra ese valor; si no, saldo conocido más reciente + suma de importes posteriores, con indicación «estimado»
- **Verificación:** unit
- **Prioridad:** Importante
- **Historias:** `dashboard-4` · **Tests:** `TEST-DASH-004`

#### AC-029: Alternativa accesible de cada gráfico
- **Escenario (Dado):** panel con datos
- **Acción (Cuando):** se navega con lector de pantalla o teclado
- **Esperado (Entonces):** cada gráfico tiene título y una tabla o resumen textual con los mismos valores
- **Verificación:** component test + revisión manual
- **Prioridad:** Obligatorio
- **Historias:** `dashboard-1` · **Tests:** `TEST-DASH-005`

#### AC-030: Panel vacío
- **Escenario (Dado):** BD sin movimientos
- **Acción (Cuando):** se abre el panel
- **Esperado (Entonces):** se muestra un estado vacío con la acción «Importar extracto»
- **No debe:** errores en consola o gráficos con NaN
- **Verificación:** E2E
- **Prioridad:** Importante
- **Historias:** `dashboard-1` · **Tests:** `TEST-DASH-006`

### F5 · Lista de movimientos

#### AC-031: Lista virtualizada con 100.000 movimientos
- **Escenario (Dado):** BD sembrada con 100.000 movimientos sintéticos (semilla fija)
- **Acción (Cuando):** se abre «Movimientos» y se desplaza hasta el final
- **Esperado (Entonces):** el DOM contiene ≤ 100 filas `[role=row]` en todo momento y el último movimiento es visible al final del scroll
- **No debe:** renderizar todas las filas
- **Verificación:** E2E Pixel 7
- **Prioridad:** Obligatorio
- **Historias:** `transaction-list-1` · **Tests:** `TEST-LIST-001`

#### AC-032: Benchmark de filtrado de 100.000 movimientos
- **Escenario (Dado):** 100.000 movimientos sintéticos en memoria (semilla fija)
- **Acción (Cuando):** se ejecuta `filterTransactions` con filtro combinado (texto `mercadona` + rango de 3 meses + 2 categorías) y ordenación por fecha
- **Esperado (Entonces):** filtrado: **p95 ≤ 50 ms** y media ≤ 25 ms; filtrado + ordenación: p95 ≤ 100 ms; mínimo 30 iteraciones tras calentamiento, en el runner de CI (`ubuntu-latest`, Node LTS)
- **No debe:** aprobar el benchmark si no se alcanzan las iteraciones mínimas
- **Verificación:** benchmark tinybench (`npm run bench`) que falla el job si se supera el umbral
- **Entorno/seguridad:** solo datos sintéticos generados con semilla; nunca extractos reales.
- **Prioridad:** Obligatorio
- **Historias:** `transaction-list-4` · **Tests:** `TEST-LIST-002`

#### AC-033: Respuesta de la UI al buscar
- **Escenario (Dado):** 100.000 movimientos sembrados, Playwright con perfil Pixel 7
- **Acción (Cuando):** se escribe un término de búsqueda
- **Esperado (Entonces):** la lista filtrada y el contador se actualizan ≤ 300 ms tras la última pulsación (debounce incluido); render inicial de la lista ≤ 1.500 ms tras abrir la vista
- **Verificación:** E2E con medición `performance.now()`
- **Prioridad:** Importante
- **Historias:** `transaction-list-2` · **Tests:** `TEST-LIST-003`

#### AC-034: Búsqueda y filtros combinables
- **Escenario (Dado):** dataset con conceptos con y sin tilde, ingresos y gastos, varias categorías
- **Acción (Cuando):** se combinan texto, rango de fechas, categorías (multi), tipo (ingreso/gasto) e importe mín./máx.
- **Esperado (Entonces):** el resultado es la intersección (AND) de todos los filtros; búsqueda por subcadena sin distinguir mayúsculas ni tildes; se muestra el número de resultados
- **Verificación:** unit + component test
- **Prioridad:** Obligatorio
- **Historias:** `transaction-list-2` · **Tests:** `TEST-LIST-004`

#### AC-035: Edición de movimiento
- **Escenario (Dado):** movimiento existente
- **Acción (Cuando):** se editan categoría, concepto visible y nota, y se recarga la página
- **Esperado (Entonces):** los cambios persisten; fecha e importe no son editables; la clave de deduplicación sigue usando el concepto original
- **No debe:** que una edición provoque duplicados en la siguiente reimportación
- **Verificación:** integration + E2E
- **Prioridad:** Obligatorio
- **Historias:** `transaction-list-3` · **Tests:** `TEST-LIST-005`

### F6 · Copia de seguridad cifrada

#### AC-036: Formato de exportación cifrada
- **Escenario (Dado):** BD con movimientos, categorías, reglas, presupuestos y ajustes
- **Acción (Cuando):** se exporta con una contraseña válida
- **Esperado (Entonces):** se descarga `cuentas-claras-AAAA-MM-DD.ccbackup` con cabecera `{format, version: 1, kdf: "PBKDF2-SHA-256", iterations: 600000, salt (16 B), iv (12 B)}` y el contenido cifrado con AES-GCM de 256 bits mediante `crypto.subtle`
- **No debe:** usar librerías criptográficas propias o de terceros
- **Verificación:** unit/integration con WebCrypto real (Node `globalThis.crypto`) + revisión de seguridad
- **Prioridad:** Obligatorio
- **Historias:** `encrypted-backup-1` · **Tests:** `TEST-BAK-001`

#### AC-037: Sin texto plano y sin reutilizar sal/IV
- **Escenario (Dado):** BD con conceptos conocidos (`MERCADONA`, `NETFLIX.COM`) e importes conocidos
- **Acción (Cuando):** se exporta dos veces con la misma contraseña
- **Esperado (Entonces):** los bytes del archivo no contienen esos conceptos ni importes; las dos exportaciones tienen sal, IV y cifrado distintos
- **Verificación:** integration
- **Prioridad:** Obligatorio
- **Historias:** `encrypted-backup-1` · **Tests:** `TEST-BAK-002`

#### AC-038: Ida y vuelta completa
- **Escenario (Dado):** BD con datos de todas las tablas
- **Acción (Cuando):** se exporta, se vacía la BD y se importa con la contraseña correcta
- **Esperado (Entonces):** todas las tablas son iguales (deep-equal) a las originales
- **Verificación:** integration
- **Prioridad:** Obligatorio
- **Historias:** `encrypted-backup-2` · **Tests:** `TEST-BAK-003`

#### AC-039: Contraseña incorrecta
- **Escenario (Dado):** copia válida y BD con datos distintos
- **Acción (Cuando):** se importa con una contraseña errónea
- **Esperado (Entonces):** mensaje «Contraseña incorrecta o archivo dañado»; la BD queda idéntica a su instantánea previa
- **No debe:** modificar o borrar datos
- **Verificación:** integration
- **Prioridad:** Obligatorio
- **Historias:** `encrypted-backup-3` · **Tests:** `TEST-BAK-004`

#### AC-040: Archivo manipulado o versión incompatible
- **Escenario (Dado):** copia válida
- **Acción (Cuando):** se invierte 1 byte del cifrado; en otra prueba se cambia `version` a 99; en otra se trunca el archivo
- **Esperado (Entonces):** los tres casos se rechazan (fallo de autenticación GCM / «versión no compatible» / «archivo dañado») y la BD no cambia
- **No debe:** importar datos parciales
- **Verificación:** integration
- **Prioridad:** Obligatorio
- **Historias:** `encrypted-backup-3` · **Tests:** `TEST-BAK-005`

#### AC-041: Restauración confirmada y atómica
- **Escenario (Dado):** copia válida y BD con datos
- **Acción (Cuando):** se elige el archivo y se introduce la contraseña correcta; se simula un fallo de escritura a mitad
- **Esperado (Entonces):** antes de reemplazar se muestra un resumen (nº de movimientos, reglas, presupuestos, fecha de la copia) y se pide confirmación; con el fallo, los datos previos quedan intactos
- **No debe:** reemplazar sin confirmación
- **Verificación:** integration + component test
- **Prioridad:** Obligatorio
- **Historias:** `encrypted-backup-2` · **Tests:** `TEST-BAK-006`

#### AC-042: Contraseña: validación y no persistencia
- **Escenario (Dado):** formulario de exportación
- **Acción (Cuando):** se introduce una contraseña de 7 caracteres, o dos campos que no coinciden; luego se exporta con una válida
- **Esperado (Entonces):** los dos primeros casos se rechazan; tras exportar, la contraseña no aparece en IndexedDB, `localStorage`, `sessionStorage` ni en la consola
- **No debe:** persistir o registrar la contraseña
- **Verificación:** component test + E2E (inspección de almacenamiento)
- **Prioridad:** Obligatorio
- **Historias:** `encrypted-backup-1` · **Tests:** `TEST-BAK-007`

#### AC-043: Solo WebCrypto
- **Escenario (Dado):** `package.json` y bundle de producción
- **Acción (Cuando):** se ejecuta la comprobación de dependencias
- **Esperado (Entonces):** no hay dependencias criptográficas (lista negra: `crypto-js`, `node-forge`, `tweetnacl`, `sjcl`, `libsodium*`, `bcryptjs`)
- **Verificación:** script de comprobación en CI + revisión de seguridad
- **Prioridad:** Obligatorio
- **Historias:** `encrypted-backup-1` · **Tests:** `TEST-BAK-008`

### F7 · Idiomas español e inglés

#### AC-044: Español por defecto y cambio persistente a inglés
- **Escenario (Dado):** primer arranque con `navigator.language = en-US`
- **Acción (Cuando):** se abre la app; luego se cambia a inglés y se recarga
- **Esperado (Entonces):** la app arranca en español con `<html lang="es">`; tras cambiar y recargar sigue en inglés con `<html lang="en">`
- **Verificación:** E2E
- **Prioridad:** Obligatorio
- **Historias:** `i18n-1`, `i18n-2` · **Tests:** `TEST-I18N-001`

#### AC-045: Claves completas en ambos idiomas
- **Escenario (Dado):** archivos de traducción `es` y `en`
- **Acción (Cuando):** se comparan sus claves
- **Esperado (Entonces):** el conjunto de claves es idéntico y ningún valor está vacío; ninguna cadena visible de la UI está escrita fuera de los archivos de traducción (regla de lint)
- **Verificación:** unit + lint
- **Prioridad:** Obligatorio
- **Historias:** `i18n-1`, `i18n-2` · **Tests:** `TEST-I18N-002`

#### AC-046: Formatos locales de fecha e importe
- **Escenario (Dado):** importe -1234,56 € y fecha 2026-01-05
- **Acción (Cuando):** se muestran en cada idioma
- **Esperado (Entonces):** es: `-1234,56 €` (formato `Intl.NumberFormat('es-ES')`) y `05/01/2026`; en: `-€1,234.56` y `01/05/2026` (o el formato que devuelva `Intl` para `en`), siempre vía `Intl`
- **No debe:** formatear importes con concatenación manual
- **Verificación:** unit
- **Prioridad:** Importante
- **Historias:** `i18n-3` · **Tests:** `TEST-I18N-003`

### F8 · Plataforma: PWA accesible, offline y con temas

#### AC-047: Despliegue bajo `/Ecc-test/`
- **Escenario (Dado):** build de producción servido localmente con base `/Ecc-test/`
- **Acción (Cuando):** se cargan todas las rutas principales
- **Esperado (Entonces):** ninguna petición de recurso devuelve 404 y el enrutado funciona al recargar en una ruta profunda
- **Verificación:** E2E sobre `vite preview` con base
- **Prioridad:** Obligatorio
- **Historias:** `app-platform-4` · **Tests:** `TEST-PWA-001`

#### AC-048: Instalable
- **Escenario (Dado):** build de producción
- **Acción (Cuando):** se valida el manifest
- **Esperado (Entonces):** incluye `name`, `short_name`, iconos 192 y 512 px (uno `maskable`), `start_url` y `scope` `/Ecc-test/`, `display: standalone`; hay service worker registrado
- **Verificación:** E2E + comprobación del manifest
- **Prioridad:** Obligatorio
- **Historias:** `app-platform-1` · **Tests:** `TEST-PWA-002`

#### AC-049: Funciona sin conexión
- **Escenario (Dado):** app cargada una vez con el service worker activo y datos guardados
- **Acción (Cuando):** se pone el contexto offline y se recarga; se importa un CSV local
- **Esperado (Entonces):** la app carga, muestra los datos guardados y la importación funciona
- **Verificación:** E2E (`context.setOffline(true)`)
- **Prioridad:** Obligatorio
- **Historias:** `app-platform-1` · **Tests:** `TEST-PWA-003`

#### AC-050: Modo claro/oscuro/sistema
- **Escenario (Dado):** `prefers-color-scheme: dark` emulado
- **Acción (Cuando):** se abre la app y luego se elige «Claro» y se recarga
- **Esperado (Entonces):** arranca en oscuro; tras elegir «Claro» y recargar sigue en claro
- **Verificación:** E2E
- **Prioridad:** Obligatorio
- **Historias:** `app-platform-2` · **Tests:** `TEST-PWA-004`

#### AC-051: Sin violaciones axe WCAG 2.2 A/AA
- **Escenario (Dado):** rutas Panel, Movimientos, Importar, Presupuestos, Reglas y Ajustes, con datos, en tema claro y oscuro
- **Acción (Cuando):** se ejecuta axe con etiquetas `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`
- **Esperado (Entonces):** 0 violaciones de impacto `serious` o `critical` en las 12 combinaciones
- **Verificación:** E2E con @axe-core/playwright
- **Prioridad:** Obligatorio
- **Historias:** `app-platform-3` · **Tests:** `TEST-A11Y-001`

#### AC-052: Flujo completo con teclado
- **Escenario (Dado):** app vacía
- **Acción (Cuando):** se importa un CSV, se confirma y se edita un movimiento usando solo teclado
- **Esperado (Entonces):** el flujo se completa; el foco es siempre visible y no queda atrapado; los diálogos devuelven el foco al cerrar
- **Verificación:** E2E de teclado + revisión manual
- **Prioridad:** Obligatorio
- **Historias:** `app-platform-3` · **Tests:** `TEST-A11Y-002`

#### AC-053: Móvil y objetivos táctiles
- **Escenario (Dado):** viewport Pixel 7
- **Acción (Cuando):** se recorren las rutas principales
- **Esperado (Entonces):** no hay scroll horizontal y los controles interactivos miden ≥ 24×24 px CSS (WCAG 2.5.8)
- **Verificación:** E2E
- **Prioridad:** Importante
- **Historias:** `app-platform-3` · **Tests:** `TEST-A11Y-003`

#### AC-054: Revisión con lector de pantalla
- **Escenario (Dado):** build candidata
- **Acción (Cuando):** una persona recorre importar, lista, panel y copia con TalkBack (Android) y NVDA (escritorio)
- **Esperado (Entonces):** cada control tiene nombre accesible y los cambios de estado se anuncian; resultado registrado en el registro de tests
- **Verificación:** revisión manual (juicio humano)
- **Prioridad:** Importante
- **Historias:** `app-platform-3` · **Tests:** `TEST-A11Y-004`

#### AC-055: Ningún dato sale del navegador
- **Escenario (Dado):** recorrido E2E completo (importar, categorizar, presupuestar, exportar copia)
- **Acción (Cuando):** se registran todas las peticiones de red
- **Esperado (Entonces):** 0 peticiones a orígenes distintos del de la app y ninguna petición con datos de movimientos en URL o cuerpo
- **No debe:** telemetría, analítica o fuentes externas
- **Verificación:** E2E con escucha de `page.on('request')`
- **Prioridad:** Obligatorio
- **Historias:** `app-platform-4` · **Tests:** `TEST-PWA-005`

## Blocking Decisions

- [ ] **D1 — Clave de deduplicación** (bloquea `import-statements-5`): se propone fecha + importe en céntimos + concepto normalizado + saldo (si existe), contada como multiconjunto (AC-012). Riesgo: si el banco cambia el texto del concepto entre descargas se crearían duplicados; si se relaja la clave se perderían movimientos legítimos.
- [ ] **D2 — Modo de restauración** (bloquea `encrypted-backup-2`): se propone *reemplazar todo* tras confirmación (AC-041). La alternativa *fusionar* requiere reutilizar la deduplicación y definir conflictos de reglas/presupuestos.
- [ ] **D3 — Umbral «cerca» del presupuesto** (no bloqueante, A4): 80 %.
- [ ] **D4 — Cálculo del saldo sin columna «Saldo»** (no bloqueante, A7).

## Verification Plan

| Criterion | Verification evidence | Status |
| --- | --- | --- |
| AC-001 | TEST-IMP-001 — unit (parser) + integration (parser → repositorio con fake-indexeddb) | Pending |
| AC-002 | TEST-IMP-002 — unit table-driven | Pending |
| AC-003 | TEST-IMP-003 — unit (decodificación) con fixtures binarios | Pending |
| AC-004 | TEST-IMP-004 — integration con exceljs y fixture real | Pending |
| AC-005 | TEST-IMP-005 — unit con fixtures | Pending |
| AC-006 | TEST-IMP-006 — component test (RTL) + E2E Pixel 7 | Pending |
| AC-007 | TEST-IMP-007 — component test (RTL) | Pending |
| AC-008 | TEST-IMP-008 — integration (parser + repositorio) | Pending |
| AC-009 | TEST-IMP-009 — integration con fake-indexeddb e inyección de fallo | Pending |
| AC-010 | TEST-IMP-010 — integration | Pending |
| AC-011 | TEST-IMP-011 — integration | Pending |
| AC-012 | TEST-IMP-012 — unit (clave) + integration | Pending |
| AC-013 | TEST-IMP-013 — component test | Pending |
| AC-014 | TEST-IMP-014 — benchmark tinybench (`npm run bench`) con umbral que falla el job | Pending |
| AC-015 | TEST-CAT-001 — unit | Pending |
| AC-016 | TEST-CAT-002 — unit | Pending |
| AC-017 | TEST-CAT-003 — integration | Pending |
| AC-018 | TEST-CAT-004 — integration | Pending |
| AC-019 | TEST-CAT-005 — component test + E2E | Pending |
| AC-020 | TEST-CAT-006 — unit + component test | Pending |
| AC-021 | TEST-BUD-001 — unit + integration | Pending |
| AC-022 | TEST-BUD-002 — unit table-driven | Pending |
| AC-023 | TEST-BUD-003 — unit | Pending |
| AC-024 | TEST-BUD-004 — component test + axe | Pending |
| AC-025 | TEST-DASH-001 — unit (agregación) + component test | Pending |
| AC-026 | TEST-DASH-002 — unit | Pending |
| AC-027 | TEST-DASH-003 — unit | Pending |
| AC-028 | TEST-DASH-004 — unit | Pending |
| AC-029 | TEST-DASH-005 — component test + revisión manual | Pending |
| AC-030 | TEST-DASH-006 — E2E | Pending |
| AC-031 | TEST-LIST-001 — E2E Pixel 7 | Pending |
| AC-032 | TEST-LIST-002 — benchmark tinybench (`npm run bench`) que falla el job si se supera el umbral | Pending |
| AC-033 | TEST-LIST-003 — E2E con medición `performance.now()` | Pending |
| AC-034 | TEST-LIST-004 — unit + component test | Pending |
| AC-035 | TEST-LIST-005 — integration + E2E | Pending |
| AC-036 | TEST-BAK-001 — unit/integration con WebCrypto real (Node `globalThis.crypto`) + revisión de seguridad | Pending |
| AC-037 | TEST-BAK-002 — integration | Pending |
| AC-038 | TEST-BAK-003 — integration | Pending |
| AC-039 | TEST-BAK-004 — integration | Pending |
| AC-040 | TEST-BAK-005 — integration | Pending |
| AC-041 | TEST-BAK-006 — integration + component test | Pending |
| AC-042 | TEST-BAK-007 — component test + E2E (inspección de almacenamiento) | Pending |
| AC-043 | TEST-BAK-008 — script de comprobación en CI + revisión de seguridad | Pending |
| AC-044 | TEST-I18N-001 — E2E | Pending |
| AC-045 | TEST-I18N-002 — unit + lint | Pending |
| AC-046 | TEST-I18N-003 — unit | Pending |
| AC-047 | TEST-PWA-001 — E2E sobre `vite preview` con base | Pending |
| AC-048 | TEST-PWA-002 — E2E + comprobación del manifest | Pending |
| AC-049 | TEST-PWA-003 — E2E (`context.setOffline(true)`) | Pending |
| AC-050 | TEST-PWA-004 — E2E | Pending |
| AC-051 | TEST-A11Y-001 — E2E con @axe-core/playwright | Pending |
| AC-052 | TEST-A11Y-002 — E2E de teclado + revisión manual | Pending |
| AC-053 | TEST-A11Y-003 — E2E | Pending |
| AC-054 | TEST-A11Y-004 — revisión manual (juicio humano) | Pending |
| AC-055 | TEST-PWA-005 — E2E con escucha de `page.on('request')` | Pending |
