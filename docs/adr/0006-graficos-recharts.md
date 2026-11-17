# ADR-0006: Gráficos con recharts sobre datos preagregados y carga diferida

**Date**: 2026-11-17
**Status**: superseded by ADR-0011
**Deciders**: agente `architect` (ECC); rechazado por el responsable del proyecto (2026-11-17)

> **Superseded** el 2026-11-17 por [ADR-0011](0011-graficos-propios-html-svg.md): el responsable del proyecto
> adopta el veredicto del council (`docs/council/decisions.md`, decisión 3) y recharts se ha desinstalado.
> Se conserva este ADR como registro de la alternativa evaluada.

## Context

El panel muestra gasto por categoría, evolución mensual, ingresos frente a gastos y saldo. Debe ser
accesible (WCAG 2.2 AA), funcionar en claro/oscuro y no lastrar la carga inicial de una PWA móvil.
recharts 3.10.1 está en las versiones verificadas.

## Decision

Usamos recharts en componentes de `ui/features/dashboard/charts/*`, cargados con `lazy()` solo en la ruta del
panel. Los gráficos reciben exclusivamente `DashboardData` ya agregado por `BuildDashboard` (≤ 24 meses,
categorías top 8 + "Otras"), nunca movimientos crudos. Los importes se convierten de céntimos a euros solo en
el adaptador del gráfico. Cada gráfico tiene título, descripción y una tabla equivalente conmutable; los colores
salen de tokens de tema con contraste AA y no se usa el color como única señal (etiquetas y patrones).

## Alternatives Considered

### Alternativa 1: SVG propio
- **Pros**: control total, mínimo peso, accesibilidad a medida.
- **Cons**: ejes, escalas, tooltips y responsive desde cero; tiempo de desarrollo.
- **Why not**: "Not Invented Here" sin necesidad; recharts ya está fijado.

### Alternativa 2: Chart.js / ECharts (canvas)
- **Pros**: rendimiento con muchos puntos.
- **Cons**: canvas es opaco a lectores de pantalla; dependencias no verificadas; ECharts es pesado.
- **Why not**: con datos preagregados no hay problema de volumen y SVG es más accesible.

### Alternativa 3: visx / d3
- **Pros**: flexibles y componibles.
- **Cons**: más código por gráfico; no verificadas.
- **Why not**: coste sin beneficio claro para cuatro gráficos estándar.

## Consequences

### Positive
- Carga inicial sin recharts; panel rápido porque el volumen de puntos es mínimo.
- Gráficos independientes del almacenamiento: se prueban con `DashboardData` fijo.

### Negative
- recharts añade peso al chunk del panel (~100 KB gzip aprox.).
- La accesibilidad de recharts es limitada; la tabla equivalente es obligatoria.

### Risks
- Cambios de API entre versiones mayores de recharts. Mitigación: envolver en componentes propios (`SpendingByCategoryChart`, etc.) para que el cambio quede confinado.
