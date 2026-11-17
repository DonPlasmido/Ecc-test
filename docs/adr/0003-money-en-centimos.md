# ADR-0003: `Money` como céntimos enteros y fechas `IsoDate` sin zona horaria

**Date**: 2026-11-17
**Status**: proposed
**Deciders**: agente `architect` (ECC); pendiente de validación por el responsable del proyecto

## Context

Los importes de los extractos llegan como texto español ("1.234,56", "-12,30", a veces "12,30-") o como
números de Excel. Sumar con coma flotante produce errores acumulados (0,1 + 0,2) que se notarían en
presupuestos y saldos con 100.000 movimientos. Las fechas llegan como dd/mm/aaaa o como fechas de Excel, y
un `Date` de JavaScript introduce desfases de zona horaria (un movimiento del día 1 aparece en el mes anterior).

## Decision

`Money` es un value object con `cents` entero (`Brand<number, 'Cents'>`), validado con `Number.isSafeInteger`,
moneda única EUR. El texto se convierte con `parseSpanishAmount` sin `parseFloat` (separando parte entera y
decimal como cadenas). Los porcentajes se calculan en enteros (puntos básicos, 10000 = 100 %). Las fechas de
calendario son `IsoDate` (`'YYYY-MM-DD'`, marcado) y `YearMonth` (`'YYYY-MM'`); nunca `Date` en el dominio.
El formateo a texto ocurre solo en la UI con `Intl.NumberFormat` (`style: 'currency'`).

## Alternatives Considered

### Alternativa 1: `number` en euros con redondeo
- **Pros**: simple, sin conversiones.
- **Cons**: errores de redondeo acumulados; comparaciones de igualdad poco fiables (dedup por importe).
- **Why not**: la dedup y los presupuestos dependen de igualdad exacta.

### Alternativa 2: `bigint` en céntimos
- **Pros**: sin límite de magnitud.
- **Cons**: no se puede guardar en `Float64Array` ni serializar a JSON sin conversión; más lento; incompatible con recharts.
- **Why not**: `Number.MAX_SAFE_INTEGER` céntimos (~90 billones de €) basta de sobra para finanzas personales.

### Alternativa 3: librería decimal (decimal.js, dinero.js)
- **Pros**: aritmética decimal general, multimoneda.
- **Cons**: dependencia no verificada; peso; innecesaria con una sola moneda y solo sumas/restas.
- **Why not**: YAGNI; multimoneda está fuera de alcance en el PRD.

## Consequences

### Positive
- Sumas exactas y comparaciones de igualdad fiables (clave de dedup, reglas por signo).
- Fechas comparables lexicográficamente; índices IDB y rangos sin conversión.
- Sin dependencias adicionales.

### Negative
- Hay que convertir en los bordes (parsers, formateadores, gráficos).
- Multimoneda requeriría un ADR nuevo (añadir `currency` a `Money`).

### Risks
- Bancos que exportan importes con más de 2 decimales o en miles. Mitigación: `parseSpanishAmount` rechaza con error por fila visible en la vista previa.
- Fechas ambiguas (01/02). Mitigación: siempre dd/mm (supuesto del PRD); la vista previa muestra fechas interpretadas.
