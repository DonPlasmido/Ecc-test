# Revisión TypeScript del núcleo (agente `typescript-reviewer` de ECC)

Fecha: 2026-11-17 · Veredicto: Warning (0 CRITICAL, 2 HIGH). Hallazgos reproducidos con scripts.

## HIGH
1. `detectColumnMapping.ts` (`rolesFromContent`): sin cabecera y con Debe/Haber, el Haber se toma como saldo
   y el saldo real se ignora; los abonos fallan con `money.invalidAmount`.
2. `ruleSuggestion.ts:107`: excluye el propio movimiento por identidad (`as unknown !== tx`); los repos devuelven
   copias, así que la copia cuenta como fallo y se descarta el patrón bueno (MERCADONA) por uno ruidoso.

## MEDIUM
3. `hasAmbiguousDates`: falso negativo cuando aparece una fecha con día = mes (05/05).
4. `parseSpanishAmount`: `12.345` → 12.345 € sin aviso de ambigüedad (CSV en formato inglés ×1000).
5. Debe/Haber toma valor absoluto: `Haber -5,00` suma (decisión documentada; avisar en vista previa).
6. `normalizeRows`: `FLOAT_TOLERANCE = 0.01` céntimos acepta `12.3401`.
7. `mappers.ts`: casts de brands (`as Cents`, `as IsoDate`…) sin validar datos de IndexedDB/backup.

## LOW
Comentarios TODO obsoletos; pivote fijo de años de 2 dígitos; separadores de fecha mezclados aceptados;
detalle de `money.outOfRange` con valor calculado; fallback de `suggestRule` con la descripción completa;
`sourceLine` desplazado tras filas vacías; `columnCount` sin límite (cubierto por la revisión de seguridad).

## Verificado correcto
Dedup estable con ocurrencias, reglas por palabra completa con tildes, `budgetStatus` en los límites con BigInt,
sin redondeo silencioso de importes.

## Estado

| # | Hallazgo | Estado | RED / GREEN |
|---|----------|--------|-------------|
| 1 | HIGH detectColumnMapping sin cabecera Debe/Haber | Corregido; columnas numéricas no concluyentes limitan la confianza a 0.4 | d3e35a6 / d35345b |
| 2 | HIGH suggestRule: exclusión por `id` opcional, sin cast; fallback sin tokens con dígitos | Corregido | 9de0cea / a912742 |
| 3 | MEDIUM hasAmbiguousDates con día = mes | Corregido | fbe8de6 / 8028840 |
| 4 | MEDIUM importe ambiguo `12.345` | `isAmbiguousAmount` + `warnings` aditivo en `normalizeRows` | 50dcd6c / 645141f |
| 5 | MEDIUM `Haber -5,00` (valor absoluto) | Decisión documentada; sin cambio de comportamiento (la vista previa puede avisar) | n/a |
| 6 | MEDIUM `FLOAT_TOLERANCE` | 1e-6 | 85a7538 / e693b97 |
| 7 | MEDIUM mappers sin validar | Validación con constructores del dominio; `CorruptRecordError` | fbe8b9f / 20edfd4 |
| 8 | LOW TODOs, ok/err/domainError, pivote 2 dígitos, separadores mezclados | Corregido (pivote relativo con `referenceYear`, defecto 2026) | 15c5c9f / 0f1f0f1, 4466098 |
| 9 | LOW `money.outOfRange` con valor calculado, `sourceLine` tras filas vacías, `columnCount` | Sin cambios | n/a |
