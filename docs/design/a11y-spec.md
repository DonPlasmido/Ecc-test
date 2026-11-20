# Especificación de accesibilidad WCAG 2.2 AA: Cuentas Claras

Estado: propuesta para implementación. Alcance: PWA React 19, Android-first (Pixel 7), claro/oscuro, ES/EN.
Fuentes: `docs/BRIEF.md`, `docs/architecture.md` §11 y §13, ADR-0008 (lista virtualizada), ADR-0011 (gráficos propios),
skills `accessibility` y `frontend-a11y`.

## 0. Cómo leer este documento

Cada punto lleva: **Criterio** (WCAG 2.2), **Requisito** (lo que debe cumplir el código) y **Verificación**.
Claves de verificación:

- **axe**: `@axe-core/playwright` en E2E (Pixel 7), 0 violaciones; el umbral global de §17 es más estricto que
  el de `architecture.md` §13 (serias/críticas), porque aquí se exige 0 en cualquier impacto con las etiquetas
  `wcag2a, wcag2aa, wcag21aa, wcag22aa`.
- **RTL**: test de componente con Testing Library + `user-event` + jest-dom (consultas por rol y nombre accesible,
  nunca por `data-testid` para lo que se verifica).
- **Manual**: prueba con TalkBack (Android/Chrome) y, en escritorio, NVDA + Firefox o VoiceOver + Safari, más teclado solo.

Limitaciones: axe y jsdom no detectan contraste real, orden de foco ni calidad de los anuncios; esos puntos llevan
siempre verificación manual. La lista virtualizada no pinta filas en jsdom sin `initialRect` (ADR-0008): los tests
RTL deben proporcionarlo y el scroll real se comprueba en Playwright.

### Reglas transversales (aplican a todo)

| # | Criterio | Requisito | Verificación |
|---|---|---|---|
| T1 | 1.3.1, 4.1.2 | Elemento nativo antes que ARIA. Prohibido `div`/`span` con `onClick` sin rol, `tabIndex` y teclado; `tabIndex` positivo prohibido. | ESLint `jsx-a11y` (modo `recommended`, en CI como error); RTL `getByRole` |
| T2 | 1.1.1 | Iconos decorativos `aria-hidden="true"`; botones solo-icono con `aria-label` traducido (i18n) | axe `button-name`; RTL `getByRole('button', {name})` |
| T3 | 1.3.1 | Un `<h1>` por pantalla, niveles sin saltos; landmarks: `<header>`, `<nav aria-label>`, `<main id="main">`, sin landmarks duplicados sin nombre | axe `heading-order`, `landmark-*`; RTL |
| T4 | 2.4.1 | Enlace "Saltar al contenido" como primer foco, visible al recibir foco, destino `#main` con `tabIndex={-1}`. Con router por hash (`#/ruta`) el enlace NO debe usar `href="#main"` (cambiaría la ruta): usar `onClick` que haga `main.focus()` | RTL (Tab, Enter, `document.activeElement`); manual |
| T5 | 2.4.2, 3.1.1 | `document.title` por ruta ("Movimientos - Cuentas Claras") y `<html lang>` coherente con el idioma activo (ver §16) | RTL por ruta; E2E |
| T6 | 2.4.3 | Cambio de ruta: mover el foco al `<h1>` de la nueva pantalla (`tabIndex={-1}`) y anunciar el título; no dejar el foco en un elemento desmontado | RTL (`expect(h1).toHaveFocus()`); manual |
| T7 | 2.4.7, 2.4.11, 2.4.13 | Indicador de foco global `:focus-visible`: contorno ≥ 2 px, contraste ≥ 3:1 frente al fondo adyacente en ambos temas, `outline-offset` ≥ 2 px. Prohibido `outline: none` sin sustituto | Manual (teclado) + revisión de tokens; Playwright captura de estilo calculado |
| T8 | 2.4.11 (Focus Not Obscured) | Ningún elemento enfocado queda totalmente oculto por cabecera fija, navegación inferior o toast: `scroll-padding-top/bottom` = altura de barras fijas + 8 px | Playwright: enfocar último control con Tab y comprobar `getBoundingClientRect` fuera de las barras |
| T9 | 1.4.3, 1.4.11 | Texto ≥ 4,5:1 (grande ≥ 3:1); componentes de UI, bordes de inputs, iconos informativos y barras/series ≥ 3:1, en claro y oscuro | Test unitario de tokens que calcula contraste de cada par (texto/fondo y UI/fondo) por tema; manual con Colour Contrast Analyser |
| T10 | 1.4.1 | Ningún estado (ok/cerca/superado, ingreso/gasto, error, seleccionado) se transmite solo por color: siempre texto, icono con nombre o patrón | RTL (texto presente); manual con simulador de daltonismo |
| T11 | 1.4.4, 1.4.10, 1.4.12 | Reflow a 320 px de ancho y zoom 400 % sin scroll bidireccional (salvo la tabla de vista previa, ver §1.3); texto escalable al 200 %; unidades `rem`/`em`, sin alturas fijas en contenedores de texto; con espaciado de texto WCAG aplicado no se pierde contenido | Playwright con viewport 320x640 y `page.evaluate` del CSS de espaciado; manual con tamaño de fuente 200 % de Android |
| T12 | 1.3.4 | Sin bloqueo de orientación en el manifiesto (no `orientation` fijo) | Revisión del manifiesto PWA |
| T13 | 1.4.13 | Contenido que aparece en hover/foco (tooltips, si existen) es descartable con Escape, mantenible y no desaparece al mover el puntero encima. ADR-0011 descarta tooltips ricos: preferir texto visible | RTL (Escape); manual |
| T14 | 2.5.1, 2.5.7 | Ninguna función depende de arrastrar ni de gestos multipunto; swipe para borrar/editar (si se añade) debe tener botón equivalente | Revisión de diseño; manual táctil |
| T15 | 3.2.6 | Ayuda y acciones recurrentes (idioma, copia de seguridad, ayuda) en el mismo lugar relativo en todas las pantallas | Revisión; E2E recorriendo rutas |
| T16 | 4.1.3 | Mensajes de estado mediante regiones vivas globales y persistentes (ver §13), nunca montadas junto con su contenido | RTL (`getByRole('status')` tras la acción) |

## 1. Importación

Pantalla: elegir archivo, vista previa, mapeo de columnas, confirmar, resultado.

### 1.1 Selector de archivo

