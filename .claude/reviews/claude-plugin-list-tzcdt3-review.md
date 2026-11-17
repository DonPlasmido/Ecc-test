# Revisión: rama `claude/plugin-list-tzcdt3` → `main` (Navaja Office)

**Revisado**: 2026-11-17
**Modo**: revisión local de la rama completa (no hay PR abierto; no se publica en GitHub)
**Decisión**: APPROVE tras corregir los hallazgos (commit `07bd4b7`)

## Resumen
App PWA para Excel y Word, sin servidor. Sin problemas de seguridad críticos: todo el
texto se inserta con `textContent`/`append` (no hay `innerHTML`), los archivos no salen
del dispositivo y no hay secretos. Se encontró un fallo real con columnas muy largas.

## Hallazgos

### CRITICAL
Ninguno.

### HIGH
- `src/core/summary.ts:59-60` — `Math.min(...numbers)` desborda la pila con ~300.000
  filas (`RangeError`). Reproducido con test y corregido con `reduce`.

### MEDIUM
- `src/ui/dom.ts:29` — las URLs `blob:` de descargas anteriores nunca se liberaban.
  Corregido: `revokeDownloads()` antes de cada ejecución.
- `src/main.ts:27` — si la persona cambiaba de pantalla mientras cargaba una
  herramienta, se pintaba encima de la nueva. Corregido comprobando el hash.

### LOW
- `src/core/merge.ts` — columna «Origen» duplicada si ya existía. Corregido.
- `src/ui/clean.ts`, `src/ui/merge.ts` — casillas sin agrupar. Ahora `fieldset/legend`.
- Pendiente (no corregido): el límite de 15 MB se aplica al archivo comprimido; un
  .docx/.xlsx malicioso muy comprimido podría usar mucha memoria. Riesgo bajo: solo
  afecta al propio dispositivo de quien lo abre.
- Pendiente (no corregido): las gráficas de Chart.js no se destruyen al salir de la
  pantalla (fuga de memoria pequeña).

## Validación

| Check | Resultado |
|---|---|
| Type check (`npm run typecheck`) | Pass |
| Lint (`npm run lint`) | Pass |
| Tests (`npm test`) | Pass — 70/70 |
| Cobertura (`npm run test:coverage`) | 96,4 % sentencias / 89,4 % ramas |
| E2E (`npm run e2e`, Pixel 7) | Pass — 8/8 |
| Build (`npm run build`) | Pass |
