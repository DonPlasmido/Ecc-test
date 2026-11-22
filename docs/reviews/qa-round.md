# Ronda de QA con 12 agentes simultáneos (2026-11-22)

Doce agentes probaron a la vez la app publicada, cada uno con un enfoque: imagin, 5 bancos, reglas, adversarial,
accesibilidad, rendimiento, copias, i18n, PWA, cálculos, responsive y click-path. Los informes originales no se
versionan; este es el resumen. Los arreglos los hicieron 6 agentes (F1–F6) con TDD y luego se fusionaron.

## Corregido

| Área | Hallazgo | Arreglo |
|---|---|---|
| Bancos (F1) | Solo Santander y CaixaBank importaban bien: «Disponible», «F. VALOR»/«F. Operativa», fechas serie de Excel, `1,850.00`, filas TOTAL | Los 7 extractos de `public/samples/` importan 50 movimientos, 0 errores, saldo +1.767,93 € (`allBanks.integration.test.ts`) |
| Reglas (F2) | 13/35 escenarios de sugerencia correctos | 35/35: precisión sin «sin categoría», agregadores, ruido, signo |
| Cálculos (F3) | Saldo del mismo día desordenado; transferencias como gasto; devoluciones; % incoherentes | Orden por línea del extracto, «Sin saldo en el extracto», transferencias fuera del Panel |
| Integridad (F5) | Doble envío duplicaba; reglas de categorías archivadas activas; SW recargaba sin avisar; pestañas desincronizadas | Guardas + unicidad; reglas desactivadas; banner «Hay una versión nueva»; `BroadcastChannel` |
| i18n (F5) | Cuenta por defecto en el idioma activo; sin plurales; en-GB/US mezclado | «Principal» fija, plurales, en-GB |
| A11y (F4) | Foco bajo la barra inferior; foco perdido a `body` (importar, presupuesto, reemplazo, Atrás); orden de botones | Foco gestionado y `scrollIntoView`; pie de diálogo en orden DOM |
| Responsive (F4) | Desbordes a 320 px en Ajustes, Presupuestos y detalle con importes enormes | Envoltura y `minmax(0,1fr)`; e2e a 320 px |
| Rendimiento (F6) | Corregir categoría 11,8–14,2 s (CPU×4, 100k); importar 100k 30–38 s | 1,75–2,16 s; 22 s. `IndexSync` incremental, búsqueda en un solo string |

## Pendiente (honesto)
- Búsqueda tecleo→contador ≈ 0,5–0,8 s a CPU×4 (objetivo 200 ms): lo dominan debounce y render, no el índice.
- Importar 100k tarda 22 s (CPU×4): 3 índices de IndexedDB sin uso (`byDate`, `byAccountDate`, `byCategoryDate`);
  quitarlos exige migración v2.
- «Aceptar regla y aplicar a existentes» 4,7–6,1 s y recarga hasta la lista 5,9–7,3 s a CPU×4 con 100k.
- `IndexSync`: un movimiento insertado durante la hidratación inicial y borrado antes de otra reconciliación
  completa podría quedar en el índice hasta recargar.
- Detalle de movimiento: el selector de categoría recibe el foco y puede quedar bajo el pliegue en pantallas muy bajas.
- Sin abordar: diálogos con el teclado virtual abierto, apaisado/escritorio, importes largos en la lista a 320 px.
- ING con campos entrecomillados multilínea: los números de línea posteriores de los avisos se desplazan.
- LOW adversariales: el guard de zip usa tamaños declarados, override RTL, año 0001, UTF-16 con mensaje genérico.
- Se vieron fallos e2e intermitentes con varios agentes ejecutando a la vez; en solitario la suite pasa 25/25.
