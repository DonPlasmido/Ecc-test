# PRODUCT-BRIEF — Cuentas Claras

> Documento generado aplicando la skill `product-lens` (modos 1, 3 y 4) sobre `docs/BRIEF.md`.
> Fecha: 2026-11-17. Estado del producto: **sin código ni usuarios reales**.
>
> **Convención:** todo lo marcado **[SUPUESTO]** es una hipótesis razonada sin validar con usuarios.
> Lo marcado **[HECHO]** procede literalmente del brief o de sus restricciones fijas.

---

## 0. Resumen ejecutivo

| Pregunta | Respuesta corta |
|---|---|
| ¿Para quién? | Persona en España con 1–3 cuentas bancarias que quiere saber en qué gasta sin entregar sus datos a un agregador. [SUPUESTO] |
| ¿Dolor? | Sus extractos son CSV/XLSX "a la española" que ninguna app gratuita importa bien, y las apps que se conectan al banco piden credenciales/PSD2. [SUPUESTO] |
| ¿MVP? | Importar extracto → ver movimientos categorizados → ver gasto por categoría del mes. |
| ¿Métrica? | Time-to-value < 3 min y ≥ 80 % de movimientos categorizados tras la primera importación. |
| **Recomendación** | **GO** (condicionado): construir en el orden de la sección 4, con i18n, accesibilidad y offline como requisitos transversales desde el primer incremento, no como funcionalidades finales. |

---

## 1. Diagnóstico de producto (Modo 1)

### 1.1 ¿Para quién es?

**Persona primaria — "Laura, 34, Valencia"** [SUPUESTO]
- Asalariada, 2 cuentas (nómina + ahorro) en bancos españoles distintos, 80–200 movimientos/mes.
- Hoy: descarga el extracto en Excel una vez al mes y lo repasa a ojo, o mantiene una hoja de cálculo que abandona a las 6 semanas.
- Desconfía de dar credenciales bancarias a terceros (Fintonic y similares) y no quiere cuentas ni suscripciones.
- Usa el móvil como dispositivo principal.

**Persona secundaria — "Usuario intensivo"** [SUPUESTO]
- Autónomo o persona con años de histórico (10–15 años × varias cuentas ≈ hasta 100.000 movimientos [HECHO: requisito de rendimiento]).
- Necesita búsqueda y filtros rápidos más que gráficos bonitos.

**Audiencia real del proyecto** [HECHO]: el brief declara que el objetivo es *demostrar capacidades de ingeniería con ECC*. Esto implica dos "clientes": el usuario final simulado y el evaluador técnico del repositorio. Ambos se tienen en cuenta en la priorización (columna de impacto).

### 1.2 ¿Cuál es el dolor? (cuantificado)

| Dimensión | Estimación | Tipo |
|---|---|---|
| Frecuencia | Mensual (cierre de mes) + puntual al ver el saldo bajo | [SUPUESTO] |
| Tiempo perdido hoy | 30–60 min/mes revisando extractos o manteniendo una hoja | [SUPUESTO] |
| Gravedad | Media: no es urgente, pero genera ansiedad y sobregasto no detectado | [SUPUESTO] |
| Alternativa actual | Excel manual, app del banco (solo ve un banco), agregadores PSD2 (requieren cuenta y ceder datos) | [SUPUESTO] |
| Fricción específica | Formatos españoles: `;`, coma decimal, `dd/mm/aaaa`, cabeceras variables entre bancos | [HECHO] |

### 1.3 ¿Por qué ahora?

- Las PWA instalables, IndexedDB y WebCrypto permiten una app 100 % local con experiencia casi nativa y cifrado estándar sin servidor. [HECHO: stack]
- Creciente sensibilidad a la privacidad financiera y fatiga de suscripciones. [SUPUESTO]
- Coste de hosting cero (GitHub Pages): sostenible sin modelo de negocio. [HECHO]

### 1.4 Versión de 10 estrellas

Importación sin intervención de cualquier banco español (detección perfecta de formato), categorización ≥ 95 % automática que aprende sola, previsión de fin de mes, alertas de presupuesto, sincronización cifrada extremo a extremo entre dispositivos sin servidor propio, y conciliación de duplicados entre cuentas (transferencias internas). **Fuera de alcance** para este proyecto; sirve para orientar decisiones de diseño (p. ej., modelo de datos que no impida una futura sincronización).

### 1.5 MVP (lo mínimo que prueba la tesis)

> **Tesis:** "Una persona puede entender en qué gasta su dinero en menos de 3 minutos, a partir del extracto de su banco, sin que ningún dato salga de su dispositivo."

MVP = F1 (importar CSV, con XLSX inmediatamente después) + lista básica de movimientos (F5 sin el objetivo de 100k) + F2 (reglas básicas) + gasto por categoría del mes (porción de F4). Todo ello en español, accesible y funcionando offline.

