# Cuentas Claras — Sistema de diseño

Fuentes: [`design-tokens.json`](design-tokens.json) (DTCG) · [`src/ui/styles/tokens.css`](../../src/ui/styles/tokens.css) ·
[`base.css`](../../src/ui/styles/base.css) · [`components.css`](../../src/ui/styles/components.css) ·
vista previa: [`preview.html`](preview.html) (abrir el archivo en el navegador desde el repo; carga los CSS reales).

## 1. Dirección: «libro de cuentas»

| Pregunta | Respuesta |
| --- | --- |
| Propósito | Saber en segundos cuánto entra, cuánto sale y si un presupuesto se va a pasar; corregir categorías sin fricción. |
| Audiencia | Una persona, en su móvil Android, revisando sus extractos unos minutos a la semana. Escanea **cifras y conceptos**, no adornos. |
| Tono | Utilitario y sereno, editorial en lo justo: papel cálido, tinta oscura, renglones finos. Denso en listas, aireado en el panel. |
| Detalle memorable | Las cifras destacadas (saldo, totales del mes) usan la **serif del sistema** como en un libro de cuentas manuscrito; el resto es sans del sistema. Las tablas llevan rótulos en versalitas espaciadas y renglones de 8 % de tinta. |
| Restricciones | PWA offline, CSP `default-src 'self'` (sin fuentes ni imágenes remotas ni `data:`), WCAG 2.2 AA en ambos temas, 100k filas de altura fija (ADR-0008), gráficos propios con tokens (ADR-0011). |

Qué evitamos a propósito: degradados morados/azules, glassmorphism, blobs, tarjetas dentro de tarjetas, héroe
centrado, una sola tonalidad dominante. El color se usa **semánticamente** (acción, ingreso, gasto, aviso,
categoría), nunca decorativamente.

### Estados de contenido (contrato para las pantallas)

| Estado | Disparador | Respuesta visual | Siguiente acción |
| --- | --- | --- | --- |
| Cargando | Consulta al índice / IndexedDB | `.skeleton` con la misma geometría final (filas de `--row-height`, cifra de 10ch) | — |
| Vacío | Sin movimientos/presupuestos | `.empty` con icono propio, explicación y botón primario («Importar extracto») | Importar / crear |
| Error | Código de dominio (`errors.json`) | `.field__error` o `.toast--error` con icono + texto | Reintentar / corregir campo |
| Parcial | Importación con filas rechazadas | Datos visibles + `.status--near` con el recuento; detalle en tabla | Revisar filas |
| Éxito | Importación / copia guardada | `.toast--success` en región `aria-live` | Ver movimientos / deshacer |
| Permiso | `navigator.storage.persist()` denegado | Aviso en Ajustes con `.status--near` | Explicar y reintentar |

## 2. Tipografía

- **Sin Google Fonts**: la CSP (`default-src 'self'`) y el modo offline impiden fuentes remotas, y empaquetar una
  fuente añade ~30–60 KB al precache sin ganancia de legibilidad en Android (Roboto ya es excelente para UI).
- `--font-sans`: `system-ui` → Roboto en Android, SF en iOS, Segoe en Windows. Cuerpo 16 px (evita el zoom de
  iOS en inputs), 14 px para tablas densas, 12 px solo para metadatos y rótulos.
- `--font-figures`: serif del sistema (Noto Serif en Android, Iowan/Charter en Apple) **solo** para cifras
  grandes. Es el par tipográfico: contraste de familia, no de peso.
- Todas las cifras: `font-variant-numeric: tabular-nums lining-nums` (`.amount`, `.figure`, `.tabular`,
  `.table .num`), para que las columnas de importes se alineen y los contadores no «bailen».
- `text-wrap: balance` en títulos; `pretty` en párrafos, items y captions.

Escala (rem): 0.75 · 0.875 · 1 · 1.125 · 1.375 · 1.75 · 2.25. Saltos pequeños abajo (densidad) y grandes arriba
(jerarquía del panel).

