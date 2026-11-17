# Investigación previa (search-first) — Cuentas Claras

Fecha de la investigación: **2026-11-17**. Umbral de antigüedad de dependencias: publicadas **el 2026-11-03 o antes** (≥ 2 semanas).
Skill aplicada: `.claude/skills/search-first/SKILL.md` (preflight → necesidad → búsqueda → evaluación → decisión).

## 0. Preflight de canales

| Canal | Estado | Observaciones |
|---|---|---|
| Repositorio | Disponible | Solo existe `docs/BRIEF.md`; no hay código previo que reutilizar. |
| npm (`npm search`, `npm view`) | Disponible (npm 10.9.9) | Versiones y fechas de publicación verificadas con `npm view <pkg> time`. |
| GitHub `search/repositories` y `search/code` | Disponible | `gh auth status` informa de token inválido, pero las búsquedas responden. Se usaron ~12 búsquedas. |
| GitHub contenido de repos (`repos/...`, árboles) | **No disponible** | 403 "GitHub access to this repository is not enabled for this session". Solo se vieron fragmentos (`text_matches`) de la búsqueda de código. |
| Descargas semanales npm (`api.npmjs.org`) | **No disponible** | El proxy bloquea el host (403). La popularidad se aproxima con estrellas de GitHub. |
| Web general / documentación oficial (OWASP, MDN) | **No disponible** | Lo que dependa de ella se marca como "no verificado en esta sesión". |
| MCP / skills | Revisado | Ninguna skill ni MCP local cubre extractos bancarios, virtualización o cifrado de copias. |

---

## a) Importación de extractos bancarios españoles (CSV/XLSX)

### Búsqueda

- **npm**: `extracto bancario`, `spanish bank csv`, `norma 43`, `cuaderno 43`, `bbva csv`, `caixabank`, `ing direct csv`, `santander xlsx`, `bank statement parser csv`, `ofx parser`.
- **GitHub repos**: `bbva santander csv`, `extracto bancario`, `spanish bank statement`, `norma43`, `bank statement import spain`.
- **GitHub código** (fragmentos): cabeceras de BBVA, CaixaBank, Santander, ING y Sabadell.

### Candidatos

| Candidato | Versión / fecha | Licencia | Valoración |
|---|---|---|---|
| `norma43` (npm) | 1.0.1 · 2026-05-19 | **GPL-3.0-only** | Solo formato AEB-43 (texto de ancho fijo), no CSV/XLSX. La licencia GPL complica su uso. Se descarta. |
| `@frihet/aeb43-parser` (npm) | 0.1.0 · 2026-05-11 | Apache-2.0 | Solo Norma 43. Versión 0.x, un único release. Fuera del alcance (el brief pide CSV/XLSX). Podría servir en el futuro si se añade N43. |
| `ofx-js`, `ofx-data-extractor` | — | — | Formato OFX; los bancos españoles no lo exportan de forma habitual. Se descartan. |
| `KashaMalaga/KashaFlow` (GitHub, TS, MIT, 0★) | push 2026-05-13 | MIT | App local-first con importadores por banco (`src/lib/importers/ing.ts`, `abanca.ts`…). Sirve como **referencia** de formatos; sin paquete publicado ni comunidad. No se pudo leer el código completo (403). |
| `shewasxc/gestoriasync`, `rpadafo/actualbudget_spainbank_converter`, `ofxstatement-bbva`, `ai-parrot` (bbva.py), `family-accounting` (caixabank.py), `wealthfolio-importer` (sabadell.py) | varios | varios (AGPL, MIT…) | Scripts propios de cada proyecto, a menudo en Python. Útiles solo como **evidencia de cabeceras**. |
| `papaparse` | **5.7.0 · 2026-08-24** (la 5.7.1 es del 2026-11-11 y **no** cumple el umbral) | MIT | Analizador CSV de navegador maduro (13,6k★, push 2026-11-12). Detecta el delimitador, admite workers y streaming. Ya está en el brief. |
| `exceljs` | **4.4.0 · 2023-10-19** | MIT | Lectura de XLSX en el navegador (`browser: ./dist/exceljs.min.js`). Riesgos: sin releases desde 2023, último push 2025-01-21, 829 issues abiertas, 21,8 MB descomprimido. **No lee `.xls` (BIFF8)**. Ya está en el brief. |
| `read-excel-file` | 9.3.14 · 2026-10-29 (9.3.17 es demasiado reciente) | MIT | Alternativa ligera y mantenida (fflate + saxen), solo XLSX. Tiene una dependencia nueva (`worker-f`, publicada el 2026-11-17) en su árbol, así que no se recomienda sin revisarla. |
| `xlsx` (SheetJS en npm) | 0.18.5 · 2022-03-24 | Apache-2.0 | La versión de npm está congelada y tiene avisos de seguridad conocidos (prototype pollution y ReDoS en versiones < 0.19.3/0.20.2). Las versiones corregidas solo se distribuyen fuera de npm. **Se descarta.** |
| Detección de codificación (`jschardet` 4.1.0, `chardet` 2.2.0, `iconv-lite` 0.7.3) | — | — | **No hace falta**: el `TextDecoder` nativo admite `windows-1252`. |

