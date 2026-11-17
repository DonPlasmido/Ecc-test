# ADR-0010: Deduplicación de importaciones con huella canónica y contador de ocurrencias

**Date**: 2026-11-17
**Status**: proposed
**Deciders**: agente `architect` (ECC); pendiente de validación por el responsable del proyecto

## Context

Los usuarios exportan extractos solapados (p. ej. "últimos 3 meses" cada mes). Los bancos no incluyen un
identificador estable de movimiento. Hay movimientos legítimamente idénticos (dos cafés del mismo importe el
mismo día). Reimportar no debe crear duplicados ni perder movimientos reales.

## Decision

Cada borrador recibe `dedupKey = accountId|fecha|céntimos|conceptoNormalizado|saldoCéntimos#ocurrencia`, donde
el concepto se normaliza desde `rawDescription` (inmutable), el saldo se incluye si existe y `ocurrencia` cuenta
filas con la misma huella dentro del archivo (`#0`, `#1`…). Antes de insertar se consultan en lote las claves
existentes (`existingDedupKeys`) y solo se insertan las nuevas; el índice único `byDedupKey` es la red de
seguridad. La clave se guarda legible (sin hash). Cada importación crea un `ImportBatch` que se puede deshacer.

## Alternatives Considered

### Alternativa 1: hash SHA-256 de la fila completa
- **Pros**: clave corta de tamaño fijo.
- **Cons**: WebCrypto es asíncrono y no pertenece al dominio; filas idénticas colisionan igual; no depurable.
- **Why not**: no resuelve las filas idénticas y añade E/S al dominio.

### Alternativa 2: deduplicar por rango de fechas (borrar e insertar el periodo del extracto)
- **Pros**: simple y sin falsos negativos por cambios de texto.
- **Cons**: perdería ediciones manuales (categoría, notas) de los movimientos del periodo.
- **Why not**: destruye el trabajo del usuario.

### Alternativa 3: coincidencia difusa (fecha ± 1 día, mismo importe)
- **Pros**: tolera cambios de concepto del banco.
- **Cons**: falsos positivos que ocultarían movimientos reales.
- **Why not**: se usa solo como aviso de "posibles duplicados", no como criterio automático.

## Consequences

### Positive
- Reimportar el mismo extracto es idempotente (0 nuevos), probado en aplicación e integración.
- Movimientos idénticos legítimos se conservan.
- Determinista y puro: testeable con tablas de casos.

### Negative
- ~60 B por fila adicionales (~6 MB a 100k).
- Si el banco cambia el texto del concepto o el saldo entre exportaciones, se crean duplicados.

### Risks
- Extracto parcial que corta a mitad de un grupo de filas idénticas del mismo día: el contador podría infra-contar. Mitigación: con saldo en la huella las filas dejan de ser idénticas; sin saldo, la UI avisa de posibles duplicados y permite deshacer el lote.
