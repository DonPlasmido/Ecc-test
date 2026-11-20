# Revisión React de la interfaz (agente `react-reviewer` de ECC)

Fecha: 2026-11-18 · Confirmados con test: HIGH-1 y HIGH-2.

## HIGH
1. `useTransactionResults.ts`: una página de un resultado anterior que llega tarde sobrescribe la caché del
   resultado nuevo → la lista no recibe filas del filtro actual hasta hacer scroll.
2. `useTransactionResults.ts`: el rechazo de una página obsoleta (resultado expulsado, máx. 8 retenidos)
   sustituye toda la lista por un error sin reintento.

## MEDIUM
3. Panel: clics rápidos en el selector de mes se pierden (el picker muestra el mes anterior mientras carga).
4. Regiones vivas y toasts fuera del `<dialog>` modal → inertes mientras hay un diálogo abierto.
5. Error de búsqueda en Movimientos sin botón de reintento.
6. `useDraftSync` silencia `exhaustive-deps` (frágil).

## LOW
Rollback de reordenación de reglas pisa cambios concurrentes; recuentos de reglas se recalculan desde cero;
diálogos destructivos continúan tras cerrarse; `useImportFlow.commit` usa estado capturado; dos `update()`
de filtros en el mismo tick pierden el primero.

## Verificado correcto
Sin `dangerouslySetInnerHTML` ni URLs de usuario; object URL revocado; paridad i18n es/en; `useAsync` sin
carreras; `Dialog` devuelve el foco; lista virtual con roving tabindex y `aria-rowindex` correctos.

## Estado

Corregidos con commit RED y GREEN (tests en `tests/ui`):
- HIGH-1 y HIGH-2: `useTransactionResults` descarta páginas y errores de resultados no vigentes; el fallo de página es local (`pageError`) con «Reintentar» (`retryPages`).
- MEDIUM-3: el selector de mes del Panel muestra el mes solicitado (`requested`) mientras carga.
- MEDIUM-4: regiones vivas y avisos se montan dentro del `<dialog>` modal abierto (`useRegisterDialogHost`). Verificado en jsdom (contención en el diálogo); no hay E2E propio porque jsdom no simula `inert`, y los elementos dentro del diálogo modal no son inertes por especificación.
- MEDIUM-5: «Reintentar» en el error de búsqueda de Movimientos.
- MEDIUM-6: `useDraftSync` usa refs; sin `eslint-disable` (refactor cubierto por los tests existentes).
- LOW: RestoreBackup y DeleteAllData no se cierran (botón, X, Escape) mientras la operación está en curso.

Pendiente (LOW, no triviales): rollback de reordenación de reglas, recuentos de reglas, `useImportFlow.commit` con estado capturado, doble `update()` de filtros en el mismo tick.

### Actualización 2026-11-20
- LOW «dos `update()` de filtros en el mismo tick pierden el primero»: **arreglado** tras aflorar en CI
  (E2E de filtros en Movimientos). Test: `tests/ui/features/transactions/useTransactionFilters.test.tsx`.