**Conclusión**: no hay ningún paquete en npm ni en GitHub que importe CSV/XLSX de bancos españoles de forma genérica y mantenida. Lo que existe son importadores dentro de aplicaciones concretas, sin publicar y con 0–5★.

### Formatos observados (fragmentos de código público en GitHub)

> Fuente: fragmentos de `search/code`, no ficheros reales de los bancos. Los bancos cambian sus exportaciones sin aviso, así que **cada formato debe confirmarse con un extracto real** (anonimizado) antes de fijar los fixtures.

| Banco | Formato habitual | Cabecera observada | Notas |
|---|---|---|---|
| **BBVA** | XLSX (hoja "Informe BBVA") | `F.Valor` · `Fecha` · `Concepto` · `Movimiento` · `Importe` · `Divisa` · `Disponible` · `Observaciones` | La cabecera no está en la fila 1: un proyecto la sitúa en la fila 5, con los datos desde la 6 y empezando en la columna B. `Disponible` hace de saldo. `Movimiento` contiene un texto complementario al concepto. |
| **Santander** | XLSX / CSV | `Fecha Operación` · `Fecha Valor` · `Concepto` · `Importe` · `Saldo` (variante ampliada: `Divisa`, `Saldo`, `Divisa`, `Código`, `Número de documento`, `Referencia 1`, `Referencia 2`, `Información adicional`) | Hay columnas `Divisa` duplicadas y pueden aparecer columnas vacías en medio. Los importes pueden ser texto con coma decimal o celdas numéricas. Algunos PDF usan el signo menos U+2212. |
| **CaixaBank** | XLS/XLSX ("Movimientos de la cuenta") | `Fecha` · `Fecha valor` · `Movimiento` · `Más datos` · `Importe` · `Saldo` | La fila 1 es "Importes expresados en euros" y la cabecera está en la fila 2. Existe una variante "ancha" con `Ingreso (+)` y `Gasto (-)` en columnas separadas, y a veces `F. Valor` / `F. Operación`. La contraparte aparece unas veces en `Movimiento` y otras en `Más datos`. |
| **ING** | XLS/XLSX | `F. VALOR` · `CATEGORÍA` · `SUBCATEGORÍA` · `DESCRIPCIÓN` · `COMENTARIO` · (`IMAGEN`) · `IMPORTE (€)` · `SALDO (€)` | Las filas 0–2 son metadatos ("Número de cuenta:", "Titular:", "Fecha exportación:") y la cabecera está en la fila 3 o más abajo. Las fechas son **números de serie de Excel**. Las cabeceras van en mayúsculas y con "(€)". |
| **Sabadell** | XLS/XLSX/CSV | `F. Operativa` · `Concepto` · `F. Valor` · `Importe` · `Saldo` · `Referencia 1` · `Referencia 2` | Antes de la cabecera hay filas de metadatos (`Cuenta`, `Divisa`, `Titular:`, `Selección: Desde dd/mm/aaaa hasta dd/mm/aaaa`). En un CSV de ejemplo los importes aparecían como `-75.00` y `5,847.95`, es decir, **en formato anglosajón** (no se ha verificado si viene así del banco). |

