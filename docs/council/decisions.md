# Consejo de decisiones — Cuentas Claras

Fecha: 2026-11-17 · Skill aplicada: `council` (`.claude/skills/council/SKILL.md`) · Fuente de contexto: `docs/BRIEF.md`.

> **Nota de método (transparencia).** La skill pide lanzar Skeptic, Pragmatist y Critic como subagentes
> independientes. En este entorno no había herramienta para lanzar subagentes, así que las tres voces
> externas se redactaron en el mismo contexto, en este orden: primero la posición del Architect
> (escrita antes que las demás, según el paso 3) y después cada voz con un rol estricto. Por eso la
> protección contra el anclaje es **más débil** que la que prevé la skill. Si alguna decisión resulta
> delicada, conviene repetir la sesión con subagentes reales.
>
> **Versiones.** Solo están verificadas (publicadas hace ≥ 2 semanas) las versiones listadas en el brief.
> Cualquier otra librería que se mencione aquí (zustand, @tanstack/react-virtual, Chart.js) **no está
> verificada**: antes de adoptarla habría que comprobar en npm la fecha de publicación de la versión exacta.

---

## Decisión 1 — Estado de la UI: React context + hooks sobre repositorios vs. librería (zustand, etc.)

**Pregunta.** ¿Cómo se gestiona el estado en la UI de una PWA local-first cuya fuente de verdad es IndexedDB
(movimientos, reglas, presupuestos), con cambios masivos (importación, restaurar copia, aplicar reglas)?
**Éxito:** pocas re-renderizaciones, datos nunca obsoletos tras escrituras masivas, se puede probar con
`fake-indexeddb`, ninguna dependencia sin verificar.

## Council: Estado de la UI

**Architect:** No usar librería. Repositorios (`idb` 8.0.4) detrás de interfaces, un pequeño bus de cambios
(`subscribe(collection)`) y hooks basados en `useSyncExternalStore`. El context solo sirve para inyectar
dependencias (repositorios, ajustes, idioma, tema).
*Por qué:* casi todo el "estado" es en realidad persistido. `useSyncExternalStore` ya resuelve las
suscripciones selectivas sin dependencias, y el patrón Repository del proyecto hace triviales los mocks.

**Skeptic:** El planteamiento confunde dos cosas. La UI apenas tiene estado propio (filtros, selección,
diálogos). El problema real es **invalidar caché de consultas** a IndexedDB. Propone un contador de versión
por colección más un hook `useQuery(collection, fn)`, y nada más.
*Por qué:* zustand resolvería un problema (estado global mutable en memoria) que esta app casi no tiene.

**Pragmatist:** zustand (unos 1 KB, API mínima) evita los problemas habituales del context, que vuelve a
renderizar a todos sus consumidores. Aun así, **no está en la lista verificada**, y escribir el store a mano
cuesta unas 40 líneas. Acepta prescindir de librería si el hook queda probado.
*Por qué:* valora tener devtools y un patrón conocido, pero no tanto como para saltarse la restricción de versiones.

**Critic:** Ve tres modos de fallo:
- (a) Si el context guarda datos, cada cambio vuelve a renderizar la lista de 100k movimientos.
- (b) Varias pestañas abiertas: sin `BroadcastChannel`, una muestra datos obsoletos tras una importación hecha en otra.
- (c) Restaurar una copia o reimportar debe invalidar **todo** a la vez, no colección por colección.
*Por qué:* el diseño falla en estos bordes, no en el camino feliz.

### Veredicto
- **Consenso:** el context se usa solo para inyectar dependencias, nunca como contenedor de datos.
  Fuente de verdad = IndexedDB mediante repositorios.
- **Strongest dissent:** el Pragmatist, que prefiere zustand por madurez y devtools. Se rechaza porque no
  está verificado y porque `useSyncExternalStore` cubre la misma necesidad.
- **Premise check:** el Skeptic replanteó bien la pregunta ("caché de consultas", no "estado global") y
  cambió la recomendación: se añade la invalidación por versión de colección.
- **Recomendación:** repositorios + `ChangeBus` (eventos `changed(collection)` y `changed('*')` para
  restaurar/importar, replicados por `BroadcastChannel` entre pestañas) + hooks `useSyncExternalStore`
  (`useQuery`, `useSetting`). El estado efímero de pantalla (filtros, selección) vive en `useState` local
  o en la URL (`react-router-dom` 7.18.5 ya está verificado).

**Condiciones para revisar:** (1) aparecen más de 3 stores en memoria con dependencias cruzadas;
(2) el profiler muestra re-renderizaciones evitables que no se arreglan con selectores; (3) se necesita
time-travel o devtools para depurar. En ese caso se evalúa zustand **tras verificar** una versión publicada
hace ≥ 2 semanas.

