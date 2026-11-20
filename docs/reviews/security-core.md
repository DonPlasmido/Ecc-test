# Revisión de seguridad del núcleo (agente `security-reviewer` de ECC)

Fecha: 2026-11-17 · Alcance: crypto, parsing, indexeddb, domain/import · Estado de los arreglos al final.

## HIGH
- **H1 (confirmado)** Bomba ZIP en XLSX: `ExcelJsXlsxParser` carga el libro entero antes de comprobar filas;
  `MAX_FILE_BYTES` solo limita el tamaño comprimido. ZIP de 307 KB → 100 MB de XML → 8,5 s y 1,3 GB de RSS.

## MEDIUM
- **M1** CSV sin límite de columnas ni de longitud de celda.
- **M2** `sheetToRows` itera `columnCount` por fila: una celda en la columna 16384 multiplica el trabajo.
- **M3** XLSX sin tope de número de hojas.
- **M4** Inyección de fórmulas: sin riesgo hoy (no hay exportación CSV), neutralizar al exportar si se añade.
- **M5** `replaceAll` confía en que el caso de uso valide el snapshot.

## LOW
- **L1** Sin longitud mínima de contraseña en el cifrador (la impone la capa de aplicación: ≥ 12).
- **L2** Sin tope de tamaño del sobre al descifrar.
- **L3** `index.html` sin CSP.
- **L4** El fallback windows-1252 acepta binario (mitigado por el control de bytes nulos).
- **L5** `QuotaExceededError` en importaciones enormes sin mensaje claro.

## Verificado correcto
AAD sobre magic+longitud+cabecera, sal/IV aleatorios, límites KDF, parser estricto del sobre, error único
para contraseña errónea/manipulación, NFC, escrituras IndexedDB atómicas, rechazo de .xls/OLE2/PDF/HTML.

## Estado

| Hallazgo | Estado | Commit (RED / GREEN) |
|---|---|---|
| H1 bomba ZIP | Arreglado: `zipGuard.ts` lee el directorio central (DataView) y rechaza >50 MB descomprimidos, >100 entradas o ratio >100:1 | 5b4c774 / de8aae8 |
| M1 CSV columnas/celda | Arreglado: MAX_COLS=200, MAX_CELL_CHARS=2000 | e6d9982 / cc1e298 |
| M2 columnCount XLSX | Arreglado: rechazo si columnCount > 200 antes de iterar | e6d9982 / cc1e298 |
| M3 hojas XLSX | Arreglado: solo las 10 primeras | e6d9982 / cc1e298 |
| L2 tope de sobre | Arreglado: >100 MB devuelve `backup.invalidFormat` sin derivar clave | 20a8b27 / bd643d0 |
| L3 CSP | Arreglado: meta CSP en index.html; verificada con build + preview en Chromium sin errores (con un `main.tsx` temporal, aún no existe) | dee7621 / 75a3791 |
| M4 | Pendiente: sin exportación CSV, neutralizar al añadirla |  |
| M5 | Pendiente: `replaceAll` confía en la validación del caso de uso |  |
| L1 | Pendiente: la capa de aplicación impone ≥ 12 |  |
| L4, L5 | Pendiente |  |

Nota H1: se valida el tamaño declarado en el ZIP; un ZIP que mienta en el directorio central no queda cubierto por completo.
