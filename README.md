# Cuentas Claras

Aplicación de finanzas personales **local-first**: importas los extractos de tu banco (CSV o XLSX), los
movimientos se categorizan con reglas, controlas presupuestos mensuales y haces copias cifradas. Todo se guarda
en el propio dispositivo. No hay servidor, cuentas de usuario ni sincronización en la nube.

Es una PWA (aplicación web instalable) hecha con React 19 y TypeScript, con arquitectura hexagonal.

## Funcionalidades

- **Importar extractos** en CSV (`;` o `,`, coma decimal, cabeceras variables) y XLSX. Detecta la fila de cabecera
  y las columnas, muestra una vista previa y permite corregir el mapeo antes de confirmar.
- **Deduplicación**: reimportar un extracto solapado no duplica movimientos. Dos movimientos idénticos el mismo día
  se conservan como distintos (contador de ocurrencia).
- **Categorías y reglas** por concepto, con prioridad. Al corregir la categoría de un movimiento a mano, la app
  propone crear una regla para el resto.
- **Presupuestos mensuales** por categoría, con estado (correcto, cerca del límite, superado).
- **Panel** con gasto por categoría, evolución mensual (hasta 24 meses), ingresos frente a gastos y saldos por cuenta.
- **Lista de movimientos** con búsqueda, filtros y edición de concepto y nota. Pensada para 100.000 movimientos
  (lista virtualizada, consultas sobre un índice en memoria).
- **Copia de seguridad cifrada** (`.ccbackup`) con contraseña, para exportar e importar todos los datos.
  La contraseña no se guarda; si la olvidas, la copia no se puede recuperar.
- **Borrado total** de los datos desde Ajustes.
- **Idiomas** español (por defecto) e inglés. **Modo claro y oscuro.**
- **Accesibilidad** como objetivo (WCAG 2.2 AA): foco gestionado en diálogos, etiquetas visibles, avisos
  `aria-live` en la vista previa de importación. Los E2E de la carpeta `e2e/` pasan por axe (`e2e/fixtures/a11y.ts`).
- **Sin conexión**: el app shell se precachea con el service worker.

## Privacidad

- **Nada sale del dispositivo.** Los movimientos se guardan en IndexedDB del navegador. La app no tiene analítica,
  ni publicidad, ni llamadas a APIs externas.
- **Política de contenido (CSP)** declarada en `index.html`:
  `default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'`.
  Con `connect-src 'self'` el navegador solo permite peticiones al propio origen. El código de la app solo hace una
  petición de datos: descargar un extracto de ejemplo desde `public/samples/` (`ImportPage.tsx`). `tests/indexHtml.csp.test.ts`
  vigila la política.
- **Los textos de los extractos son datos no confiables.** Se muestran siempre como texto (no hay
  `dangerouslySetInnerHTML`).
- **Copias cifradas**: PBKDF2-HMAC-SHA-256 con 600.000 iteraciones y sal aleatoria, y AES-GCM de 256 bits con
  IV aleatorio, todo con WebCrypto. La cabecera del archivo se autentica como datos adicionales.
- **Los datos de ejemplo son ficticios.** Ningún nombre, IBAN ni importe de `public/samples/` es real.

## Instalar en Android

1. Abre **https://donplasmido.github.io/Ecc-test/** en Chrome para Android.
2. Abre el menú de Chrome (los tres puntos) y elige **Instalar aplicación** o **Añadir a pantalla de inicio**
   (el texto depende de la versión de Chrome).
3. Se añade un icono "Cuentas Claras" que abre la app en pantalla completa, sin barra del navegador.

Los datos se guardan en el navegador de ese perfil. Para pasarlos a otro dispositivo, exporta una copia cifrada desde
**Ajustes** y restáurala en el otro.

## Formatos de banco soportados

Los formatos de ejemplo están en [`public/samples/`](public/samples/README.md), con los casos límite que cubren
cada uno (BOM, Windows-1252, preámbulos, columnas Debe/Haber, fechas con número de serie en Excel).

| Banco (ejemplo) | Ficheros |
|---|---|
| BBVA | `bbva.csv`, `bbva.xlsx` |
| Santander | `santander.csv` |
| CaixaBank | `caixabank.csv` (Windows-1252) |
| ING | `ing.csv`, `ing.xlsx` |
| Sabadell | `sabadell.csv` |

Los formatos de los ejemplos son reconstrucciones a partir de la investigación en
[`docs/research/search-first.md`](docs/research/search-first.md). Todavía no se han contrastado con extractos reales
de cada banco.

## Limitaciones conocidas

- **Solo euros** (`Currency = 'EUR'`).
- **Formatos**: CSV y XLSX. No se admiten `.xls` antiguo ni PDF.
- **Límites por archivo**: 20 MB y 200.000 filas.
- **Deduplicación por huella**: si el banco cambia el texto del concepto entre dos exportaciones, puede crear
  duplicados. Todavía no hay forma de deshacer una importación desde la interfaz.
