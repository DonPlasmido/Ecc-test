# Sesión dev-team: alcance del MVP de Cuentas Claras

> Skill aplicada: `dev-team` (`.claude/skills/dev-team/SKILL.md`). Cuatro roles fijos (PM, Arquitecto, Desarrollador, QA),
> solo análisis, con síntesis final.
>
> **Notas de proceso**
> - No hay `PROJECT-CONTEXT.md` en la raíz. El contexto acotado de abajo se ha sacado de `docs/BRIEF.md`.
> - En este entorno no se podían lanzar subagentes en paralelo, así que las cuatro voces se redactaron por separado, cada una con el mismo tema, el mismo contexto y el formato de la skill. Las secciones por rol amplían ese formato (más de 3 preocupaciones) porque el encargo pedía alcance, riesgos, casos límite y definición de terminado.
> - La skill no guarda nada en archivos por defecto. Este archivo existe porque el usuario pidió esta ruta de forma explícita.

## Tema (problema en un párrafo)

Definir el alcance de la primera versión (MVP) de **Cuentas Claras**, una PWA de finanzas personales *local-first*
sin servidor. Hay que decidir qué funciones entran en el MVP y cuáles se aplazan, qué riesgos ve cada rol, qué casos
límite exige QA (CSV raros, fechas ambiguas, duplicados, signo del importe según el banco, contraseña olvidada del backup,
100.000 movimientos en un móvil de gama baja) y una definición de terminado común.

## Contexto acotado (datos declarativos, extraídos de BRIEF.md)

- **Producto:** finanzas personales local-first, instalable (PWA). Ningún dato sale del navegador.
- **Stack:** React 19 + TypeScript strict + Vite 8, Vitest 5, Playwright 1.63 (Pixel 7), IndexedDB (`idb`), WebCrypto,
  papaparse, exceljs, recharts, i18next, vite-plugin-pwa.
- **Fase:** antes de implementar. Se está definiendo el alcance.
- **Restricciones:** GitHub Pages con base `/Ecc-test/`, sin backend; dependencias publicadas hace ≥ 2 semanas;
  código en inglés y UI y documentación en español; WCAG 2.2 AA; offline; modo claro y oscuro.
- **Terminado (según el brief):** 8 funciones objetivo: importación, reglas, presupuestos, panel, lista con 100k,
  backup cifrado, español e inglés, accesible y offline.

---

## Dev Team: alcance del MVP

### PM

**Primera reacción.** El brief describe un producto completo, no un MVP. El valor central es: *"subo mi extracto y entiendo
en qué se me va el dinero, sin regalar mis datos a nadie"*. Todo lo que no sirva a ese ciclo
(importar → categorizar → ver) es candidato a v1.1.

**Propuesta de alcance**

| Entra en MVP (v1.0) | Se aplaza (v1.1+) | Motivo |
| --- | --- | --- |
| Importar CSV español (`;`, coma decimal, dd/mm/aaaa) con detección de columnas, vista previa y corrección manual | Importar XLSX | CSV cubre la mayoría de bancos. exceljs es pesado y añade otra superficie de parseo |
| Perfiles de banco guardados (mapeo de columnas reutilizable) | Plantillas precargadas de muchos bancos | Basta con recordar el mapeo que hizo el usuario |
| Detección de duplicados al reimportar | Fusión manual avanzada de duplicados | Sin esto, reimportar corrompe los datos y el usuario pierde la confianza |
| Reglas "concepto contiene X → categoría" con prioridad | Reglas por regex, importe o rango de fechas | El caso simple resuelve el 80 % |
| Proponer una regla al recategorizar a mano | Sugerencias automáticas por historial | El aprendizaje mínimo ya es diferencial |
| Lista de movimientos con búsqueda, filtros y edición, fluida con 100k | Edición masiva | 100k es un requisito explícito de rendimiento |
| Panel: gasto por categoría, ingresos frente a gastos y saldo | Evolución mensual con comparativas interanuales | Dos o tres gráficos bien hechos mejor que cinco mediocres |
| Presupuestos mensuales por categoría (ok / cerca / superado) | Presupuestos que pasan sobrante al mes siguiente | Valor alto y coste bajo una vez existen las categorías |
| Backup cifrado con exportación e importación | Sincronización entre dispositivos | Sin servidor, el backup es la única red de seguridad |
| Español e inglés, WCAG 2.2 AA, offline, modo claro y oscuro | Más idiomas | Son restricciones fijas del brief y no se negocian |