Patrones comunes que debe cubrir el importador:

1. **La fila de cabecera es variable**: hay que buscar en las primeras ~20 filas la primera que contenga una fecha y un importe según un diccionario de sinónimos.
2. **Comparar cabeceras normalizadas**: minúsculas, sin acentos (NFD + quitar diacríticos), sin puntos, espacios colapsados y sin el sufijo `(€)`. Así `F. Valor`, `F.Valor`, `FECHA VALOR` y `Fecha valor` se reconocen como el mismo campo.
3. **Sinónimos por campo**:
   - fecha: `fecha`, `fecha operacion`, `f operativa`, `fecha contable`
   - fecha valor: `f valor`, `fecha valor`
   - concepto: `concepto`, `descripcion`, `movimiento`, `mas datos`, `observaciones`, `comentario`
   - importe: `importe`, `cantidad`, o el par `ingreso (+)` / `gasto (-)`
   - saldo: `saldo`, `disponible`
4. **Importes**: coma decimal y punto de miles (`1.234,56`), formato anglosajón (`1,234.56`), signo `-` o U+2212, y celdas numéricas en XLSX. El formato decimal se debe **inferir por columna** (mirando la posición del último separador en varias filas), no fila a fila.
5. **Fechas**: `dd/mm/aaaa`, `dd-mm-aaaa` o número de serie de Excel (época 1899-12-30). Nunca se debe usar `new Date("dd/mm/yyyy")`.
6. **Codificación CSV**: probar `new TextDecoder('utf-8', { fatal: true })` y, si falla, usar `windows-1252`. También hay que eliminar el BOM.
7. **Separador**: normalmente `;`. El autodetect de PapaParse sirve, pero conviene forzar `;` si la cabecera lo contiene.
8. **`.xls` antiguo (BIFF)**: CaixaBank, ING y Sabadell pueden exportar `.xls`. Ni exceljs ni read-excel-file lo leen. Sin una librería segura, hay que detectar el caso y mostrar un mensaje claro ("guárdalo como .xlsx o .csv"). Algunos `.xls` bancarios son en realidad tablas HTML; esto no se ha verificado en esta sesión.
9. **Duplicados**: generar una huella con fecha + importe en céntimos + concepto normalizado + saldo (si existe), más un contador de ocurrencias para movimientos idénticos legítimos en el mismo día.

### Decisión: **CONSTRUIR**, apoyándose en PapaParse y exceljs

- **Adoptar** `papaparse@5.7.0` (CSV) y `exceljs@4.4.0` (XLSX), ambos ya fijados en el brief. Cargar exceljs con `import()` dinámico solo al importar un XLSX, para que no entre en el bundle inicial.
- **Construir** una capa propia y pura (`detectHeaderRow`, `mapColumns`, `parseSpanishAmount`, `parseSpanishDate`, `fingerprint`) basada en perfiles de banco (sinónimos y pistas de fila) y en una heurística genérica de respaldo. Debe tener cobertura alta y fixtures anonimizados por banco.
- **Motivo**: no existe nada reutilizable y mantenido. La lógica de dominio (sinónimos, decimales y duplicados) es pequeña, específica y fácil de probar. Los análisis de bajo nivel (CSV y ZIP/XML) se delegan en librerías probadas.
- **Riesgo registrado**: exceljs lleva sin releases desde 2023. Si da problemas de tamaño o compatibilidad, la alternativa es `read-excel-file@9.3.14`, tras auditar su árbol de dependencias.