### 1.6 Anti-objetivos (lo que NO se construye)

- Conexión directa con bancos (PSD2/scraping) ni ningún backend. [HECHO]
- Cuentas de usuario, login o sincronización en la nube.
- Telemetría o analítica remota (rompería la promesa "ningún dato sale del navegador"). [HECHO]
- Inversiones, criptomonedas, facturación o contabilidad de empresa.
- Categorización por IA/LLM remoto. Las reglas locales son explicables y privadas.
- Multimoneda (se asume EUR). [SUPUESTO: simplificación deliberada]

### 1.7 ¿Cómo sabremos que funciona? (métricas, no sensaciones)

Al no haber telemetría, las métricas se miden con **tests E2E (Playwright) sobre extractos de ejemplo** y con pruebas de usuario moderadas.

| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| Time-to-value (instalar → primer gráfico de gasto) | < 3 min; < 5 pasos | Script E2E cronometrado + 3–5 pruebas moderadas [SUPUESTO: aún no realizadas] |
| Columnas detectadas sin corrección manual | ≥ 90 % de los extractos de muestra | Batería de fixtures de 5+ bancos españoles [SUPUESTO: fixtures sintéticos] |
| Movimientos autocategorizados tras 1.ª importación | ≥ 60 % con reglas por defecto; ≥ 80 % tras la 2.ª | Test sobre fixtures |
| Duplicados creados al reimportar el mismo extracto | 0 | Test unitario + E2E |
| Rendimiento con 100.000 movimientos | Scroll fluido; filtrado < 200 ms | Benchmark (tinybench) + Playwright en Pixel 7 [HECHO: herramientas] |
| Accesibilidad | 0 violaciones axe serias/críticas | `@axe-core/playwright` |
| Retención (proxy) | El usuario reimporta al mes siguiente | Solo en pruebas moderadas; no medible en producción [SUPUESTO] |

### 1.8 Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Diversidad de formatos bancarios mayor de la prevista | Alta | Alto | Vista previa con corrección manual obligatoria; fixtures por banco; heurística por nombres de cabecera y por tipo de contenido |
| Pérdida de datos (borrado de caché del navegador, cambio de móvil) | Media | **Crítico** | Copia cifrada (F6) temprana; `navigator.storage.persist()`; recordatorio de copia |
| Contraseña de copia olvidada = datos irrecuperables | Media | Alto | Advertencia explícita en UI; sin "recuperación" (es por diseño) |
| Rendimiento con 100k en móviles medios | Media | Medio | Virtualización de lista, índices IndexedDB, filtrado en Web Worker si hace falta |
| XLSX pesado en el bundle (exceljs) | Alta | Medio | Carga diferida (import dinámico) solo al importar XLSX |
| Sin usuarios reales: priorización basada en supuestos | Cierta | Medio | Validar con 3–5 pruebas moderadas tras el MVP antes de F3/F6 |

### 1.9 Recomendación: **GO (condicionado)**

Condiciones:
1. El primer incremento entregable es el flujo de valor completo (importar → ver gasto), no una funcionalidad aislada.
2. i18n, accesibilidad, offline y tema claro/oscuro se integran como **requisitos transversales** desde el primer componente (añadirlos al final multiplica su coste).
3. La copia cifrada se adelanta respecto a su posición en el brief, por el riesgo de pérdida de datos inherente al modelo local-first.

**Siguiente paso:** pasar este brief a la skill `product-capability` para convertir el orden de la sección 4 en un plan de capacidades con invariantes (modelo de datos, clave de deduplicación, formato del archivo de copia).

---

## 2. User Journey Audit — time-to-value (Modo 3)

> No existe producto todavía: se audita el **recorrido previsto** según el brief. Los tiempos son **[SUPUESTO]** estimados para un usuario nuevo en un Pixel 7 con un extracto de 150 movimientos. Comparativa con competidores basada en conocimiento general, **[SUPUESTO]** no medida.

### 2.1 Recorrido y fricciones

| # | Paso | Tiempo est. | Fricción prevista | Severidad |
|---|---|---|---|---|
| 1 | Abrir URL / instalar PWA | 20 s | El usuario no sabe que puede instalarla; prompt de instalación poco visible en iOS | Media |
| 2 | Pantalla inicial vacía | 10 s | Estado vacío sin llamada a la acción clara = abandono | **Alta** |
| 3 | Descargar extracto desde la web del banco (fuera de la app) | 60–180 s | Fuera de nuestro control; el usuario no sabe dónde está la opción en su banco | **Alta** |
| 4 | Seleccionar archivo en la app | 15 s | Selector de archivos del móvil; el XLSX puede estar en "Descargas" | Baja |
| 5 | Vista previa y mapeo de columnas | 20–90 s | Si la detección falla, el mapeo manual es confuso (¿"Importe" o "Cargo/Abono"?) | **Alta** |
| 6 | Confirmar importación | 5 s | Duda sobre duplicados si reimporta | Media |
| 7 | Ver movimientos | 10 s | Si casi todo queda "Sin categoría", la primera impresión es de trabajo pendiente | **Alta** |
| 8 | Ver gasto por categoría (primera victoria) | 10 s | Debe ser la pantalla de destino tras importar, no estar en otra pestaña | Media |