**Preocupaciones principales**
- Que se infle el alcance: XLSX, gráficos extra y reglas avanzadas pueden retrasar la entrega sin cambiar la propuesta de valor.
- El primer uso: si la primera importación falla con el CSV del banco del usuario, no habrá una segunda.
- La pérdida de datos es el riesgo de producto n.º 1 en una app local-first, por borrado de datos del navegador o por la contraseña olvidada.

**Primera acción.** Reunir 10 a 15 extractos reales anonimizados de bancos españoles distintos para usarlos como corpus de aceptación.

**Pregunta para el equipo.** ¿Aceptamos que XLSX quede fuera de v1.0 si eso garantiza que la importación CSV sea a prueba de bombas?

### Arquitecto

**Primera reacción.** La arquitectura es sencilla en lo conceptual: todo vive en el cliente. Los riesgos están en tres sitios:
el **modelo de datos en IndexedDB**, que sea **idempotente al importar** y el **rendimiento con 100k filas** en un dispositivo limitado.

**Decisiones propuestas**
- **Capas hexagonales ligeras:** `domain` (Money, Transaction, Rule, Budget, sin dependencias), `application`
  (casos de uso: importStatement, categorize, computeBudgetStatus), `infrastructure` (repositorios IndexedDB, parsers,
  crypto) y `ui`. Los repositorios van detrás de interfaces para poder probar con `fake-indexeddb`.
- **Dinero en céntimos enteros** (`number` entero, con suma segura hasta 2^53). Nunca `float`. El signo se normaliza a
  *negativo = gasto* al importar, según el perfil del banco.
- **Huella para deduplicar:** hash SHA-256 (WebCrypto) de `fecha|importe|concepto normalizado|saldo?|cuenta` más un
  número de ocurrencia para las operaciones idénticas legítimas del mismo día. Índice único en IndexedDB.
- **Importación en un Web Worker:** el parseo con papaparse en streaming y la normalización no bloquean el hilo de la UI.
  Se escribe en lotes de unos 1.000 movimientos por transacción.
- **Lista con 100k:** virtualización de filas, índices IndexedDB por `date`, `categoryId` y `accountId`, y búsqueda sobre
  un índice en memoria precalculado (concepto en minúsculas sin tildes) o con cursores paginados. Nada de cargar 100k
  objetos completos en el estado de React.
- **Agregados del panel:** se calculan de forma incremental por mes y categoría y se guardan en un *store* aparte que se
  invalida al editar. Así no se recorren 100k filas en cada render.
- **Backup:** PBKDF2-SHA256 (≥ 600.000 iteraciones) o equivalente que WebCrypto soporte de forma nativa, AES-GCM-256,
  sal e IV aleatorios, cabecera con versión de formato y versión de esquema. Al importar se descifra todo y se valida
  antes de tocar la base de datos.
- **Migraciones de esquema** versionadas desde el día 1 (`onupgradeneeded`), con tests.
- **Persistencia:** pedir `navigator.storage.persist()` y avisar si se rechaza.

**Riesgos técnicos**
- Que Safari o iOS desaloje IndexedDB tras días sin usar la app y el usuario pierda datos. Mitigación: storage persistente y recordatorios de backup.
- El tamaño del bundle (recharts, exceljs, i18next) en conexiones lentas. Mitigación: *code-splitting* y dejar XLSX fuera del MVP.
- Que el service worker deje la app atascada en una versión con un bug. Mitigación: flujo explícito de "Hay una nueva versión".
- Que la base `/Ecc-test/` rompa rutas, el manifest o el alcance del SW. Mitigación: usar `HashRouter` o una configuración de base revisada en E2E.

**Primera acción.** Escribir un ADR con el modelo de datos, la estrategia de huella para duplicados y el formato del backup.

**Pregunta para el equipo.** ¿La huella de duplicado debe incluir el saldo cuando el banco lo trae? Ayuda a distinguir operaciones idénticas, pero no todos los bancos lo exportan.

### Desarrollador

**Primera reacción.** Lo que más esfuerzo lleva no es la UI. Es **el parser tolerante y la normalización**. Calculo
que la mitad del esfuerzo de la importación se irá en casos raros. Lo que más corre el riesgo de hacerse mal sin darse cuenta es el rendimiento con 100k.