| Criterio | Requisito | Verificación |
|---|---|---|
| 1.3.1, 3.3.2, 4.1.2 | `<input type="file" id="import-file" accept=".csv,.xlsx,.xls,text/csv">` con `<label htmlFor>` visible ("Archivo del extracto (CSV o XLSX)"). Prohibido ocultarlo con `display:none` y simularlo con un `div`. Si se estiliza, el input permanece en el árbol de accesibilidad (técnica `visually-hidden` + `:focus-within` en el contenedor para mostrar foco) o se usa un `<button>` que dispare `input.click()` además del input accesible | axe `label`; RTL `getByLabelText(/archivo del extracto/i)` con `userEvent.upload` |
| 2.1.1 | Zona "arrastrar y soltar" opcional y nunca única: el botón/input siempre disponible | RTL; manual teclado |
| 2.5.7 | Sin gestos de arrastre obligatorios; arrastrar es mejora | Revisión |
| 3.3.2 | Formatos admitidos y tamaño máximo en texto visible enlazado con `aria-describedby` al input | RTL `toHaveAccessibleDescription` |
| 3.3.1, 4.1.3 | Error de archivo (vacío, corrupto, formato no admitido): texto visible bajo el input, `id` enlazado en `aria-describedby`, `aria-invalid="true"`, y anuncio mediante `role="alert"`. Mensaje traducido a partir del código de error del dominio (el dominio no devuelve textos) | RTL (`getByRole('alert')`, `toHaveAccessibleErrorMessage` / description) |
| 4.1.3 | Progreso de lectura de archivos grandes: `<progress>` con nombre o `role="status"` "Leyendo extracto..." y resultado final anunciado ("Importados 1.250 movimientos, 12 duplicados omitidos", conforme a `architecture.md` §11) | RTL; manual con lector |
| 2.2.1 | Sin tiempos límite en el flujo de importación | Revisión |
| 3.3.4 | La importación es reversible ("deshacer lote", `architecture.md` §14); el botón de deshacer es alcanzable y anunciado tras el resultado | RTL; E2E |

### 1.2 Mapeo de columnas con `select`

| Criterio | Requisito | Verificación |
|---|---|---|
| 1.3.1, 3.3.2 | Un `<select>` nativo por rol de columna (Fecha, Concepto, Importe, Saldo) o por columna del archivo; cada uno con `<label>` visible y único: "Columna de fecha", o "Columna 3 (Fecha operación): usar como". Prohibido `aria-label` genérico "Seleccionar" repetido | axe `select-name`; RTL `getAllByRole('combobox')` con nombres distintos |
| 3.3.2 | Opción vacía explícita "No usar esta columna" (no una opción en blanco sin texto) | RTL |
| 4.1.2 | Usar `<select>` nativo (en Android abre el selector del sistema, accesible). Prohibido combobox custom salvo necesidad probada | Revisión |
| 3.3.1, 3.3.3 | Validación (falta fecha o importe, rol duplicado): lista de errores resumen con enlaces a cada campo + error junto al campo (`aria-describedby`, `aria-invalid`). Al enviar con errores, foco al resumen (`tabIndex={-1}`, `role="alert"` o foco programático) | RTL (`userEvent`, `toHaveFocus`) |
| 3.2.2 | Cambiar un `select` NO envía ni navega; actualiza la vista previa y se anuncia por región `status` ("Vista previa actualizada") con debounce | RTL (sin cambio de contexto); manual |
| 3.3.7 | Detección automática precargada y recordada: no volver a pedir un mapeo ya confirmado para el mismo formato en la misma sesión | RTL |
| 1.3.5 | Es un formulario sin datos personales; no aplica `autocomplete` | n/a |
| 2.5.8 | Cada `select` con alto táctil ≥ 44 px | Test de estilos; manual |

### 1.3 Tabla de vista previa

| Criterio | Requisito | Verificación |
|---|---|---|
| 1.3.1 | `<table>` semántica: `<caption>` ("Vista previa de las primeras 10 filas de 1.250"), `<thead>` con `<th scope="col">`, filas en `<tbody>`. Si se marca una columna como Fecha o Importe, la cabecera lo indica con texto, no solo color | axe `th-has-data-cells`; RTL `getByRole('table', {name})`, `getAllByRole('columnheader')` |
| 1.4.10 | Tabla ancha: contenedor con `overflow-x:auto`, `role="region"`, `tabIndex={0}`, `aria-labelledby` del caption (para que se pueda desplazar con teclado). Es la única excepción a no tener scroll horizontal (tabla de datos, 1.4.10) | axe `scrollable-region-focusable`; manual a 320 px |
| 1.3.1 | Texto del extracto es dato no confiable: solo texto, nunca `dangerouslySetInnerHTML`; textos largos con `overflow-wrap:anywhere` | RTL (cadena `<img onerror>` se muestra literal) |
| 1.4.1 | Filas con error de parseo (fecha inválida) marcadas con icono y texto "Fecha no válida" (visually-hidden mínimo), no solo fondo rojo | RTL |
| 1.3.2 | Importes alineados a la derecha con `Intl`; el valor negativo con signo "-" textual, no solo color rojo | RTL |
| 4.1.3 | Cambios en la vista previa (nuevo archivo, nuevo mapeo) se anuncian en la región `status`, no mueven el foco | RTL |

## 2. Lista virtualizada de 100.000 movimientos

Decisión de patrón (ADR-0008 admite `table` o `grid`): se usa **`role="grid"`** porque la lista es interactiva
(navegación por teclado entre filas, abrir edición). Una `table` no es navegable por flechas y no debe tener
elementos enfocables entre filas salvo controles. Si el equipo opta por `role="table"` (solo lectura), la navegación
se limita a un botón "Editar" por fila y se eliminan las secciones 2.3 y 2.4.

### 2.1 Estructura ARIA

```html
<div role="grid" aria-label="Movimientos" aria-rowcount="{total+1}" aria-colcount="5">
  <div role="row" aria-rowindex="1">           <!-- cabecera fija; fuera de la ventana virtual -->
    <div role="columnheader" aria-colindex="1" aria-sort="descending">Fecha</div> ...
  </div>
  <div role="row" aria-rowindex="{i+2}" tabindex="-1|0" aria-selected? aria-busy?>
    <div role="gridcell" aria-colindex="1">15/03/2026</div>
    <div role="gridcell" aria-colindex="2">MERCADONA ...</div> ...
  </div>
</div>
```

