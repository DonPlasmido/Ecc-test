# Extractos de ejemplo (FICTICIOS)

Datos inventados: ningún nombre, IBAN ni importe es real. Todos los ficheros contienen **los mismos 50 movimientos**
(01/08/2026 a 31/10/2026, saldo inicial 3.250,00 EUR, saldo final 1.767,93 EUR), con conceptos repetibles
(MERCADONA, NETFLIX.COM, SPOTIFY AB, NÓMINA EMPRESA EJEMPLO SL, ENDESA, REPSOL, AMAZON…) para que las reglas aprendan.
Cada banco solo cambia el formato. Los formatos salen de `docs/research/search-first.md` y deben contrastarse con
extractos reales anonimizados.

Se regeneran con `node scripts/generate-samples.mjs` (determinista).

Comunes: dos cafés idénticos el mismo día en septiembre (multiconjunto, no son duplicados), un reembolso positivo
(`DEVOLUCION AMAZON EU SARL`, octubre) y un importe >= 1.000 (`-1.200,00`) para el separador de miles.
Oráculo: saldo inicial + suma de importes = saldo final.

| Archivo | Formato | Casos límite que cubre |
| --- | --- | --- |
| `bbva.csv` | UTF-8 con BOM, `;`, CRLF, orden descendente | 4 líneas de preámbulo + línea vacía antes de la cabecera; cabecera `F.Valor;Fecha;Concepto;Movimiento;Importe;Divisa;Disponible;Observaciones` (puntos, `Disponible` como saldo); `1.234,56` |
| `santander.csv` | UTF-8, `;`, LF, orden descendente | Cabecera `Fecha Operación;...;Divisa;Saldo;Divisa` con `Divisa` duplicada; fechas `dd-mm-aaaa`; importes sin separador de miles (`1200,00`); signo menos U+2212 en algunos gastos |
| `caixabank.csv` | **Windows-1252**, `;`, CRLF, orden ascendente | Fila 1 `Importes expresados en euros` y cabecera en la 2; columnas **Debe/Haber** separadas (importes positivos, sin signo); tildes y Ó/ñ en latin1; campo entre comillas con `;` dentro |
| `ing.csv` | UTF-8, `;`, CRLF | 3 líneas de metadatos + vacía; cabecera en MAYÚSCULAS con `(€)` y acentos; columnas extra (categoría); campo `COMENTARIO` multilínea entre comillas |
| `sabadell.csv` | UTF-8, `;`, LF | 5 líneas de preámbulo (`Selección: Desde...`); importes anglosajones (`-75.00`, `2,315.22`); concepto que empieza por `=` (inyección de fórmula, URL `example.invalid`); filas finales `TOTAL INGRESOS` / `TOTAL GASTOS` que no son movimientos |
| `bbva.xlsx` | XLSX, hoja `Informe BBVA` | Cabecera en la fila 5 y columna B (columna A vacía); fechas como celdas de fecha; importes numéricos; mismo contenido que `bbva.csv` |
| `ing.xlsx` | XLSX, hoja `Movimientos` | 3 filas de metadatos; fechas como **número de serie de Excel** (formato General); importes numéricos |