**Estimación aproximada (tallas)**

| Bloque | Talla | Comentario |
| --- | --- | --- |
| Parser CSV, detección de columnas, vista previa y corrección | L | Codificación, separadores, cabeceras, fechas e importes |
| Duplicados y reimportación idempotente | M | Huella, ocurrencias y UI de "X nuevos, Y duplicados" |
| Reglas, prioridad y propuesta de regla | M | Motor puro y fácil de testear |
| Lista virtualizada, búsqueda y filtros con 100k | L | Hace falta medir con tinybench y en un dispositivo real |
| Presupuestos y panel | M | Agregados incrementales |
| Backup cifrado | M | WebCrypto, formato versionado y validación |
| i18n, a11y, PWA, temas | M | Transversal y presente desde el principio, no al final |

**Preocupaciones principales**
- **Codificación:** muchos bancos exportan en Windows-1252/ISO-8859-1. Si se lee como UTF-8, "Fecha operación" pasa a ser "Fecha operaciÃ³n" y la detección falla. Hay que detectar la codificación (BOM, heurística) y dejar que el usuario la elija.
- **Importes:** formatos como `1.234,56`, `-1.234,56`, `1234,56-`, `(1.234,56)`, `1.234,56 €`, columnas separadas de Debe y Haber, y espacios no separables (` `). Hace falta una única función `parseSpanishAmount` con cobertura exhaustiva.
- **Deuda:** no mezclar lógica de parseo en componentes. Todo va al dominio, con funciones puras e inmutables.
- **Fechas:** solo se acepta un formato explícito por perfil. Nunca `new Date(string)`, porque depende del navegador y la zona horaria. Las fechas se guardan como `YYYY-MM-DD` en *string* o como día civil, sin hora ni zona.

**Primera acción.** Montar el esqueleto (Vite, TS strict, Vitest, Playwright, ESLint y CI) y escribir primero los tests del parser contra el corpus de extractos.

**Pregunta para el equipo.** ¿Cuando la fecha sea ambigua (todas las fechas tienen día ≤ 12) preguntamos al usuario o inferimos por el orden cronológico del archivo?

### QA

**Primera reacción.** Esta app falla en silencio: un importe con el signo cambiado o una fecha día/mes invertida no da error,
da **datos falsos que parecen correctos**. Por eso necesito oráculos (totales y saldos que cuadren), no solo tests de que "no peta".

**Casos límite que exijo probar (bloqueantes para el MVP)**

1. **CSV raros**
   - Codificación Windows-1252 frente a UTF-8, con y sin BOM. Tildes y "ñ" en cabeceras y conceptos.
   - Separador `;`, `,` o tabulador. Comillas con `;` dentro del concepto. Saltos de línea dentro de un campo entre comillas.
   - Líneas de preámbulo antes de la cabecera (nombre del titular, IBAN, rango de fechas) y líneas de totales al final.
   - Cabeceras variables o en otro orden ("Fecha operación", "F. Valor", "Concepto", "Importe", "Saldo"), columnas
     sobrantes, columnas Debe/Haber separadas y cabecera ausente.
   - Archivo vacío, archivo solo con cabecera, filas con número de columnas distinto, final de línea CRLF o LF, extensión
     `.csv` que en realidad es XLSX u HTML.
   - Archivo enorme (más de 20 MB) y archivo que no es texto: se rechaza con un mensaje claro, sin colgar la app.
   - Inyección de fórmulas (`=HYPERLINK(...)`, `+`, `-`, `@`) en el concepto: se muestra como texto y nunca se ejecuta ni se reexporta sin neutralizar.
2. **Fechas ambiguas**
   - `03/04/2025`: es 3 de abril con el perfil dd/mm, nunca 4 de marzo.
   - Archivo con todas las fechas de día ≤ 12: la app pide confirmar el formato o usa el perfil guardado.
   - Años de 2 dígitos (`03/04/25`), separadores `-` y `.`, ISO `2025-04-03` y fechas seriales de Excel.
   - 29/02 en año bisiesto y en año no bisiesto (debe rechazarse), y 31/04 inválido.
   - Cambio de horario (último domingo de marzo y de octubre): el movimiento no se mueve de día en ninguna zona horaria.
   - Fecha de operación frente a fecha valor: queda claro cuál se usa para el mes del presupuesto.