| Criterio | Requisito | Verificación |
|---|---|---|
| 1.3.1, 4.1.2 | Contenedor `role="grid"` con nombre accesible, `aria-rowcount` = total filtrado + 1 (cabecera) y `aria-colcount`. Un `-1` solo si el total es desconocido; aquí es siempre conocido por el índice en memoria | RTL: `toHaveAttribute('aria-rowcount', String(total+1))` |
| 1.3.1 | Cada fila renderizada lleva `aria-rowindex` absoluto en el conjunto filtrado (índice virtual + 2, cabecera = 1); cada celda `aria-colindex`. Si se usa `display:grid`/posicionamiento absoluto, los roles `row`/`gridcell`/`columnheader` deben ser explícitos | RTL: tras desplazar, la primera fila renderizada tiene el `aria-rowindex` esperado |
| 1.3.1 | La jerarquía `grid > row > cell` debe ser contigua en el DOM: el contenedor de desplazamiento y el espaciador de altura total NO pueden insertar un `div` sin `role="presentation"`/`none` entre `grid` y `row` (error típico con react-virtual) | axe `aria-required-children`, `aria-required-parent` |
| 1.3.1 | Orden del DOM = orden visual (no reordenar con `order` CSS ni `translateY` sin ajustar el orden de renderizado; renderizar en orden ascendente de índice) | RTL (orden de `aria-rowindex` creciente) |
| 4.1.2 | Cabecera: `columnheader` con `aria-sort` en la columna ordenada y control de orden como `<button>` dentro de la cabecera; el botón anuncia el orden resultante | RTL |
| 1.4.10 | La lista no fuerza scroll horizontal a 320 px: en móvil las columnas se reorganizan dentro de la fila (fecha + concepto en una línea, importe a la derecha, categoría debajo) manteniendo los roles de celda | Playwright a 320 px |
| 1.3.1 | Filas aún no cargadas (bloques de 100, ADR-0008): placeholder con `role="row"` `aria-rowindex` correcto, `aria-busy="true"` y una celda con texto visually-hidden "Cargando"; nunca filas vacías mudas | RTL con repositorio fake lento |

### 2.2 Altura fija y reflow (ADR-0008)

| Criterio | Requisito | Verificación |
|---|---|---|
| 1.4.4, 1.4.12 | Altura de fila 56 px (cómoda) / 44 px (compacta) basada en `rem` para que escale con el tamaño de fuente del sistema; con espaciado de texto aumentado el concepto se trunca con elipsis y el texto completo está en el diálogo de edición (ADR-0008). El truncado no debe ocultar información que solo exista en la fila: el nombre accesible de la fila contiene el concepto completo | Playwright con fuente 200 % (la fila crece, el virtualizador usa `rem`); RTL (`aria-label`/texto completo) |
| 1.4.4 | Si el tamaño de texto del sistema supera el 130 %, cambiar a una altura de fila mayor calculada desde `rem` (no px fijos) para evitar solapamientos | Manual |

### 2.3 Teclado

Un único punto de tabulación para toda la lista (roving tabindex): la fila activa tiene `tabIndex=0`, las demás `-1`.
Tab entra en la lista, otro Tab sale a lo siguiente (2.1.2: no hay trampa).

| Tecla | Efecto |
|---|---|
| Flecha abajo / arriba | Fila siguiente / anterior (foco real con `.focus()`, no `aria-activedescendant`, para que TalkBack lo siga) |
| Re Pág / Av Pág | Mueve un "viewport" de filas |
| Inicio / Fin | Primera/última celda de la fila (si hay controles dentro) |
| Ctrl+Inicio / Ctrl+Fin | Primera / última fila (de 100.000: `scrollToIndex`) |
| Enter o Espacio | Abre la edición de categoría de la fila (ver §3) |
| Escape | Si hay selección múltiple, la limpia; si no, nada |
| Tab / Shift+Tab | Salen de la lista |

| Criterio | Requisito | Verificación |
|---|---|---|
| 2.1.1 | Todas las acciones de fila alcanzables solo con teclado; patrón de la tabla anterior | RTL con `userEvent.keyboard('{ArrowDown}')`; Playwright |
| 2.1.2 | Sin trampa de teclado; Tab siempre sale | RTL |
| 2.1.4 | No hay atajos de una sola tecla (letras) sin poder desactivarlos; usar solo teclas de navegación del patrón grid | Revisión |
| 2.4.3, 2.4.7 | El foco se mantiene en la fila activa aunque salga de la ventana virtual: `rangeExtractor` debe incluir siempre el índice activo para que no se desmonte y el foco no se pierda a `body`. Al volver con Tab, el foco regresa a la última fila activa | RTL (desmontar/escoger rango, `activeElement`); Playwright con 100k |
| 2.4.11 | Al enfocar por teclado se hace `scrollToIndex(i, {align:'auto'})` y `scroll-padding` evita que la cabecera fija o la navegación inferior tapen la fila | Playwright (bounding boxes) |
| 3.2.1 | Enfocar una fila no abre nada ni cambia el contexto | RTL |
| 2.4.7 | Indicador de foco visible en la fila entera (contorno interior para que no lo recorte `overflow:hidden`) | Manual; captura visual |
| 2.5.8 | Si hay botón "Editar" visible por fila: ≥ 44x44 px de zona táctil (mínimo 24x24 con separación) | Playwright `boundingBox` |

### 2.4 Nombre accesible y lectura de fila

| Criterio | Requisito | Verificación |
|---|---|---|
| 1.3.1, 2.4.6 | Fila leída con coherencia: "Fila 1.204 de 100.000, 15/03/2026, MERCADONA, categoría Supermercado, importe menos 42,30 euros". Lo proporcionan las celdas y los `aria-rowindex`/`aria-rowcount`; no duplicar con un `aria-label` en la fila que oculte las celdas. Si se usa `aria-label` por fila para lectores móviles, debe ser equivalente al contenido | Manual TalkBack/NVDA; RTL `getByRole('row', {name})` |
| 1.1.1, 1.4.1 | Importe negativo/positivo: signo textual y texto "gasto"/"ingreso" para lectores (visually-hidden), no solo color rojo/verde | RTL |
| 1.3.1 | Movimiento sin categoría: texto "Sin categoría" visible | RTL |
| 4.1.2 | Estado de fila recién recategorizada o duplicada marcado con texto, no solo resalte | RTL |

### 2.5 Anuncio de resultados de filtro / búsqueda (live region)

