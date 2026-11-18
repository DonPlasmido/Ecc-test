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
