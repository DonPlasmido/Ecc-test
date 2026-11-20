# Brief: Cuentas Claras

App de **finanzas personales local-first**, instalable en el móvil (PWA), sin servidor.
Objetivo del proyecto: demostrar capacidades de ingeniería con el kit ECC instalado en `.claude/`.

## Funcionalidades objetivo
1. **Importar extractos bancarios** CSV y XLSX (formatos españoles: `;` como separador, coma decimal,
   fechas dd/mm/aaaa, cabeceras variables como "Fecha operación", "Concepto", "Importe", "Saldo").
   Detección automática de columnas con vista previa y corrección manual. Detección de duplicados al reimportar.
2. **Categorización** por reglas ("concepto contiene MERCADONA → Supermercado"), con prioridad,
   y aprendizaje: al recategorizar a mano se propone crear una regla.
3. **Presupuestos mensuales** por categoría con estado (ok / cerca / superado).
4. **Panel**: gasto por categoría, evolución mensual, ingresos vs gastos, saldo.
5. **Lista de movimientos** con búsqueda, filtros y edición; fluida con **100.000 movimientos**.
6. **Copia de seguridad cifrada** con contraseña (exportar/importar archivo).
7. **Idiomas**: español (por defecto) e inglés.
8. **Accesible** (WCAG 2.2 AA), **offline**, modo claro/oscuro.

## Restricciones fijas
- Publicación: **GitHub Pages** en `https://donplasmido.github.io/Ecc-test/` (base `/Ecc-test/`). Sin backend.
- Stack: **React 19 + TypeScript (strict) + Vite 8**, Vitest 5, Playwright 1.63 (Pixel 7).
- Persistencia: **IndexedDB**. Cifrado: **WebCrypto** (sin librerías criptográficas propias).
- Dependencias: solo versiones publicadas hace ≥ 2 semanas. Gestor: npm (con `.npmrc` legacy-peer-deps).
- Todo el procesamiento en el dispositivo: ningún dato sale del navegador.
- Idioma del código e identificadores: inglés. Textos de UI y documentación: español.

## Versiones ya verificadas (≥ 2 semanas)
react/react-dom 19.1.10, @types/react(-dom) 19.3.0, vite 8.2.6, @vitejs/plugin-react 6.2.1,
vitest/@vitest/coverage-v8 5.1.0, @testing-library/react 16.3.3, @testing-library/jest-dom 7.0.1,
@testing-library/user-event 14.6.8, @testing-library/dom 10.4.2, jsdom 30.1.3, idb 8.0.4,
fake-indexeddb 6.2.7, papaparse 5.7.0, @types/papaparse 5.5.2, exceljs 4.4.0, recharts 3.10.1,
i18next 26.7.1, react-i18next 17.1.12, react-router-dom 7.18.5, vite-plugin-pwa 2.0.0,
workbox-build/window 7.4.1, @playwright/test 1.63.0, @axe-core/playwright 4.14.0, tinybench 6.2.3,
typescript 5.9.3, eslint 10.13.0, typescript-eslint 8.72.1, eslint-plugin-react-hooks 7.1.1,
eslint-plugin-jsx-a11y 6.10.2.