- **Sin sincronización** entre dispositivos. La única forma de moverte datos es la copia cifrada.
- **Almacenamiento del navegador**: si el sistema borra los datos del sitio, se pierden. La app pide almacenamiento
  persistente, pero conviene hacer copias periódicas.
- **Sin integración bancaria**: no hay conexión con los bancos ni descarga automática de movimientos.
- **Guardas de arquitectura pendientes**: no hay regla de ESLint ni test que impida importar librerías en `domain`
  y `application`. Ver las desviaciones en [`docs/architecture.md`](docs/architecture.md).

## Desarrollo

Requisitos: Node.js 22 y npm (ver `.github/workflows/ci.yml`).

```bash
npm ci
npm run dev          # http://localhost:5173/Ecc-test/
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite (puerto 5173, base `/Ecc-test/`) |
| `npm run build` | Comprueba tipos (`tsc --noEmit`) y compila a `dist/` |
| `npm run preview` | Sirve `dist/` en local (puerto 4173 por defecto) |
| `npm test` | Tests unitarios e integración con Vitest (jsdom, fake-indexeddb) |
| `npm run test:watch` | Vitest en modo observación |
| `npm run test:coverage` | Tests con cobertura y umbral del 80 % en `domain`, `application` e `infrastructure` |
| `npm run typecheck` | Solo comprobación de tipos |
| `npm run lint` | ESLint (incluye reglas de React hooks y accesibilidad jsx-a11y) |
| `npm run e2e` | Playwright con el perfil Pixel 7 sobre una build en `dist-e2e/`, puerto `E2E_PORT` (4173) |
| `npm run bench` | Benchmarks con tinybench (índice, dedup, parseo) |

Todos los scripts (`lint`, `typecheck`, `test:coverage`, `bench`, `build` y `e2e`) se ejecutan en CI en cada push;
`CI=1 npm run e2e` pasa 18/18 en Chromium con el perfil Pixel 7 (ver `docs/reviews/verification.md`).

## Arquitectura

1. Capas en `src/`: `domain` (puro) → `application` (casos de uso y puertos) → `infrastructure` (adaptadores) → `ui`.
2. `domain` no importa librerías ni navegador: dinero en céntimos (`Money`), fechas sin zona horaria (`IsoDate`).
3. Puertos de entrada (lo que ve la UI) y de salida (repositorios, parser, cifrado, reloj, ids).
4. `composition/` es el único sitio que conoce los adaptadores concretos (`createContainer`, `buildContainer`).
5. Errores esperados como `Result<T, DomainError>`: el dominio devuelve códigos y la UI los traduce con i18next.
6. Persistencia en IndexedDB con `idb`: 8 stores y un índice único `byDedupKey` para la deduplicación.
7. Índice de lectura en memoria (TypedArrays) para el panel, los totales y la lista de 100.000 movimientos.
8. Importación: parseo, mapeo de columnas, claves de dedup, categorización y escritura en una transacción.
9. UI en React 19 con rutas por hash, carga diferida por ruta y estado sin librería global.
10. Copia cifrada `.ccbackup` con WebCrypto. Detalle en [`docs/architecture.md`](docs/architecture.md) y decisiones en
    [`docs/adr/`](docs/adr/README.md). Mapas de código en [`docs/CODEMAPS/`](docs/CODEMAPS/INDEX.md).

## Calidad

Cifras de la revisión del 2026-11-20 (`npx vitest run` y `npm run test:coverage`):

- **1.133 tests** en **70 archivos** de test, todos en verde.
- **Cobertura** de `src/domain`, `src/application` e `src/infrastructure`: 99,07 % sentencias, 96,26 % ramas,
  99,77 % funciones y 99,68 % líneas.
- **E2E**: 8 archivos de especificación (`e2e/*.spec.ts`), 18 tests en verde sobre Pixel 7 y con axe, incluida una importación real de 100.000 movimientos.
  No se han ejecutado en esta revisión.
- **Build** de producción correcto. En esta revisión, `dist/index.html` referencia `/Ecc-test/assets/` (el paso de CI
  lo comprueba con `grep`).
- **Lint**: 4 errores pendientes (ver Limitaciones).

## Cómo se construyó

Este proyecto se desarrolló con **Claude Code** y el kit **ECC** instalado en `.claude/` (ver
[`.claude/ECC-INSTALL.md`](.claude/ECC-INSTALL.md): skills, comandos, agentes y reglas). Se usaron **decenas de
subagentes** para planificar, diseñar la arquitectura, escribir los tests antes que el código (TDD), revisar
seguridad, accesibilidad y TypeScript, y mantener la documentación. El punto de partida está en
[`docs/BRIEF.md`](docs/BRIEF.md) y el registro de decisiones en [`docs/adr/`](docs/adr/README.md).