| Criterio | Requisito | Verificación |
|---|---|---|
| 4.1.3 | Región `<div role="status" aria-live="polite" aria-atomic="true">` **siempre presente en el DOM** (vacía al montar, sin `hidden`/`display:none`) fuera de la lista virtualizada. Su texto se actualiza tras aplicar filtro o búsqueda: "1.234 movimientos encontrados" / "Ningún movimiento coincide" / "100.000 movimientos" al limpiar | RTL: `getByRole('status')` con `findByText` tras `userEvent.type` |
| 4.1.3 | Debounce del anuncio (~500-800 ms tras la última pulsación o cambio) para no saturar; solo se anuncia el resultado final y no cada letra. Usar un contador numérico formateado con `Intl.NumberFormat` | RTL con `vi.useFakeTimers` (un solo anuncio para ráfaga de teclas) |
| 4.1.3 | No usar `aria-live` en el propio contenedor virtual (las inserciones de filas al hacer scroll producirían ruido) | RTL (`grid` sin `aria-live`) |
| 4.1.2 | Filtros: `<fieldset><legend>` para grupos (tipo, categoría, rango de fechas); búsqueda `<input type="search">` con `<label>` visible; cada filtro activo mostrado como chip con botón "Quitar filtro X" (`aria-label` con el nombre del filtro) | RTL |
| 3.2.2 | Aplicar filtros es inmediato pero no mueve el foco; el foco no salta a la lista | RTL |
| 2.4.3 | Tras "Limpiar filtros", el foco va al campo de búsqueda | RTL |
| 3.3.7 | Los filtros se conservan al volver (query del hash, `architecture.md` §11) para no volver a introducirlos | RTL; E2E |
| 1.3.1 | Estado vacío: mensaje de texto con acción ("Limpiar filtros") dentro del área principal; no solo ilustración | RTL |

## 3. Edición de categoría

| Criterio | Requisito | Verificación |
|---|---|---|
| 4.1.2 | Control de categoría: `<select>` nativo si caben ≲ 15 categorías; con más, combobox según patrón APG (input `role="combobox"` con `aria-expanded`, `aria-controls`, `aria-activedescendant`, `listbox`) y probado con TalkBack. Preferir `<select>` | axe; RTL |
| 1.3.1, 3.3.2 | Label visible: "Categoría de MERCADONA 15/03/2026" o encabezado del diálogo + label "Categoría" | RTL `getByLabelText` |
| 2.4.3, 3.2.2 | Si la edición se hace en un diálogo (recomendado en móvil, el concepto completo aparece aquí): `<dialog>` modal con `showModal()` (ver §4 para foco). Si es en línea, el foco pasa al control al abrir y vuelve a la fila al cerrar | RTL |
| 4.1.3 | Al guardar: anuncio en `status` "Categoría cambiada a Supermercado" (además del posible diálogo de crear regla); la fila actualizada conserva el foco/índice | RTL |
| 3.3.4 | Cambio reversible: acción "Deshacer" en el toast (ver §8) | RTL |
| 2.5.8 | Opciones y botones ≥ 44 px de alto | Playwright |
| 3.3.7 | La categoría elegida se propone como valor de la regla (no se vuelve a pedir en §4) | RTL |

## 4. Diálogo "Crear regla"

Se muestra tras recategorizar a mano (BRIEF 2). No es modal obligatorio, pero se especifica como diálogo modal.

```html
<dialog aria-labelledby="rule-title" aria-describedby="rule-desc"> ... </dialog>
```

| Criterio | Requisito | Verificación |
|---|---|---|
| 4.1.2 | Elemento `<dialog>` abierto con `showModal()` (aporta `inert` al resto, focus trap nativo y `Escape`). Alternativa: `div role="dialog" aria-modal="true"` + `focus-trap-react`. En Android Chrome verificar que TalkBack no sale del diálogo | RTL (jsdom: `HTMLDialogElement.showModal` requiere polyfill/mock; probar el trap real en Playwright); manual TalkBack |
| 1.3.1, 4.1.2 | Nombre accesible (`aria-labelledby` -> título "Crear regla de categorización") y descripción con el efecto ("Concepto contiene MERCADONA -> Supermercado. Afectaría a 37 movimientos") | RTL `getByRole('dialog', {name})`, `toHaveAccessibleDescription` |
| 2.4.3 | Foco inicial: en el primer elemento útil, no en el botón destructivo; recomendado el campo "Texto que debe contener" o el título (`tabIndex={-1}`) si el texto es largo. Evitar `autoFocus` de React en elementos no visibles | RTL (`toHaveFocus`) |
| 2.1.2 | Tab/Shift+Tab ciclan dentro del diálogo; Escape cierra (equivale a "Ahora no"); sin trampa. El contenido de fondo no es alcanzable (inert) | Playwright: 20 Tab seguidos, el foco nunca sale; RTL |
| 2.4.3 | **Retorno de foco**: al cerrar (aceptar, cancelar o Escape) el foco vuelve al elemento que lo abrió, es decir, la fila/celda de categoría editada (guardar referencia o `rowIndex`; si el virtualizador desmontó la fila, volver a montarla vía `scrollToIndex` y enfocarla, sin dejar el foco en `body`) | RTL (`restores focus to the row`); Playwright con 100k |
| 3.3.2 | Campos del diálogo (texto de coincidencia, categoría, prioridad) con `<label>` visible, ayuda enlazada (`aria-describedby`) | RTL |
| 3.3.1, 3.3.3 | Validación (texto vacío, regla duplicada): mensaje textual enlazado con `aria-describedby`, `aria-invalid`, `role="alert"` en el mensaje | RTL |
| 4.1.3 | Resultado ("Regla creada. 37 movimientos recategorizados") anunciado en `status` global tras cerrar | RTL |
| 3.3.4 | La aplicación masiva es reversible ("Deshacer") antes de ser definitiva | RTL; E2E |
| 1.4.10 | A 320 px y zoom 400 % el diálogo cabe: `max-height:100dvh`, contenido desplazable con scroll vertical, botones accesibles | Playwright |
| 2.5.8 | Botones "Crear regla" / "Ahora no" ≥ 44 px, con separación; el botón primario no es la única salida (hay "Ahora no") | Playwright |
| 2.2.1 | El diálogo no se cierra solo por tiempo | Revisión |
| 1.4.13 | No depende de hover | n/a |

## 5. Barras de presupuesto

Componente `CategoryBars` (lista HTML con barras CSS; ADR-0011), estados ok / cerca (≥ 80 %) / superado (≥ 100 %).

```html
<ul aria-label="Presupuestos de marzo 2026">
  <li>
    <span>Supermercado</span>
    <span>320 € de 400 € (80 %) - Cerca del límite</span>
    <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="80"
         aria-valuetext="320 euros de 400, 80 por ciento, cerca del límite" aria-labelledby="...">
```

