# Architecture Decision Records

Registro de decisiones de arquitectura de Cuentas Claras (formato Nygard adaptado; skill
`architecture-decision-records` de ECC). Visión de conjunto en [`../architecture.md`](../architecture.md).

Ciclo de vida: `proposed → accepted → [deprecated | superseded by ADR-NNNN]`. El responsable del proyecto las
validó el 2026-11-17: todas están en `accepted` salvo ADR-0006, sustituida por ADR-0011.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-arquitectura-hexagonal.md) | Arquitectura hexagonal (Ports & Adapters) por capas en `src/` | accepted | 2026-11-17 |
| [0002](0002-indexeddb-con-idb.md) | IndexedDB con `idb` y transacciones de grano grueso | accepted | 2026-11-17 |
| [0003](0003-money-en-centimos.md) | `Money` en céntimos enteros e `IsoDate` sin zona horaria | accepted | 2026-11-17 |
| [0004](0004-cifrado-webcrypto.md) | Copia cifrada con WebCrypto (PBKDF2-SHA-256 + AES-GCM 256) | accepted | 2026-11-17 |
| [0005](0005-estado-ui-sin-libreria.md) | Estado de UI con React nativo, hash router y versión del índice | accepted | 2026-11-17 |
| [0006](0006-graficos-recharts.md) | Gráficos con recharts sobre datos preagregados | superseded by [ADR-0011](0011-graficos-propios-html-svg.md) | 2026-11-17 |
| [0007](0007-i18n-i18next.md) | i18n con i18next, `Intl` y errores como códigos | accepted | 2026-11-17 |
| [0008](0008-virtualizacion-de-listas.md) | Virtualización de la lista con @tanstack/react-virtual 3.14.25 y altura fija | accepted | 2026-11-17 |
| [0009](0009-indice-de-lectura-en-memoria.md) | Índice de lectura columnar en memoria | accepted | 2026-11-17 |
| [0010](0010-deduplicacion-de-importaciones.md) | Deduplicación con huella canónica y contador de ocurrencias | accepted | 2026-11-17 |
| [0011](0011-graficos-propios-html-svg.md) | Gráficos propios: barras HTML/CSS y SVG para series temporales, con tabla accesible | accepted | 2026-11-17 |