---

## Decisión 2 — Lista de 100.000 movimientos: virtualización a mano vs. librería; paginación por cursor en IndexedDB

**Pregunta.** ¿Cómo se consigue una lista fluida en un Pixel 7, con búsqueda, filtros, edición y
accesibilidad, para 100k movimientos? ¿Virtualizar a mano o con librería? ¿Se pagina con cursor en IndexedDB?
**Éxito:** desplazamiento a 60 fps, filtro en menos de 100 ms, memoria acotada y WCAG 2.2 AA
(teclado, lector de pantalla, texto ampliado al 200 %).

## Council: Lista de 100k movimientos

**Architect:** Virtualización hecha a mano con **altura de fila fija** (un hook `useWindowedRows` de unas
100 líneas, probado), y paginación por cursor sobre el índice compuesto `[date, id]` para cargar en bloques.
*Por qué:* las filas son uniformes, no hay ninguna librería verificada y el algoritmo con altura fija es
trivial (`start = floor(scrollTop / h)`).

**Skeptic:** La paginación por cursor resuelve un problema inexistente: 100k filas ligeras ocupan unos
10–20 MB. Además, la búsqueda "concepto contiene X" **no puede usar índices** de IndexedDB y obliga a
recorrerlo todo de cualquier forma. Lo más simple es cargar una proyección en memoria y filtrar y ordenar arrays.
*Por qué:* el cursor añade estado (posición, invalidación) sin acelerar las búsquedas.

**Pragmatist:** @tanstack/react-virtual (**no verificada**) está probada en producción y resuelve alturas
dinámicas, restauración del scroll y `scrollToIndex`. Lo hecho a mano suele fallar en esos detalles.
Si no se puede verificar, que sea a mano con altura fija y tests.
*Por qué:* la versión a mano solo compensa si las alturas son fijas de verdad.

**Critic:** Señala varios riesgos:
- (a) Con texto al 200 % (WCAG 1.4.4/1.4.10), una altura fija en px rompe la lista: tiene que ser en `rem`
  y recalcularse al cambiar el tamaño de fuente.
- (b) El foco se pierde cuando la fila enfocada se desmonta al desplazarse.
- (c) El lector de pantalla solo "ve" las filas montadas, así que hacen falta `aria-rowcount` y `aria-rowindex`.
- (d) Editar una fila a mitad de scroll no debe recargar los 100k.
- (e) Cargar todo de golpe bloquea el hilo principal en el arranque.
*Por qué:* los fallos de accesibilidad de las listas virtualizadas son los más caros de arreglar después.

### Veredicto
- **Consenso:** virtualizar es obligatorio. La altura fija es la que hace viable y segura la versión a mano.
- **Strongest dissent:** el Pragmatist, a favor de una librería que soporte alturas dinámicas. Sigue siendo
  válido si la altura fija deja de ser posible.
- **Premise check:** el Skeptic cuestionó el cursor como mecanismo de *consulta* y cambió la recomendación.
  El cursor se mantiene solo como mecanismo de **carga por bloques**, no de paginación de la vista.
- **Recomendación:**
  1. Al arrancar, recorrer el índice `[date, id]` con cursor en bloques de unos 5.000 registros, cediendo
     el hilo entre bloques, para construir una proyección en memoria
     (`id, date, amount, categoryId, normalizedConcept`).
  2. Filtrar y ordenar en memoria. Si un benchmark con `tinybench` supera 50 ms, pasar esa parte a un Web Worker.
  3. Virtualización a mano con altura de fila fija en `rem`, medida con `ResizeObserver` sobre una fila
     testigo, y overscan.
  4. Usar `role="grid"` con `aria-rowcount` y `aria-rowindex`, foco *roving* que se conserva por `id`
     (al desmontarse una fila, el foco pasa al contenedor y se restaura), y un resumen del recuento de
     resultados en una región `aria-live`.
  5. Las ediciones actualizan la proyección por `id` y emiten `changed('movements')`.

**Condiciones para revisar:** (1) el diseño exige filas de altura variable (conceptos en varias líneas)
→ adoptar @tanstack/react-virtual tras verificarla; (2) la proyección supera unos 100 MB o el arranque pasa
de 1 s en el Pixel 7 → consultas por índice más ventana con cursor; (3) los tests de Playwright o axe
detectan pérdida de foco o anuncios incorrectos que no se corrigen en dos iteraciones.

---

## Decisión 3 — Gráficos: recharts (en el brief) vs. Chart.js vs. SVG propio