3. **Duplicados**
   - Reimportar el mismo archivo da 0 nuevos y N duplicados, y los totales no cambian.
   - Extractos que se solapan (1–31 de marzo y 15 de marzo a 15 de abril): solo entran los no solapados.
   - Dos cafés idénticos el mismo día por el mismo importe: los dos se conservan y no se fusionan.
   - El mismo movimiento con el concepto ligeramente distinto entre exportaciones (espacios o mayúsculas): la normalización lo detecta.
   - Un movimiento editado o recategorizado por el usuario y luego reimportado: no se duplica ni se pierde la edición.
   - Importación interrumpida a la mitad (cerrar la pestaña): no quedan importaciones a medias. Es todo o nada por lote, o se puede reanudar sin duplicar.
4. **Importes y signo según el banco**
   - Banco con gastos negativos, banco con gastos positivos más columna de tipo, y banco con columnas Debe/Haber.
   - Formatos `1.234,56`, `-1.234,56`, `1234,56-`, `(1.234,56)`, `1.234,56 €`, ` ` y `0,00`.
   - Un importe con punto como decimal (`12.50`) en un banco que usa coma: se detecta la ambigüedad y no se convierte en 1.250.
   - Oráculo: saldo inicial + suma de importes = saldo final del extracto (si existe la columna Saldo) al céntimo.
   - Devoluciones y reembolsos (importe positivo en una categoría de gasto): restan del gasto del presupuesto.
   - Suma de 100k importes en céntimos sin error de redondeo.
5. **Contraseña olvidada o incorrecta del backup**
   - Contraseña incorrecta: mensaje claro ("contraseña incorrecta o archivo dañado"), sin ninguna escritura en la base de datos y sin bloquear la app.
   - Archivo truncado o manipulado (un byte cambiado): AES-GCM falla la autenticación y se rechaza.
   - Archivo de una versión de esquema más antigua: migra. Archivo de una versión más nueva: se rechaza con aviso.
   - Restaurar sobre datos existentes: confirmación explícita y elección entre reemplazar o fusionar con deduplicación.
   - Contraseña olvidada: **no hay recuperación posible**, y la UI lo dice antes de exportar (aviso, confirmar contraseña dos veces y longitud mínima). Hay un test que verifica que el aviso existe y que no hay puerta trasera.
   - Contraseña con caracteres Unicode o emojis: la normalización NFC es coherente al exportar y al importar.
   - La contraseña y la clave derivada no aparecen en logs, en el estado persistido ni en el archivo.
6. **100k movimientos en un móvil de gama baja**
   - Perfil Playwright Pixel 7 con limitación de CPU 4x a 6x y dataset sintético de 100k.
   - Importar 100k sin que la página se congele (hilo principal sin *long tasks* de más de 200 ms durante la importación) y con progreso visible y cancelable.
   - Primer render de la lista en ≤ 1 s, scroll a 60 fps aproximados sin huecos en blanco y búsqueda con resultados en ≤ 300 ms.
   - El panel y los presupuestos se recalculan tras editar un movimiento en ≤ 500 ms.
   - Memoria: sin crecimiento sostenido al hacer scroll de arriba abajo varias veces.
   - Cuota de almacenamiento cerca del límite: error controlado y sin corrupción.
   - Recarga y modo offline con 100k: la app arranca desde la caché del SW y los datos siguen ahí.

**Otros modos de fallo transversales**
- La accesibilidad de la vista previa de importación y de la corrección de columnas, con lector de pantalla y teclado (axe sin violaciones).
- El cambio de idioma no cambia el parseo: la UI en inglés sigue importando CSV españoles correctamente.
- Actualización del SW con la app abierta: no hay pérdida de datos ni versiones mezcladas.

**Primera acción.** Construir el corpus de fixtures (extractos reales anonimizados más sintéticos adversarios) y el generador de 100k movimientos antes de que exista el parser.

**Pregunta para el equipo.** ¿Cuál es el oráculo cuando el banco no exporta la columna Saldo? Sin él, un signo invertido pasa desapercibido.

---

## Síntesis