---

## b) Virtualización de listas grandes en React 19

### Candidatos (todos con peerDeps compatibles con React 19)

| Paquete | Versión ≥ 2 semanas (fecha) | Última versión | Licencia | GitHub | Valoración |
|---|---|---|---|---|---|
| **`@tanstack/react-virtual`** | **3.14.25 · 2026-11-01** (→ `@tanstack/virtual-core` 3.19.10 · 2026-11-01). La 3.14.26 · 2026-11-03 cumple justo el umbral de 14 días. | 3.14.26 | MIT | TanStack/virtual ★7,2k, push 2026-11-08 | **Headless**: el marcado es nuestro (`<table>`/`role="grid"`, `aria-rowcount`, `aria-rowindex`), lo que favorece WCAG 2.2 AA. Admite alturas variables (`measureElement`), `overscan` y scroll a un índice. Pesa ~64 KB descomprimido. Publica a menudo (conviene fijar la versión exacta). |
| `react-window` | 2.5.3 · 2026-11-01 | 2.5.3 | MIT | ★17,2k, push 2026-11-15 | Maduro. La API v2 cambió respecto a la v1 (`List` y `rowComponent`). Ofrece menos control sobre la semántica de tabla. Es una alternativa válida. |
| `react-virtuoso` | 4.18.20 · 2026-10-29 (4.18.23 demasiado reciente) | 4.18.23 | MIT (npm) | ★6,5k | Muy completo (alturas automáticas, `TableVirtuoso`), pero añade más API y comportamiento implícito. |
| `virtua` | 0.54.1 · 2026-11-02 | 0.54.2 | MIT | ★3,8k | Ligero y multi-framework, pero todavía es 0.x (la API puede romperse). |

### Decisión: **ADOPTAR** `@tanstack/react-virtual@3.14.25`

- Adoptarlo tal cual, con un componente fino `TransactionList` que aporte la semántica accesible (cabecera fija, `aria-rowcount` = total filtrado, `aria-rowindex` por fila, foco gestionado con teclado) y filas de altura fija (~56 px en Pixel 7) para minimizar mediciones.
- **Motivo**: ser headless es lo que mejor encaja con los requisitos de accesibilidad y de diseño propio. Es pequeño, MIT y está mantenido.
- **Notas**:
  - En jsdom (Vitest) el virtualizador no renderiza filas si no hay dimensiones. Hay que dárselas en los tests (`initialRect` o un mock de `getBoundingClientRect`/`offsetHeight`) y comprobar el scroll real en Playwright.
  - La virtualización no resuelve el filtrado: con 100k filas, el filtrado y el orden deben ir sobre índices de IndexedDB o sobre un array en memoria con `useDeferredValue`, nunca re-renderizando todo.
  - No se ha verificado en esta sesión la compatibilidad con React Compiler.

---

## c) Wrapper de IndexedDB: `idb` frente a `Dexie` (100k registros con índices)

| Criterio | `idb` | `Dexie` |
|---|---|---|
| Versión ≥ 2 semanas | **8.0.4 · 2026-10-06** (ya en el brief) | **4.4.7 · 2026-10-19** (`dexie-react-hooks` 4.4.0 · 2026-03-18) |
| Licencia / GitHub | ISC · jakearchibald/idb ★7,4k, 58 issues | Apache-2.0 · dexie/Dexie.js ★14,7k, 590 issues, push 2026-11-16 |
| Tamaño | ~83 KB descomprimido (unos pocos KB en el bundle) | ~3,2 MB descomprimido (bundle notablemente mayor) |
| Modelo | Envoltorio fino con promesas sobre la API nativa y tipado de esquema (`DBSchema`) | ORM ligero: consultas encadenables, `bulkPut`/`bulkAdd`, índices compuestos y `multiEntry` (`*words`), `liveQuery`, migraciones declarativas |
| 100k registros | Rinde bien si las escrituras se agrupan en **una sola transacción** (`Promise.all(items.map(i => tx.store.put(i)))` + `tx.done`), con paginación por cursor o `getAll(range, count)` | `bulkPut` está optimizado y viene listo. `offset()` en colecciones grandes es O(n); conviene paginar por clave (`where(...).above(lastKey).limit(n)`) |
| Pruebas | Funciona con `fake-indexeddb` **6.2.7 · 2026-10-30** (6.2.8 es demasiado reciente) | Igual |
| Lock-in | Bajo (API estándar) | Medio (API propia de consultas) |