**Pregunta.** El panel necesita cuatro vistas: gasto por categoría, evolución mensual, ingresos frente a
gastos y saldo. ¿Qué tecnología, considerando WCAG 2.2 AA, modo claro/oscuro, i18n y el tamaño del bundle
(PWA precacheada, móvil)?
**Éxito:** accesible con teclado y lector de pantalla, sin bloquear la carga inicial y mantenible.

## Council: Gráficos

**Architect:** SVG propio para las cuatro vistas, con una tabla de datos equivalente siempre disponible.
*Por qué:* son gráficos simples (barras y líneas). El SVG propio da control total de la semántica
(`role="img"`, `<title>`, `<desc>`), de los colores mediante tokens CSS para el modo oscuro y del formato
`Intl` para i18n, y no suma peso al bundle.
*Riesgo:* el coste de mantenimiento si crece la interactividad.

**Skeptic:** ¿Hace falta un "gráfico" para gastar por categoría? Una lista HTML con barras CSS (ancho en %)
y el importe en texto es más accesible que cualquier SVG. Solo la evolución temporal necesita de verdad un eje.
*Por qué:* la forma más accesible de un gráfico suele ser una tabla con barras.

**Pragmatist:** recharts 3.10.1 está **verificada**, trae ejes, tooltips y responsive, e incluye
`accessibilityLayer` (navegación con teclado). Si se carga en diferido en la ruta del panel, su peso
(un orden de 100 KB comprimido con sus dependencias de d3; se debe medir en el build real) no afecta
al primer render.
*Por qué:* es la única opción que se puede usar ya sin verificar nada más.

**Critic:** Chart.js dibuja en `<canvas>`: el lector de pantalla no ve nada sin un contenido alternativo
mantenido a mano, y además **no está verificado**, así que se descarta. Riesgos de recharts: tooltips que
dependen del puntero, contraste de las series en modo oscuro, el peso dentro del precache del PWA y que una
actualización mayor rompa el panel. En el SVG propio, el riesgo es reinventar ejes y escalas con errores de
redondeo y de fechas.
*Por qué:* la accesibilidad sobre canvas es una deuda permanente.

### Veredicto
- **Consenso:** Chart.js queda descartado (canvas, sin verificar). Toda vista debe tener una alternativa
  en tabla y no depender solo del color.
- **Strongest dissent:** el Pragmatist, por recharts. Es una opción válida y verificada; se rechaza para
  este alcance porque cuatro gráficos simples no justifican la dependencia, pero queda como alternativa preparada.
- **Premise check:** el Skeptic cambió la recomendación. "Gasto por categoría" y "presupuestos" se hacen
  como **listas HTML con barras CSS** (sin SVG), y el SVG solo se usa para las series temporales.
- **Recomendación:** componentes propios: `CategoryBars` (HTML/CSS), `MonthlyColumns`, `IncomeVsExpense`
  y `BalanceLine` (SVG). Cada uno incluye una tabla accesible (visible con un botón "Ver como tabla"),
  colores desde tokens CSS validados para contraste (≥ 3:1 en elementos gráficos), patrones o etiquetas
  además del color, y valores formateados con `Intl.NumberFormat` y `Intl.DateTimeFormat` según el idioma.
  Escalas y ticks en funciones puras con tests unitarios.

**Condiciones para revisar:** (1) aparecen más de 6 tipos de gráfico o interacciones como zoom, brush o
series apiladas complejas; (2) el código de gráficos supera unas 600 líneas o acumula errores de escalas
o fechas; (3) un usuario pide tooltips ricos. En cualquiera de estos casos se cambia a recharts 3.10.1
cargada en diferido, manteniendo las tablas alternativas.

---

## Decisión 4 — Aprendizaje de reglas a partir de una corrección manual

**Pregunta.** Cuando el usuario recategoriza un movimiento a mano, ¿qué regla "concepto contiene X →
Categoría" se propone? ¿Qué token se elige y cómo se evitan las reglas demasiado amplias?
**Éxito:** propuestas que el usuario acepta sin editar, ningún falso positivo silencioso y ninguna
corrección manual pisada.

## Council: Aprendizaje de reglas

**Architect:** El proceso es determinista:
1. Normalizar el concepto (mayúsculas, quitar tildes, colapsar espacios).
2. Quitar el ruido: fechas, números, tarjetas `****1234` y prefijos bancarios ("COMPRA TARJ.", "RECIBO",
   "TRANSFERENCIA", "PAGO EN", "BIZUM"…).
3. Generar candidatos de 1 a 3 tokens consecutivos.
4. Puntuar cada candidato contra el histórico por **precisión** (proporción de coincidencias que ya están
   o acabarían en la categoría destino) y **cobertura**.
5. Proponer el mejor y mostrar una vista previa.

*Por qué:* el histórico es la mejor prueba de lo amplia que sería una regla.
*Riesgo:* con poco histórico, la puntuación no discrimina.