**Time-to-value estimado:** ~2,5 min (mejor caso, extracto ya descargado y detección correcta) a ~6 min (peor caso, mapeo manual). **Objetivo:** < 3 min en el caso típico.

**Primera victoria definida como:** ver un gráfico "En qué gastaste este mes" con ≥ 60 % del gasto categorizado.

### 2.2 Comparativa con alternativas [SUPUESTO]

| Alternativa | Time-to-value | Coste para el usuario |
|---|---|---|
| Agregador PSD2 (tipo Fintonic) | 3–5 min | Crear cuenta, ceder credenciales/consentimiento bancario |
| Hoja de cálculo propia | 30+ min | Montar fórmulas y categorías a mano |
| App del banco | Inmediato | Solo un banco; categorías no editables |
| **Cuentas Claras (objetivo)** | **< 3 min** | Descargar extracto manualmente (fricción principal) |

La ventaja diferencial es la privacidad; la desventaja estructural es el paso 3 (descarga manual), que no se puede eliminar, solo guiar.

### 2.3 Top 3 arreglos de onboarding

1. **Estado vacío accionable + datos de ejemplo.** Botón principal "Importar extracto" y enlace secundario "Probar con datos de ejemplo" que carga un extracto ficticio y lleva directamente al panel. Reduce el time-to-value de demostración a < 30 s. *Siguiente paso:* incluir un fixture de ejemplo y un test E2E "primer uso con datos de ejemplo".
2. **Reglas por defecto para comercios españoles frecuentes** (supermercados, suministros, transporte, nóminas, Bizum) para que la primera importación salga mayoritariamente categorizada. *Siguiente paso:* lista semilla de ~50 reglas con test de cobertura sobre fixtures.
3. **Mapeo de columnas que solo pregunta lo dudoso.** Vista previa con columnas ya asignadas y confianza visible; pedir intervención solo en columnas ambiguas; recordar el mapeo por "huella" de cabecera para la siguiente importación del mismo banco. *Siguiente paso:* definir la huella de cabecera y testear el recuerdo de mapeo.

Extra (bajo coste): tras importar, navegar automáticamente al resumen del mes importado, y mostrar "X movimientos nuevos, Y duplicados omitidos".

---

## 3. Priorización ICE (Modo 4)

### 3.1 Criterios

- **Impacto (1–5):** contribución a la tesis (entender el gasto rápido y en privado) + valor demostrativo para el objetivo del proyecto.
- **Confianza (1–5):** seguridad de que el impacto es real y de que sabemos construirlo con el stack fijado. Sin usuarios reales, ninguna puntuación supera 4. **[SUPUESTO]** en todas.
- **Esfuerzo (1–5):** 1 = horas/1 día, 5 = varias semanas. Estimación para un desarrollador con agentes.
- **ICE = Impacto × Confianza ÷ Esfuerzo.**

### 3.2 Puntuación

| Rank | Funcionalidad | I | C | E | **ICE** | Justificación |
|---|---|---|---|---|---|---|
| 1 | F6 · Copia de seguridad cifrada | 4 | 4 | 2 | **8,0** | En local-first es la única defensa contra pérdida total de datos; WebCrypto (PBKDF2/AES-GCM) es estándar y acotado |
| 2 | F2 · Categorización por reglas + aprendizaje | 5 | 4 | 3 | **6,7** | Sin categorías no hay panel ni presupuestos; la propuesta de regla al recategorizar es el "momento mágico" |
| 3 | F3 · Presupuestos mensuales | 4 | 3 | 2 | **6,0** | Convierte la app de retrospectiva a accionable; confianza media porque muchos usuarios no mantienen presupuestos [SUPUESTO] |
| 4 | F4 · Panel (categorías, evolución, ingresos/gastos, saldo) | 4 | 4 | 3 | **5,3** | Es la "primera victoria" visible; recharts reduce esfuerzo |
| 5 | F1 · Importar CSV/XLSX con detección y duplicados | 5 | 4 | 4 | **5,0** | Impacto máximo (sin datos no hay producto) pero esfuerzo alto por variabilidad de formatos |
| 6 | F5 · Lista de movimientos fluida con 100k | 4 | 4 | 4 | **4,0** | La lista básica es imprescindible; el objetivo de 100k (virtualización, índices, benchmark) es lo caro |
| 7 | F8 · Accesible (WCAG 2.2 AA), offline, claro/oscuro | 3 | 4 | 3 | **4,0** | Requisito de calidad más que funcionalidad; el coste real depende de hacerlo desde el inicio |
| 8 | F7 · Idiomas ES/EN | 2 | 4 | 2 | **4,0** | El usuario primario es hispanohablante; impacto bajo para el usuario, más alto como demostración |