| Criterio | Requisito | Verificación |
|---|---|---|
| 1.4.1 | Estado transmitido con **texto visible** ("Superado", "Cerca del límite", "Dentro del presupuesto") más un icono distinto por estado (con forma distinta, `aria-hidden`), nunca solo color verde/ámbar/rojo | RTL (`getByText(/superado/i)`); manual con filtro de daltonismo |
| 1.4.11 | Relleno de barra frente al fondo del carril ≥ 3:1 en ambos temas; borde de la barra ≥ 3:1 si el relleno no lo alcanza; marcador adicional (patrón de rayas o línea del 100 %) para superado | Test de contraste de tokens; manual |
| 1.1.1, 4.1.2 | Si se usa `role="progressbar"`: nombre accesible (`aria-labelledby` -> categoría), `aria-valuemin/max/now` y `aria-valuetext` traducido y con importes. `aria-valuenow` se limita a 0..100; el exceso (p. ej. 135 %) va en `aria-valuetext` y en el texto. Alternativa más simple y robusta: `<meter>` o dejar la barra `aria-hidden` y que el texto lo diga todo | RTL (`getByRole('progressbar', {name})` con `toHaveAttribute`); axe `aria-progressbar-name` |
| 1.3.1 | Lista como `<ul>`/`<li>` ordenada por gravedad; el total de superados resumido arriba ("2 categorías superadas") en `<h2>` o texto | RTL |
| 1.3.3 | Instrucciones y estado no dependen solo de la posición/longitud de la barra | Revisión |
| 4.1.3 | Al guardar un presupuesto o tras una importación que cambia su estado, anunciar "Presupuesto de Supermercado superado" una vez en `status` (polite) | RTL |
| 1.4.3 | Texto del estado ≥ 4,5:1 sobre el fondo de la tarjeta, no sobre el relleno de color (o con contraste calculado sobre él) | Test de tokens |
| 1.4.4, 1.4.10 | Cantidades largas con `Intl` no rompen el diseño a 320 px (texto en varias líneas) | Playwright |
| 2.3.3 / reduced motion | Animación del relleno solo si `prefers-reduced-motion: no-preference` (ver §14) | Playwright con `reducedMotion:'reduce'` |

## 6. Gráficos del panel

Componentes: `CategoryBars`, `MonthlyColumns`, `IncomeVsExpense`, `BalanceLine` (ADR-0011). `DashboardData` ya agregado
(≤ 24 puntos).

```html
<figure>
  <figcaption id="c1">Evolución mensual de gastos, últimos 12 meses</figcaption>
  <svg role="img" aria-labelledby="c1-t c1-d" viewBox="...">
    <title id="c1-t">Gasto mensual, de abril 2025 a marzo 2026</title>
    <desc id="c1-d">Máximo 1.850 € en diciembre; mínimo 920 € en agosto; tendencia al alza.</desc> ...
  </svg>
  <button type="button" aria-expanded="false" aria-controls="c1-table">Ver como tabla</button>
  <div id="c1-table" hidden> <table>...</table> </div>
</figure>
```

| Criterio | Requisito | Verificación |
|---|---|---|
| 1.1.1 | Cada SVG: `role="img"` con nombre accesible (`<title>` + `aria-labelledby`, o `aria-label`) que describe qué muestra y el rango, y `<desc>` con un resumen de datos relevantes (máximo, mínimo, tendencia). Elementos internos (barras, ejes, textos) `aria-hidden="true"` / `focusable="false"` para no leerse sueltos | RTL `getByRole('img', {name})`; axe `svg-img-alt` |
| 1.1.1, 1.3.1 | **Tabla alternativa** equivalente con todos los valores del gráfico (mismo `DashboardData`): `<table>` con `<caption>`, `<th scope>`, valores con `Intl`. Botón "Ver como tabla" con `aria-expanded` y `aria-controls`; al abrir, la tabla se inserta tras el botón y el foco permanece en el botón. Mejor aún: la tabla está en el DOM siempre y el gráfico es `aria-hidden` para lectores si la tabla es visible; elegir una opción y aplicarla uniformemente | RTL (`getByRole('button',{name:/ver como tabla/i})`, `getByRole('table')` con mismos números que el gráfico); axe |
| 1.1.1 | El texto de la tabla y el resumen deben coincidir con los datos: test de coherencia (suma de la tabla = suma del gráfico) | Test unitario con `DashboardData` fijo |
| 1.4.1, 1.4.11 | Series distinguibles sin color: patrones (rayas/puntos), etiquetas de valor o leyenda con marcador de forma distinta; en `IncomeVsExpense` ingreso y gasto con patrón diferente además del color. Colores desde tokens CSS con ≥ 3:1 frente al fondo en claro y oscuro | Test de tokens; manual con daltonismo |
| 1.4.3 | Etiquetas de ejes y valores ≥ 4,5:1 y ≥ 12 px / `rem`; texto SVG con `font-size` relativo | Test de tokens |
| 1.4.4, 1.4.10 | Gráfico responsive: `viewBox` y ancho 100 %; a 320 px sin scroll horizontal (reducir ticks, rotar o abreviar etiquetas); la tabla alternativa puede desplazarse (§1.3) | Playwright 320 px |
| 1.3.1 | `CategoryBars` es una lista HTML (`<ul>`) con texto y valor visibles; no necesita `role=img`; barras `aria-hidden` y el valor en texto | RTL |
| 2.1.1 | Sin interacción solo por puntero (no hay tooltips ricos, ADR-0011): toda la información está en etiquetas o en la tabla | Revisión |
| 1.3.4, 1.4.10 | Leyenda como lista de texto, no dentro del SVG sin etiquetas accesibles | RTL |
| 3.1.2 | Formato numérico y de fecha con `Intl` según el idioma activo (coma decimal en ES, punto en EN) | RTL con ambos idiomas |
| 2.3.3 / reduced motion | Sin animaciones de entrada si el usuario pide reducir movimiento | Playwright |
| 1.4.1 | Datos vacíos: mensaje textual "Sin datos para este periodo" en vez de gráfico en blanco | RTL |

## 7. Diálogo de contraseña de la copia de seguridad

Dos modos: exportar (crear contraseña y confirmarla) e importar (introducir contraseña).