## 3. Color y contraste medido

Ratios WCAG 2.x calculados con la fórmula de luminancia relativa (script de verificación en la vista previa, que
los recalcula en vivo desde las variables CSS).

### Claro (papel `#F5F2EA`, superficie `#FFFDF8`)

| Token | Hex | sobre surface | sobre bg | sobre sunken / soft |
| --- | --- | --- | --- | --- |
| text | `#1D1B16` | 16.92 | 15.38 | 13.94 |
| text-muted | `#5E5A50` | 6.76 | 6.15 | 5.57 |
| accent (azul tinta) | `#1F4E89` | 8.23 | 7.48 | 6.78 · on-accent `#FFF` 8.37 |
| **positive** | `#1B6B3A` | **6.43** | 5.85 | 5.30 · soft 5.60 |
| **negative** | `#B42318` | **6.47** | 5.88 | 5.33 · soft 5.49 |
| warning | `#8A5300` | 6.23 | 5.66 | 5.13 · soft 5.37 |
| border-strong | `#8A8473` | 3.67 | 3.33 | — (bordes de control, ≥3:1) |

### Oscuro (carbón `#121210`, superficie `#1B1A17`)

| Token | Hex | sobre surface | sobre bg | sobre sunken / soft |
| --- | --- | --- | --- | --- |
| text | `#EEEAE0` | 14.49 | 15.61 | 13.09 |
| text-muted | `#A9A496` | 6.99 | 7.54 | 6.32 |
| accent | `#8CB4EE` | 8.19 | 8.82 | 7.40 · on-accent `#0F1B2D` 8.13 |
| **positive** | `#6CCB8C` | **8.75** | 9.43 | 7.91 · soft 7.14 |
| **negative** | `#FF8E80` | **7.82** | 8.42 | 7.06 · soft 6.94 |
| warning | `#E9B44C` | 9.20 | 9.91 | 8.31 · soft 7.65 |
| border-strong | `#7A7567` | 3.79 | 4.08 | — |

**Importes**: positivo/negativo superan 4.5:1 en todas las superficies de ambos temas. Nunca dependen solo del
color: `MoneyText` debe formatear con `Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR',
signDisplay: 'exceptZero' })`, de modo que el signo (+ / −) es siempre visible; el cero va en `text-muted`.

**Categorías y gráficos** (`--color-cat-1…8`, `--color-cat-other`): 9 tonos de familias distintas (azul, teja,
verde, ciruela, ocre, turquesa, carmín, índigo, gris piedra). Contraste mínimo como marca gráfica: claro 4.84:1
sobre surface y 3.99:1 sobre sunken; oscuro 6.52:1 y 5.89:1 (todos ≥3:1, WCAG 1.4.11). Además del color, los chips
llevan texto y una muestra cuadrada (distinta del punto de estado); los gráficos llevan etiqueta y tabla (ADR-0011).
El dominio guarda el **nombre del token** (`cat-3`), no el hex.

**Presupuestos**: ok = positive, cerca = warning, superado = negative **+ rayado diagonal** + insignia con icono y
palabra («Superado»). La marca del 80 % se dibuja sobre la pista.

## 4. Espaciado, forma y profundidad

- Base 4 px: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64. Gutter móvil **16 px** con `env(safe-area-inset-*)`.
- Ritmo no uniforme: listas a 12/16, tarjetas del panel a 16 con secciones separadas por renglón, páginas a 24/32.
- Radios: 4 (foco), 6 (inputs), 10 (botones), 16 (tarjetas y hojas), píldora (chips, insignias). Concéntrico:
  tarjeta 16 ≈ input 6 + padding 10.
- Bordes para separar y enfocar; sombras transparentes de dos capas solo para elevar (tarjeta, toast, diálogo).
  En oscuro las sombras se vuelven negras y la elevación la marca `--color-surface-raised`.