**Skeptic:** Las heurísticas sobreajustan. Lo más simple es proponer el concepto normalizado sin números
y dejar que el usuario lo recorte. En "BIZUM DE JUAN", el token útil es la persona, no la marca: ninguna
lista de palabras vacías lo acierta siempre.
*Por qué:* el usuario sabe qué es "el comercio", y la propuesta debe ser editable, no inteligente.

**Pragmatist:** Para la v1 bastan las palabras vacías, el token restante más largo (≥ 3 letras, no
numérico) y una vista previa del tipo "afectaría a N movimientos; M cambiarían de categoría". Los n-gramas
con puntuación pueden esperar a v2 si la tasa de aceptación es baja.
*Por qué:* la vista previa con recuento ya frena las reglas amplias aunque el token no sea el ideal.

**Critic:** Señala varios riesgos:
- (a) "Contiene" como subcadena hace que `BAR` coincida con `BARCELONA`: hay que coincidir por
  **límite de token**.
- (b) Aplicar la regla en retroactivo nunca debe tocar movimientos con categoría puesta a mano
  (`categorySource: 'manual'`).
- (c) Una regla nueva puede entrar en conflicto con otra existente: ¿qué prioridad recibe?
- (d) Proponer en cada corrección acaba siendo molesto; si el usuario rechaza un patrón, no hay que volver
  a proponerlo.
- (e) Los conceptos en inglés o de otros bancos rompen la lista de prefijos.

*Por qué:* una regla amplia aceptada sin querer recategoriza miles de movimientos en silencio.

### Veredicto
- **Consenso:** se propone, nunca se crea automáticamente. Siempre con vista previa del impacto y con texto
  editable. Las categorías manuales son intocables.
- **Strongest dissent:** el Skeptic, que propone el concepto completo y que decida el usuario. Se acepta en
  parte: si ningún candidato supera los umbrales, se propone el concepto normalizado completo para editarlo.
- **Premise check:** el Critic (más que el Skeptic) cambió la recomendación: la coincidencia debe ser por
  límite de token, lo que afecta también al motor de reglas, no solo al aprendizaje.
- **Recomendación:**
  1. `normalizeConcept`, seguido de `stripNoise` (lista de prefijos y patrones versionada y probada,
     en español y en inglés).
  2. Candidatos de 1 a 3 tokens consecutivos (≥ 3 caracteres, no numéricos ni de la lista de ruido).
  3. Puntuación sobre el histórico: se descarta un candidato si coincide con más del 5 % de todos los
     movimientos o si su precisión es menor de 0,8. Se elige el de mayor precisión y, en caso de empate,
     el más específico (más tokens).
  4. Si ningún candidato pasa, se propone el concepto normalizado completo.
  5. Diálogo con el texto editable y el recuento "N coinciden; M cambiarían". Al aceptar, la regla se
     aplica solo a movimientos con `categorySource !== 'manual'`, con prioridad por encima de las reglas
     genéricas y por debajo de las creadas explícitamente por el usuario.
  6. Recordar los rechazos (par candidato → categoría) para no volver a proponerlos.
  7. Cambiar el motor de reglas a coincidencia por límite de token.

  Todo ello en funciones puras con tests de tabla sobre conceptos reales anonimizados.

**Condiciones para revisar:** (1) la tasa de aceptación sin edición es menor del 50 % en pruebas con
usuarios; (2) se reportan recategorizaciones indeseadas; (3) se piden reglas por importe, cuenta o
expresión regular. Entonces se amplía el modelo de regla (condiciones compuestas) en lugar de afinar
más la heurística.

---

## Resumen de veredictos

| # | Decisión | Veredicto | Revisar si… |
|---|---|---|---|
| 1 | Estado UI | Sin librería: repositorios + `ChangeBus` (+ `BroadcastChannel`) + hooks `useSyncExternalStore`; context solo para inyectar dependencias | más de 3 stores entrelazados o re-renders sin arreglo → zustand verificado |
| 2 | Lista 100k | Virtualización a mano, altura fija en `rem`, `role="grid"` accesible; cursor solo para carga por bloques y filtrado en memoria (Worker si > 50 ms) | alturas variables o memoria/arranque fuera de presupuesto |
| 3 | Gráficos | Propios: barras HTML/CSS + SVG para series temporales, con tabla alternativa; Chart.js descartado | más de 6 tipos o interacción rica → recharts 3.10.1 en diferido |
| 4 | Reglas | Proponer (nunca autocrear) un n-grama puntuado por precisión/cobertura, coincidencia por límite de token, vista previa, manuales intocables | aceptación < 50 % o recategorizaciones indeseadas |