| Criterio | Requisito | Verificación |
|---|---|---|
| 4.1.2, 2.4.3 | `<dialog>` modal con las reglas de foco de §4: nombre ("Exportar copia cifrada" / "Importar copia"), foco inicial en el campo de contraseña, Escape cancela, retorno de foco al botón que lo abrió | RTL; Playwright |
| 1.3.1, 3.3.2 | Campos con `<label>` visible: "Contraseña", "Repetir contraseña" (solo exportar). `type="password"`, `autoComplete="new-password"` (exportar) o `"current-password"` (importar); `name` y `id` estables. **Prohibido** bloquear el pegado (permite gestores de contraseñas) | RTL (`toHaveAttribute('autocomplete', ...)`, `userEvent.paste`) |
| 1.3.5 | `autocomplete` correcto como se indica | RTL |
| 3.3.2 | **Requisitos visibles** de contraseña (longitud mínima, p. ej. 12 caracteres, y aviso "Si la olvidas no se puede recuperar la copia"), en una lista de texto fija encima o debajo del campo, enlazada con `aria-describedby` desde el input. No aparecen solo tras fallar ni solo como `placeholder` | RTL (`toHaveAccessibleDescription` contiene los requisitos) |
| 1.4.1 | Cada requisito con estado cumplido/pendiente indicado por texto o icono con nombre ("cumplido"/"pendiente"), no solo color verde/rojo | RTL |
| 4.1.3 | El cambio de estado de los requisitos se anuncia de forma agrupada (`status`, debounce), no por cada tecla | RTL con timers falsos |
| 3.3.1 | Errores (contraseña corta, no coincide, contraseña errónea al importar, archivo alterado/versión no soportada): texto visible junto al campo; `id` único referenciado en `aria-describedby` del input (junto a la ayuda: `aria-describedby="pwd-help pwd-error"`), `aria-invalid="true"`, mensaje con `role="alert"`; foco al primer campo con error al enviar. Mensaje de contraseña errónea sin filtrar detalles técnicos y traducido desde el código de error | RTL (`toHaveAccessibleDescription`, `toBeInvalid`, `getByRole('alert')`) |
| 3.3.3 | Mensaje con sugerencia: "La contraseña debe tener al menos 12 caracteres. Añade 3 más." | RTL |
| 3.3.8 | Autenticación accesible (mínimo): no exigir pruebas cognitivas (acertijos, transcribir caracteres); permitir pegar y gestor de contraseñas | RTL |
| 3.3.7 | "Repetir contraseña" es una confirmación necesaria de seguridad (excepción permitida por 3.3.7); alternativa preferible: botón "Mostrar contraseña" y un solo campo | Revisión |
| 1.1.1, 4.1.2 | Botón "Mostrar contraseña": `<button type="button" aria-pressed>` o checkbox "Mostrar contraseña" con label; cambia `type` password/text sin perder el foco ni el valor | RTL |
| 4.1.3 | Progreso de cifrado/descifrado (PBKDF2/Argon, puede tardar): `role="status"` "Cifrando copia...", botones deshabilitados con `aria-disabled` (preferible a `disabled` para no perder el foco), y resultado final anunciado ("Copia guardada") | RTL; manual |
| 2.2.1 | Sin límite de tiempo | Revisión |
| 2.5.8 | Botones y checkbox ≥ 44 px | Playwright |

## 8. Toasts (notificaciones)

| Criterio | Requisito | Verificación |
|---|---|---|
| 4.1.3 | Contenedor de toasts **persistente en el DOM** desde el inicio, con `role="status"` + `aria-live="polite"` para éxito/información; `role="alert"` (assertive) únicamente para errores que impiden continuar. Insertar el texto después de montar el contenedor (si se monta con el contenido, muchos lectores no lo anuncian) | RTL (`getByRole('status')` contiene el texto tras la acción) |
| 2.2.1, 2.2.2 | Un toast con acción (p. ej. "Deshacer") **no desaparece solo** en pocos segundos: duración ≥ 10 s o permanece hasta cerrarse; pausa al pasar el puntero o al enfocar; nunca es la única vía para una acción importante (la acción también existe en la UI) | RTL con timers falsos (no se cierra a los 5 s si tiene foco/hover) |
| 2.1.1, 2.4.3 | El toast no roba el foco. Si tiene botón "Deshacer" o "Cerrar", es alcanzable por teclado en un orden razonable (atajo opcional: región "Notificaciones" como landmark `role="region" aria-label` con F6/atajo documentado) y Escape lo cierra cuando tiene el foco | RTL (`userEvent.tab`) |
| 2.4.11 | No tapa el foco: se posiciona por encima de la navegación inferior (`bottom = altura nav + safe-area`) y `scroll-padding-bottom` lo tiene en cuenta | Playwright |
| 1.4.1, 1.4.11 | Tipo (éxito/error) con icono con forma distinta y texto ("Error:") más color; contraste 4,5:1 del texto y 3:1 del icono/borde en ambos temas | Test de tokens |
| 1.4.4, 1.4.10 | Texto con reflow: puede ocupar varias líneas, sin ancho fijo ni truncado | Playwright 320 px / fuente 200 % |
| 2.5.8 | Botones del toast ≥ 44 px | Playwright |
| 4.1.3 | Máximo un toast anunciado a la vez (cola); no anunciar duplicados (p. ej. importación + filtro) | RTL |
| 2.3.3 | Entrada/salida sin movimiento si `prefers-reduced-motion` | Playwright |

## 9. Navegación inferior móvil

```html
<nav aria-label="Principal">
  <ul>
    <li><a href="#/movimientos" aria-current="page"><svg aria-hidden="true"/>Movimientos</a></li> ...
```

| Criterio | Requisito | Verificación |
|---|---|---|
| 1.3.1, 4.1.2 | `<nav aria-label="Principal">` con lista de enlaces (`<a href>` para rutas con hash; no botones con `onClick`), el enlace activo con `aria-current="page"`. Un solo `nav` "Principal" (si hay navegación lateral en escritorio, es la misma `nav` adaptada, no dos duplicadas visibles a la vez; si coexistieran, nombres distintos) | RTL `getByRole('navigation', {name:'Principal'})`, `getByRole('link', {current:'page'})`; axe `landmark-unique` |
| 1.1.1, 2.5.3 | Cada destino tiene **etiqueta de texto visible** (no solo icono); el nombre accesible incluye el texto visible (Label in Name). Iconos `aria-hidden` | RTL; axe |
| 2.5.8, 2.5.5 | Objetivos ≥ 44x44 px (recomendado 48 dp en Android); mínimo 24x24 con separación (SC 2.5.8). Toda la celda es el enlace | Playwright `boundingBox` ≥ 44 |
| 1.4.11 | Estado activo indicado con más que color (indicador de forma/subrayado/peso, además de `aria-current`); contraste ≥ 3:1 del indicador | Test de tokens; manual |
| 2.4.1, 2.4.3 | Orden del DOM: ubicada después de `<main>` o antes según el diseño, pero el orden de Tab coincide con el visual; "Saltar al contenido" la evita | Manual |
| 2.4.11 | Es una barra fija: no oculta el foco (T8) ni los últimos elementos del contenido (`padding-bottom` del `main` ≥ altura de la barra + safe-area) | Playwright |
| 1.4.10, 1.3.4 | En horizontal o a 400 % sigue siendo usable; no ocupa más del 25 % de la altura. Puede pasar a barra lateral en anchos ≥ 600 px | Playwright |
| 3.2.3 | Orden y etiquetas idénticos en todas las pantallas | E2E recorriendo rutas |
| 2.4.3 | Al navegar, foco al `<h1>` (T6) | RTL |
| 1.4.4 | Etiquetas no truncadas a 200 % de fuente (permitir 2 líneas o abreviar con `aria-label` equivalente) | Manual |
| 2.5.8 | Separación entre enlaces suficiente para evitar toques accidentales | Playwright |

