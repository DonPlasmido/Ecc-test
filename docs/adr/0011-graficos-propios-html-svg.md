# ADR-0011: Gráficos propios con barras HTML/CSS y SVG para series temporales, con tabla accesible

**Date**: 2026-11-17
**Status**: accepted
**Deciders**: responsable del proyecto, a partir del veredicto del council (`docs/council/decisions.md`, decisión 3); sustituye a [ADR-0006](0006-graficos-recharts.md)

## Context

El panel muestra gasto por categoría, evolución mensual, ingresos frente a gastos y saldo. Debe ser accesible
(WCAG 2.2 AA) con teclado y lector de pantalla, funcionar en claro/oscuro, formatear con `Intl` según el idioma y
no lastrar el precache de una PWA móvil. Son cuatro vistas simples sobre `DashboardData` ya agregado
(≤ 24 meses, top 8 categorías + "Otras"). ADR-0006 proponía recharts; el council concluyó que cuatro gráficos
simples no justifican la dependencia, y recharts se ha desinstalado.

## Decision

Usamos componentes propios en `ui/features/dashboard/charts/*`: `CategoryBars` (lista HTML con barras CSS de
ancho en %, también para presupuestos), y `MonthlyColumns`, `IncomeVsExpense` y `BalanceLine` en SVG
(`role="img"`, `<title>`, `<desc>`). Cada gráfico tiene una tabla equivalente accesible (botón "Ver como tabla"),
colores desde tokens CSS con contraste ≥ 3:1, patrones o etiquetas además del color, y valores con
`Intl.NumberFormat`/`Intl.DateTimeFormat`. Escalas y ticks son funciones puras con tests unitarios.

## Alternatives Considered

### Alternativa 1: recharts 3.10.1 en diferido (ADR-0006)
- **Pros**: ejes, tooltips, responsive y `accessibilityLayer` ya hechos.
- **Cons**: ~100 KB gzip en el precache; tooltips dependientes del puntero; contraste en modo oscuro; riesgo de ruptura en versiones mayores.
- **Why not**: cuatro gráficos simples no justifican la dependencia. Queda como alternativa preparada (ver Risks).

### Alternativa 2: Chart.js / ECharts (canvas)
- **Pros**: rendimiento con muchos puntos.
- **Cons**: canvas es opaco a lectores de pantalla; no verificadas; ECharts es pesado.
- **Why not**: deuda de accesibilidad permanente; con datos preagregados no hay problema de volumen.

### Alternativa 3: SVG para las cuatro vistas
- **Pros**: un único enfoque técnico.
- **Cons**: el gasto por categoría no necesita ejes; un SVG es menos accesible que una lista con barras.
- **Why not**: la lista HTML con barras CSS es más simple y más accesible para datos categóricos.

## Consequences

### Positive
- Sin dependencia de gráficos: chunk del panel y precache mínimos.
- Control total de semántica, tema y formato `Intl`; gráficos probados con `DashboardData` fijo.

### Negative
- Ejes, escalas y ticks propios (redondeo, fechas) que hay que escribir y mantener.
- Sin tooltips ricos ni interacción avanzada (zoom, brush).

### Risks
- Errores de escalas o fechas y crecimiento del código. Mitigación: funciones puras con tests. Condiciones para
  revisar (council): más de 6 tipos de gráfico o interacción rica, más de ~600 líneas de código de gráficos o
  errores recurrentes, o petición de tooltips ricos → nuevo ADR que adopte recharts (versión verificada) en diferido,
  manteniendo las tablas alternativas.