## 5. Interacción y accesibilidad (make-interfaces-feel-better)

| Principio | Aplicación |
| --- | --- |
| Zona táctil | Controles de 44 px (`--hit-target`); `.btn--sm`, `.btn--icon` y chips amplían con pseudo-elemento sin crecer visualmente. |
| Estados | hover, `:active` con `scale(0.97)`, `:focus-visible` con anillo de 2 px y offset 2 px, `disabled`/`aria-disabled`, `aria-busy`, `aria-invalid`, `aria-pressed`, `aria-current`. |
| Transiciones | Propiedades explícitas, jamás `transition: all` ni `will-change: all`. Barra de presupuesto anima `transform: scaleX`, no `width`. |
| Números | Cifras tabulares en importes, tablas, contadores, inputs de importe. |
| Texto | `balance` en títulos, `pretty` en cuerpo; truncado con elipsis en conceptos de la lista. |
| Imágenes | Contorno neutro 1 px negro/blanco al 10 %. |
| Iconos | SVG inline propios (trazo 1.75, `currentColor`, clase `.icon`), sin librería ni `data:` URI; la flecha del select se dibuja con degradados. |
| Alto contraste | `forced-colors: active` delega bordes, foco y marcas en colores del sistema. |

## 6. Movimiento (motion-foundations, solo CSS)

Sin la librería `motion`: las transiciones de estado son CSS (re-dirigibles) y las entradas son keyframes cortos.

| Token | Valor | `prefers-reduced-motion: reduce` | Uso |
| --- | --- | --- | --- |
| `--duration-instant` | 80 ms | 0 ms | hover de filas |
| `--duration-fast` | 180 ms | 120 ms | botones, chips, inputs |
| `--duration-normal` | 350 ms | 150 ms | diálogo, toast, barra de presupuesto |
| `--duration-slow` | 600 ms | 150 ms | spinner |
| `--duration-exit` | 150 ms | 100 ms | salida de toast (más corta que la entrada) |
| `--ease-smooth` / `sharp` / `bounce` / `linear` | `cubic-bezier(.22,1,.36,1)` … | — | entradas / estados / (reservado) / progreso |
| `--motion-distance-*` | 4 / 8 / 16 px | 0 px | desplazamiento de entradas |
| `--motion-scale-press` / `subtle` | 0.97 / 0.98 | 1 | pulsación / tarjeta |

Con movimiento reducido no hay desplazamientos ni escalas: solo fundidos ≤ 150 ms; el skeleton queda estático y el
spinner (indicador esencial) gira lento.

## 7. Componentes base (`components.css`)

`.btn` (`--primary`, `--quiet`, `--danger`, `--sm`, `--icon`, `--block`) · `.field` + `.input` / `.select` /
`.textarea` / `.check` · `.card` (`__header`, `__section`, `--interactive`, `__link`) · `.chip` (`--cat-N`, botón
con `aria-pressed`) · `.table` / `.ledger-row` · `.budget-meter` (`data-status`, `--meter-value`) + `.status` ·
`.toast-region` / `.toast` · `.dialog` (`<dialog>` nativo: hoja inferior en móvil, centrado ≥ 40rem) · `.empty` ·
`.skeleton`.

Utilidades en `base.css`: `.app-shell`, `.app-header`, `.container`, `.page`, `.bottom-nav`, `.stack`, `.cluster`,
`.split`, `.grid-auto`, `.visually-hidden`, `.skip-link`, `.tabular`, `.truncate`, `.amount`, `.figure`, `.eyebrow`,
`.icon`.

## 8. Tema

Claro por defecto. `prefers-color-scheme: dark` aplica el oscuro salvo `<html data-theme="light">`;
`<html data-theme="dark">` lo fuerza. `ThemeProvider` solo escribe el atributo (o lo quita para «sistema»).
`color-scheme` se declara en cada tema para controles nativos y barras de desplazamiento.