Desempate en 4,0: F5 > F8 > F7 por impacto.

### 3.3 Aplicación de restricciones (dependencias, equipo, transversalidad)

El ranking ICE puro **no es el orden de construcción**, por tres restricciones:

1. **Dependencias de datos:** F1 (importar) es prerrequisito de todo lo demás; sin movimientos, F2–F6 no tienen nada que procesar. Su ICE bajo refleja esfuerzo, no prioridad.
2. **Transversales:** F7 (i18n) y F8 (a11y/offline/tema) tienen coste casi nulo si se integran desde el primer componente y coste alto si se retrofitean. Se tratan como **definición de "terminado"** en cada incremento, no como fases.
3. **Riesgo local-first:** F6 tiene el ICE más alto y se adelanta en cuanto existan datos que proteger.

### 3.4 Orden recomendado de construcción

| Fase | Contenido | Resultado verificable |
|---|---|---|
| 0 · Cimientos | Scaffold Vite/React/TS strict, IndexedDB (idb), i18n con ES por defecto (claves desde el día 1), PWA/offline, tema claro/oscuro, lint jsx-a11y, CI con axe | App vacía instalable, offline, 0 violaciones axe |
| 1 · Flujo de valor (MVP) | **F1** importar CSV (luego XLSX con carga diferida) + duplicados → **F5 básico** lista con búsqueda → **F2** reglas + reglas semilla → porción de **F4** "gasto por categoría del mes" + datos de ejemplo | Time-to-value < 3 min en E2E |
| 2 · Proteger | **F6** copia cifrada exportar/importar | Ida y vuelta cifrada sin pérdida; contraseña errónea falla limpiamente |
| 3 · Aprender y ver | **F2** aprendizaje (proponer regla al recategorizar) + **F4** completo (evolución, ingresos vs gastos, saldo) | ≥ 80 % categorizado tras 2.ª importación |
| 4 · Accionar | **F3** presupuestos con estados ok/cerca/superado | Estados correctos en límites (tests de frontera) |
| 5 · Escalar | **F5** 100k: virtualización, índices, benchmark | Filtrado < 200 ms con 100k en Pixel 7 |
| 6 · Completar | **F7** traducción EN completa; auditoría final **F8** WCAG 2.2 AA | Paridad de claves ES/EN; informe axe limpio |

**Checkpoint de validación** [SUPUESTO: recomendado]: tras la fase 1, 3–5 pruebas moderadas con el recorrido de la sección 2. Si el time-to-value supera 5 min o la detección de columnas falla en > 1 de cada 5 extractos, reinvertir en F1 antes de avanzar a la fase 3.

---

## 4. Supuestos a validar (registro)

| ID | Supuesto | Cómo validarlo | Cuándo |
|---|---|---|---|
| S1 | El usuario primario usa el móvil y 1–3 bancos españoles | Pruebas moderadas | Tras fase 1 |
| S2 | La privacidad (sin servidor) es motivo suficiente para aceptar la descarga manual del extracto | Entrevista tras la prueba | Tras fase 1 |
| S3 | ~50 reglas semilla categorizan ≥ 60 % de un extracto típico | Test sobre fixtures realistas | Fase 1 |
| S4 | La detección por nombre de cabecera + tipo de contenido cubre ≥ 90 % de bancos | Fixtures de 5+ bancos | Fase 1 |
| S5 | Los usuarios mantienen presupuestos mensuales | Pruebas moderadas | Antes de fase 4 |
| S6 | Hay usuarios con ~100k movimientos que justifican el esfuerzo de rendimiento | Requisito fijado por el brief; tratado como requisito demostrativo | — |
| S7 | Los tiempos del journey audit (sección 2) son realistas | Script E2E cronometrado | Fase 1 |

---

## 5. Siguientes pasos

1. Pasar este brief a `product-capability` para fijar invariantes: clave de deduplicación, esquema IndexedDB, formato y versión del archivo de copia cifrada.
2. Crear fixtures de extractos sintéticos de 5+ bancos españoles (CSV y XLSX) como base de tests de F1/F2.
3. Ejecutar la fase 0 con i18n, a11y y offline incluidos en la definición de terminado.
4. Verificar el journey de la sección 2 con `/browser-qa` al cerrar la fase 1.
