# Navaja Office

App web instalable en el móvil (PWA) para hacer operaciones con Excel y Word con pocos toques.
Todo se procesa **en tu dispositivo**: los archivos no se suben a ningún servidor.

| Herramienta | Qué hace |
|---|---|
| Limpiar tabla | Quita filas duplicadas, filas vacías y espacios sobrantes |
| Juntar Excels | Une varios archivos en uno, emparejando columnas por su nombre |
| Resumen y gráfico | Total, media, mínimo y máximo de una columna, con gráfico por grupos |
| Rellenar Word | Crea un Word por cada fila de un Excel a partir de una plantilla con huecos `{Columna}` |

## Instalarla en Android
1. Abre la web en Chrome.
2. Menú ⋮ → **Añadir a pantalla de inicio** (o **Instalar aplicación**).

## Limitaciones
- Las macros (VBA) no se ejecutan, y al guardar un `.xlsm` se pierden.
- Solo `.xlsx` y `.docx`. Los formatos antiguos `.xls` y `.doc` hay que guardarlos antes en el formato nuevo.
- Los archivos que se descargan son nuevos: no conservan colores ni formatos del original.
- Las fórmulas no se recalculan: se usa el último valor que guardó Excel.
- Máximo 15 MB por archivo.

## Desarrollo

```bash
npm ci
npm run dev            # servidor local
npm test               # pruebas unitarias (Vitest)
npm run test:coverage  # con cobertura (mínimo 80 %)
npm run e2e            # pruebas en navegador, emulando un Android (Playwright)
npm run lint && npm run typecheck
npm run build
```

`.npmrc` activa `legacy-peer-deps` porque npm 10.9 falla al resolver las dependencias opcionales de Vitest 5.

## Publicación
GitHub Actions (`.github/workflows/ci.yml`) ejecuta lint, tipos, pruebas, E2E y build en cada push.
Al llegar a `main`, publica en GitHub Pages: `https://<usuario>.github.io/Ecc-test/`.