Notas comunes:

- IndexedDB no indexa subcadenas. Para buscar "contiene MERCADONA" hay dos opciones: un índice `multiEntry` sobre tokens normalizados del concepto, o filtrar en memoria (100k conceptos caben en memoria sin problema). Ninguno de los dos wrappers cambia esto.
- Índices previstos: `date`, `[accountId+date]`, `categoryId`, `[categoryId+date]`, `fingerprint` (único, para duplicados) y, opcionalmente, `tokens` (`multiEntry`).
- Hay que pedir `navigator.storage.persist()` para reducir el riesgo de que el navegador borre los datos.

### Decisión: **ADOPTAR `idb@8.0.4`** detrás de un patrón repositorio

- Usar `idb` con una interfaz `TransactionRepository` (`findPage`, `findById`, `bulkUpsert`, `update`, `delete`, `countByFilter`). Las transacciones por lotes las implementa la capa propia, lo que la convierte en una ampliación pequeña sobre `idb`.
- **Motivo**: ya está verificado en el brief, es mínimo, usa la API estándar y el patrón repositorio aísla la elección. Las ventajas de Dexie (`liveQuery`, `bulkPut`) no compensan el peso extra en una PWA móvil. La reactividad se resuelve invalidando consultas tras cada escritura.
- **Plan B**: `dexie@4.4.7` si las consultas compuestas o la reactividad crecen en complejidad. El repositorio permite cambiar sin tocar la UI.
- Hay que hacer un benchmark propio (con `tinybench`, ya en el brief) de inserción de 100k y página de 50 filas antes de cerrar la decisión. **No se ha medido en esta sesión.**

---

## d) Cifrado de copias de seguridad con WebCrypto (AES-GCM + PBKDF2)

### Búsqueda

- npm `pbkdf2 aes-gcm webcrypto`: aparecen `@noble/ciphers`/`@noble/hashes` (JS puro, excluidos porque el brief exige WebCrypto sin librerías criptográficas), `iso-crypto`, `pbkdf2`, `webcrypto-shim`.
- `@metamask/browser-passworder` 6.0.0 (2024-12-17, ISC) usa exactamente PBKDF2 + AES-GCM con sal e IV aleatorios. Sirve como **referencia de diseño**, pero arrastra `@metamask/utils` y su formato está pensado para otro dominio.
- GitHub código `PBKDF2 600000 AES-GCM deriveKey` (TypeScript): 893 resultados. Es un patrón muy extendido de unas 40 líneas.

### Parámetros recomendados