## 10. Modo oscuro

| Criterio | Requisito | Verificación |
|---|---|---|
| 1.4.3, 1.4.11 | Tokens separados por tema; **todos** los pares texto/fondo y UI/fondo cumplen AA en claro **y** en oscuro (incluyendo estados deshabilitado informativo, foco, bordes de input, barras, series de gráfico, toasts, texto sobre botones). Evitar blanco puro sobre negro puro en bloques extensos (preferir gris muy oscuro) | Test unitario que itera los tokens y falla si < 4,5:1 / 3:1; axe `color-contrast` en ambos temas (`colorScheme: 'dark'` de Playwright) |
| 1.4.1 | Estados ok/cerca/superado y series siguen distinguibles sin color en oscuro | Manual |
| 2.4.13 | Indicador de foco con contraste ≥ 3:1 en ambos temas (variable de token distinta si hace falta) | Manual |
| 1.4.8 / 3.2.4 | Respeta `prefers-color-scheme` por defecto, con selector manual (Sistema / Claro / Oscuro) persistido; el selector es un `<fieldset><legend>Tema</legend>` con radios o un `<select>` con label | RTL; E2E |
| 4.1.2 | Cambiar tema no recarga ni mueve el foco; `color-scheme` y `<meta name="theme-color">` actualizados | RTL |
| 1.4.11 | Imágenes/SVG con colores fijos (logos) revisados en oscuro; usar `currentColor` o tokens | Manual |
| 1.4.1 | Modo de alto contraste forzado (`forced-colors: active`): bordes e iconos de estado siguen visibles (usar `border` real, no `box-shadow` solo; `forced-color-adjust` solo cuando sea imprescindible) | Playwright con `forcedColors:'active'` |

## 11. Movimiento reducido

| Criterio | Requisito | Verificación |
|---|---|---|
| 2.3.3 (AAA, buena práctica), 2.2.2 | Bajo `@media (prefers-reduced-motion: reduce)`: sin transiciones de página ni slide/zoom de diálogos y toasts, relleno de barras instantáneo, sin scroll suave (`scroll-behavior:auto`, `scrollToIndex` con `behavior:'auto'`). Las transiciones de opacidad cortas (< 150 ms) son aceptables; ningún parpadeo > 3 veces/s (2.3.1) | Playwright `emulateMedia({reducedMotion:'reduce'})` y comprobar `getComputedStyle().transitionDuration`/`animationName` |
| 2.2.2 | Cualquier animación que dure > 5 s (spinners de cifrado, importación) es pausable o se sustituye por texto de estado | Revisión |
| 4.1.2 | `useReducedMotion` (patrón de `frontend-a11y`) centraliza la lectura; reacciona al cambio en vivo (`change` del `MediaQueryList`) | RTL con `matchMedia` mockeado |
| 2.3.1 | Sin destellos | Revisión |

## 12. Objetivos táctiles (2.5.8 mínimo 24x24, recomendado 44)

| Criterio | Requisito | Verificación |
|---|---|---|
| 2.5.8 | **Mínimo obligatorio**: todo objetivo del puntero ≥ 24x24 CSS px, o con espaciado tal que un círculo de 24 px centrado en él no solape otro objetivo. Excepciones solo para enlaces en línea dentro de texto | Playwright: recorre `a, button, input, select, [role=button], [role=row][tabindex]` visibles y verifica `boundingBox` |
| 2.5.5 (AAA) / política del proyecto | **Objetivo del proyecto Android-first**: ≥ 44x44 CSS px en la navegación inferior, botones de diálogo, filas y selects (48 dp Material). Variable de token `--target-min: 2.75rem` (44 px) aplicada con `min-height/min-width`; el área puede ampliarse con padding o pseudo-elemento sin cambiar el aspecto del icono | Playwright (umbral 44 para elementos de la lista de "críticos"); manual con dedos |
| 2.5.8 | Controles pequeños (quitar chip, cerrar toast, mostrar contraseña, ordenar columna) con zona táctil ampliada a 44 px y ≥ 8 px entre vecinos | Playwright |
| 2.5.8 | Casillas y radios nativos con etiqueta clicable que cubre el área (el `<label>` forma parte del objetivo) | RTL (`userEvent.click(label)`) |
| 2.5.7, 2.5.2 | Las acciones se activan al soltar (`click`, no `pointerdown`), permitiendo cancelar | Revisión |
| 2.5.3 | Nombre accesible contiene el texto visible (control por voz: "Pulsar Crear regla") | RTL (`getByRole('button',{name})` con el texto visible); manual con Voice Access |
| 1.3.4 | Zoom del navegador no bloqueado (`<meta viewport>` sin `user-scalable=no` ni `maximum-scale=1`) | Revisión de `index.html`; axe `meta-viewport` |

## 13. Regiones vivas globales

Un único componente `LiveAnnouncer` montado en la raíz, antes del contenido:

- `<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">` (resultados, filtros, importación, cambios de categoría).
- `<div role="alert" class="sr-only">` (errores bloqueantes).
- API: `announce(mensaje, {priority})`, con deduplicación y limpieza (vaciar y reescribir con `requestAnimationFrame`/timeout para repetir el mismo texto).