- **BLOQUEANTE (los 4 roles lo plantean): la fiabilidad de la importación es el MVP.** El PM la ve como el momento decisivo del primer uso, el Arquitecto como un problema de idempotencia, el Desarrollador como la mitad del esfuerzo y QA como la mayor fuente de fallos silenciosos. Nada más se prioriza por encima del parser tolerante con su corpus de pruebas.
- **BLOQUEANTE (Arquitecto, Desarrollador y QA): el rendimiento con 100k se diseña, no se optimiza al final.** Worker, virtualización, índices y agregados incrementales entran en el ADR inicial, con presupuesto medible en el CI.
- **BLOQUEANTE (PM, Arquitecto y QA): pérdida de datos.** Contraseña de backup irrecuperable y desalojo del almacenamiento. Las mitigaciones (aviso explícito, `storage.persist()`, recordatorio de backup y validar antes de escribir) son parte del MVP, no algo opcional.
- **Tensión PM ↔ brief/QA sobre XLSX:** el PM lo aplaza a v1.1. El brief lo pone como funcionalidad objetivo. No se reparte la diferencia: **la decisión es del dueño del producto.** Recomendación: aplazarlo, salvo que el corpus muestre que algún banco objetivo solo exporta XLSX.
- **Tensión Desarrollador ↔ QA sobre fechas ambiguas:** el Desarrollador propone inferir por orden cronológico y QA exige que no se infiera en silencio. Resolución propuesta: inferir como *sugerencia* pero **pedir siempre confirmación** del formato en la vista previa cuando haya ambigüedad, y guardarla en el perfil del banco. Si hay desacuerdo, pasar por `council`.
- **Pregunta abierta compartida (Arquitecto y QA):** el papel del saldo en la huella de duplicados y como oráculo de signo. Hace falta una decisión en el ADR.

## Definición de terminado (MVP v1.0)

Una historia o funcionalidad está **terminada** cuando:

1. **Funcional**
   - Cumple sus criterios de aceptación, escritos antes de implementarla.
   - El corpus de extractos (≥ 10 bancos o formatos) importa sin intervención o con una corrección manual guiada. El oráculo de saldo cuadra al céntimo donde exista la columna.
   - Reimportar cualquier archivo del corpus da 0 movimientos nuevos.
2. **Calidad**
   - Se siguió TDD. Cobertura ≥ 80 % global y ≥ 95 % en `domain` (parser de importes, fechas, duplicados, reglas, presupuestos y crypto).
   - Todos los casos límite de QA de esta sesión tienen un test automatizado (unitario, de integración o E2E).
   - TypeScript strict sin `any` ni `@ts-ignore` injustificados. ESLint sin errores. Sin `console.log`.
   - Revisión con `code-reviewer`, y con `security-reviewer` para la importación y el backup. Sin hallazgos CRITICAL ni HIGH abiertos.
3. **Rendimiento** (Playwright Pixel 7 y CPU 4x, dataset de 100k)
   - La importación no bloquea la UI. La lista se pinta en ≤ 1 s, la búsqueda tarda ≤ 300 ms y el recálculo del panel ≤ 500 ms. Es una comprobación automática en el CI.
4. **Privacidad y seguridad**
   - Cero peticiones de red con datos del usuario. Un test E2E intercepta la red y lo verifica.
   - El backup usa solo WebCrypto (AES-GCM y KDF con sal) y tiene un formato versionado. Una contraseña errónea o un archivo manipulado nunca escriben en la base de datos.
   - La UI avisa de forma explícita de que una contraseña olvidada no se puede recuperar.
5. **Accesibilidad, i18n y PWA**
   - axe sin violaciones WCAG 2.2 AA en todas las pantallas. Todo se puede usar con teclado. Contraste correcto en modo claro y oscuro.
   - Todos los textos están en español y en inglés, sin cadenas fijas en el código.
   - La app se instala, arranca offline y funciona bajo `/Ecc-test/` en GitHub Pages.
6. **Entrega**
   - El CI está en verde (lint, typecheck, unit, E2E y rendimiento). La documentación de usuario está en español. Si hubo decisiones de arquitectura, hay ADR.

## Siguientes pasos sugeridos

- **Profundizar en un rol:** QA puede detallar el plan de fixtures y el generador de 100k.
- **Resolver una tensión:** `council` para XLSX dentro o fuera y para fechas ambiguas inferidas o confirmadas.
- **Planificar el trabajo:** `/plan` o `blueprint` para trocear el MVP en *slices* verticales, empezando por importar CSV → lista.