| Parámetro | Valor | Fuente / estado |
|---|---|---|
| KDF | PBKDF2-HMAC-**SHA-256** (`crypto.subtle.deriveKey`) | WebCrypto. Argon2id es la primera opción de OWASP, pero no está disponible de forma general en WebCrypto. |
| Iteraciones | **600.000** (SHA-256). Equivalentes OWASP: SHA-512 → 210.000; SHA-1 → 1.300.000 | Cifras de la *OWASP Password Storage Cheat Sheet* según el conocimiento previo (revisión de 2023). **No se ha podido comprobar en esta sesión si OWASP las ha actualizado** (sin acceso web). Hay que revisarlo antes de publicar. |
| Sal | 16 bytes de `crypto.getRandomValues`, nueva en cada exportación | NIST SP 800-132 (≥ 128 bits) |
| Clave | AES-GCM de **256 bits**, `extractable: false`, usos `['encrypt','decrypt']` | — |
| IV / nonce | **12 bytes** (96 bits) aleatorios, únicos por cifrado; nunca se reutilizan con la misma clave | NIST SP 800-38D |
| Etiqueta | 128 bits (`tagLength: 128`, valor por defecto) | — |
| AAD | La cabecera serializada (magic + versión + parámetros de KDF + sal + IV), de modo que manipularla haga fallar el descifrado | — |
| Formato del archivo | JSON o binario con `{ format: "cuentas-claras-backup", v: 1, kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt }, cipher: { name: "AES-GCM", iv }, data }` | Guardar las iteraciones en el archivo permite subirlas en el futuro sin romper copias antiguas. Al importar, rechazar valores por debajo de un mínimo o absurdamente altos (evita DoS). |
| Contraseña | Normalizar con NFC antes de codificar en UTF-8. Exigir una longitud mínima (p. ej. ≥ 12) y mostrar medidor/aviso. No hay recuperación posible. | — |
| Rendimiento | 600k iteraciones tardan del orden de cientos de ms en un móvil de gama media (estimación, **no medida**). Se ejecuta solo al exportar/importar, con indicador de progreso. | — |
| Errores | Un fallo de `decrypt` (`OperationError`) se muestra como "contraseña incorrecta o archivo dañado", sin distinguir los dos casos | — |

### Decisión: **CONSTRUIR** sobre WebCrypto nativo

- Escribir un módulo `backupCrypto` (unas 60–80 líneas) con `encryptBackup(data, password)` y `decryptBackup(file, password)`, cubierto con tests (ida y vuelta, contraseña incorrecta, cabecera manipulada, IV único, rechazo de iteraciones fuera de rango). Vitest con jsdom expone `crypto.subtle` a través de Node; hay que confirmarlo en el setup.
- **Motivo**: el brief prohíbe librerías criptográficas. La API nativa cubre todo lo necesario y el patrón está muy probado (browser-passworder y cientos de implementaciones), así que no aporta nada envolverlo con un paquete externo.

---

## Resumen de decisiones

| Necesidad | Decisión | Paquetes (versión · fecha de publicación) |
|---|---|---|
| a) Extractos bancarios españoles | **Construir** detección y normalización propias sobre librerías adoptadas | `papaparse` 5.7.0 · 2026-08-24; `exceljs` 4.4.0 · 2023-10-19 (carga diferida; alternativa: `read-excel-file` 9.3.14 · 2026-10-29) |
| b) Virtualización en React 19 | **Adoptar** | `@tanstack/react-virtual` 3.14.25 · 2026-11-01 (+ `@tanstack/virtual-core` 3.19.10 · 2026-11-01) |
| c) IndexedDB, 100k registros | **Adoptar `idb`** detrás de un repositorio propio (ampliación fina) | `idb` 8.0.4 · 2026-10-06; tests con `fake-indexeddb` 6.2.7 · 2026-10-30; plan B `dexie` 4.4.7 · 2026-10-19 |
| d) Copia cifrada | **Construir** sobre WebCrypto | Sin dependencias (PBKDF2-SHA-256 600k, AES-GCM-256, IV de 12 B, sal de 16 B) |

### Pendiente de verificar (fuera del alcance de esta sesión)

- Cifras de iteraciones OWASP vigentes a 2026-11 (sin acceso web).
- Cabeceras reales actuales de cada banco con extractos anonimizados. Los datos de arriba proceden de código de terceros.
- Si las exportaciones `.xls` de CaixaBank, ING y Sabadell son BIFF o HTML.
- Benchmarks de `idb` frente a `dexie` con 100k registros y tiempo de PBKDF2 en un Pixel 7.
- Descargas semanales de npm (host bloqueado). La popularidad se ha estimado con estrellas de GitHub.