| Criterio | Requisito | Verificación |
|---|---|---|
| 4.1.3 | Las regiones existen en el DOM al arrancar la app y nunca se desmontan al cambiar de ruta; clase `sr-only` (clip) y **no** `display:none`/`hidden` | RTL (render raíz y comprobar `getAllByRole('status')`) |
| 4.1.3 | Las regiones `role="status"` locales en componentes (filtro, importación) o bien usan este anunciador o están montadas siempre; solo se escribe texto, no se re-monta el nodo | RTL |
| 4.1.3 | Textos traducidos con `t()`; cambian de idioma sin recargar | RTL con `i18n.changeLanguage('en')` |
| 4.1.3 | Respeto del límite: máximo un mensaje polite por ~1 s; resultados de filtro, importación y estado de presupuesto no se solapan (cola) | RTL con timers falsos |

## 14. Formularios generales, configuración y estados vacíos

| Criterio | Requisito | Verificación |
|---|---|---|
| 3.3.2, 1.3.1 | Todo control con `<label htmlFor>`; `placeholder` nunca sustituye al label; campos obligatorios con `required` + `aria-required` y marca textual "(obligatorio)" (no solo `*`) | axe `label`; ESLint `jsx-a11y/label-has-associated-control` |
| 3.3.1, 3.3.3, 3.3.4 | Patrón de error único (`FieldError`): `id` derivado de `useId`, enlazado a `aria-describedby`, `aria-invalid`, `role="alert"` solo al aparecer tras enviar; resumen de errores al principio del formulario con foco al enviar | RTL |
| 1.3.5 | `autocomplete` donde aplique (no hay datos personales salvo contraseñas) | RTL |
| 3.3.7 | No pedir otra vez datos ya dados en el flujo (mapeo, filtros, categoría de la regla) | RTL |
| 2.4.6 | Encabezados y labels descriptivos, no "Haz clic aquí" | Revisión; ESLint `jsx-a11y/anchor-has-content` |
| 2.4.4 | Enlaces con propósito claro por nombre | RTL |

## 15. Presupuestos y copia de seguridad: acciones destructivas

| Criterio | Requisito | Verificación |
|---|---|---|
| 3.3.4 | Importar copia (sobrescribe datos): diálogo de confirmación con texto explícito y botón destructivo con nombre claro ("Reemplazar mis datos"), foco inicial en "Cancelar" | RTL |
| 4.1.2 | Botones destructivos descritos con `aria-describedby` (efecto) | RTL |
| 3.3.4 | Acción reversible o confirmada antes de ser definitiva | E2E |

## 16. Idioma de la página (ES/EN)

| Criterio | Requisito | Verificación |
|---|---|---|
| 3.1.1 | `<html lang="es">` por defecto en `index.html`; al cambiar el idioma (i18next `languageChanged`) se actualiza `document.documentElement.lang` a `"en"`/`"es"` **y** `document.title` en el mismo ciclo, incluido el cambio al cargar el paquete `en` bajo demanda (actualizar cuando el recurso esté listo, no antes, para no leer inglés con voz española) | RTL: `await changeLanguage('en')` y `expect(document.documentElement).toHaveAttribute('lang','en')`; E2E del flujo ES/EN |
| 3.1.1 | El idioma elegido persiste y se aplica **antes del primer render** (script o lectura temprana) para evitar el parpadeo con `lang` incorrecto y respetar `navigator.language` si no hay preferencia | E2E (recarga); revisión |
| 3.1.2 | Fragmentos en otro idioma dentro de la página (p. ej. concepto bancario en español con interfaz inglesa, o nombre propio) se marcan `lang="es"` si son frases completas; los datos del extracto del usuario se dejan sin marcar salvo evidencia | Revisión; RTL |
| 3.2.2, 4.1.2 | Selector de idioma: `<select>` con `<label>` ("Idioma / Language") o grupo de botones con `aria-pressed`; cada opción escrita en su propio idioma con atributo `lang` ("Español", `lang="es"`; "English", `lang="en"`); el cambio no recarga la página ni mueve el foco; se anuncia en `status` ("Idioma cambiado a English") en el idioma nuevo | RTL (`getByRole('combobox',{name})`); manual |
| 3.2.6 | El selector está siempre en el mismo sitio (Ajustes y, si procede, cabecera) | E2E |
| 3.1.2, 1.3.1 | `Intl` (números, fechas, moneda) y `aria-label`/`title`/`<desc>` de SVG/tablas se traducen también; no quedan cadenas fijas en español tras cambiar a inglés. Test que recorre el DOM con idioma `en` y busca texto español conocido | Test RTL/E2E (smoke de i18n); manual |
| 3.1.1 | `manifest.webmanifest` con `lang:"es"`; el `title` del documento traducido | Revisión |
| 3.1.5 / 3.3.1 | Mensajes de error del dominio como códigos traducidos a ambos idiomas; test de que existe clave en `es` y `en` para cada código | Test unitario de claves i18n |

## 17. Estrategia de verificación

1. **Estática**: `eslint-plugin-jsx-a11y` 6.10.2 en modo estricto, error en CI.
2. **Componentes (RTL, ≥ 80 %, `architecture.md` §13)**: consultas por rol y nombre; para cada componente de este documento
   al menos un test de nombre/rol, uno de teclado y uno de foco/anuncio. Mock de `matchMedia`, `HTMLDialogElement`
   (o polyfill) y `initialRect` del virtualizador.
3. **E2E (Playwright, Pixel 7)**: `AxeBuilder` con etiquetas `wcag2a, wcag2aa, wcag21aa, wcag22aa` en cada pantalla y en
   cada diálogo **abierto**, en claro/oscuro y ES/EN, más `reducedMotion` y `forcedColors`; lista con 100k sembrados:
   navegación por teclado completa (Ctrl+Fin, Av Pág), foco no perdido y sin tareas largas.
4. **Manual (cada release)**: TalkBack en Android (flujo completo importar, filtrar, editar, crear regla, exportar),
   NVDA/VoiceOver en escritorio, solo teclado, zoom 400 %, fuente 200 %, Voice Access, modo oscuro y contraste.
5. **Definición de hecho**: ningún punto de este documento sin test o sin casilla manual firmada; fallos axe = bloquean la PR.

## 18. Riesgos conocidos

- Roles `grid` virtualizados con TalkBack: comportamiento distinto a escritorio; fallback documentado (`role="table"` + botón
  "Editar" por fila) si las pruebas manuales fallan.
- Retorno de foco a filas desmontadas por el virtualizador.
- Contraste de series y barras en oscuro (tokens).
- Anuncios duplicados o ruidosos de filtros (debounce).
- `<dialog>`/inert y jsdom: el trap real solo se valida en Playwright.
- 100k filas: `aria-rowcount` correcto pero búsqueda por lectores de pantalla limitada a las filas montadas (la búsqueda de la app es la vía accesible).
