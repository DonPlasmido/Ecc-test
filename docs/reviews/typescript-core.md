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
