# ADR-0009: Índice de lectura columnar en memoria para búsqueda, filtros y agregados

**Date**: 2026-11-17
**Status**: proposed
**Deciders**: agente `architect` (ECC); pendiente de validación por el responsable del proyecto

## Context

Con 100.000 movimientos hay que filtrar por texto libre ("contiene mercadona"), categoría, cuenta, fechas,
signo e importe en < 200 ms, y calcular el panel y los presupuestos. IndexedDB solo ofrece índices por clave:
no hay búsqueda de subcadenas ni agregados, y recorrer 100k registros con cursor en móvil tarda segundos.
Mantener 100k objetos completos en memoria costaría ~40–60 MB en un móvil.

## Decision

`application/read-model/TransactionIndex` mantiene en memoria solo las columnas necesarias para filtrar y
agregar, en `TypedArray` (`Int32Array` de días, `Float64Array` de céntimos, `Uint16Array` de categoría y cuenta,
permutación ordenada en `Uint32Array`) más `ids` y el texto normalizado (~12 MB a 100k). Se hidrata al arrancar
con `TransactionRepository.scan()` (`getAll` por tramos de 5.000) y se actualiza explícitamente desde los casos
de uso que escriben (`applyUpserts`/`applyDeletes`). Las filas completas se leen de IndexedDB solo para la
ventana visible (`getByIds`). Panel y presupuestos agregan sobre el índice; no hay tablas de agregados
materializados en el MVP.

## Alternatives Considered

### Alternativa 1: consultas directas a IndexedDB con índices compuestos
- **Pros**: sin coste de memoria ni hidratación.
- **Cons**: el texto libre exige recorrer todo el store; agregados de 24 meses con cursor, lentos en móvil.
- **Why not**: no cumple < 200 ms para búsqueda de texto.

### Alternativa 2: agregados materializados (`monthlyTotals`) en IndexedDB
- **Pros**: panel instantáneo sin cargar movimientos.
- **Cons**: hay que mantenerlos consistentes en cada escritura, recategorización y restauración; no resuelve la búsqueda.
- **Why not**: complejidad y riesgo de inconsistencia; queda como plan B si la hidratación no cumple.

### Alternativa 3: índice invertido de texto (n-gramas)
- **Pros**: búsqueda sublineal.
- **Cons**: más memoria y complejidad; un escaneo lineal de 100k cadenas cortas ya tarda ~10–30 ms.
- **Why not**: optimización prematura.

## Consequences

### Positive
- Filtros y agregados en milisegundos; una sola fuente de verdad persistida (la store `transactions`).
- Clase pura de la capa de aplicación, probada sin navegador; benchmark con tinybench en CI.

### Negative
- Coste de arranque (hidratación) y ~12 MB de memoria a 100k.
- El índice es mutable internamente (encapsulado) por rendimiento: excepción deliberada a la regla de inmutabilidad, documentada aquí.
- Los casos de uso que escriben deben acordarse de actualizar el índice (cubierto por tests de aplicación).

### Risks
- Hidratación > 1,5 s en móvil de gama media. Mitigación: benchmark con CPU ×4; plan B: mover hidratación y filtrado a un Web Worker y/o añadir `monthlyTotals` para pintar el panel antes de terminar la hidratación.
- Desincronización índice/IDB tras un fallo de escritura. Mitigación: el índice solo se actualiza tras `tx.done`; opción "reconstruir índice" en ajustes.
