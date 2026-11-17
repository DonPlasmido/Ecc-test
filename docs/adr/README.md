# Architecture Decision Records

Registro de decisiones de arquitectura de Cuentas Claras (formato Nygard adaptado; skill
`architecture-decision-records` de ECC). Visión de conjunto en [`../architecture.md`](../architecture.md).

Ciclo de vida: `proposed → accepted → [deprecated | superseded by ADR-NNNN]`. Todas están en `proposed`
hasta que el responsable del proyecto las valide.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-arquitectura-hexagonal.md) | Arquitectura hexagonal (Ports & Adapters) por capas en `src/` | proposed | 2026-11-17 |
| [0002](0002-indexeddb-con-idb.md) | IndexedDB con `idb` y transacciones de grano grueso | proposed | 2026-11-17 |
| [0003](0003-money-en-centimos.md) | `Money` en céntimos enteros e `IsoDate` sin zona horaria | proposed | 2026-11-17 |
| [0004](0004-cifrado-webcrypto.md) | Copia cifrada con WebCrypto (PBKDF2-SHA-256 + AES-GCM 256) | proposed | 2026-11-17 |
| [0005](0005-estado-ui-sin-libreria.md) | Estado de UI con React nativo, hash router y versión del índice | proposed | 2026-11-17 |
| [0006](0006-graficos-recharts.md) | Gráficos con recharts sobre datos preagregados | proposed | 2026-11-17 |
| [0007](0007-i18n-i18next.md) | i18n con i18next, `Intl` y errores como códigos | proposed | 2026-11-17 |
| [0008](0008-virtualizacion-de-listas.md) | Virtualización propia de la lista con altura fija | proposed | 2026-11-17 |
| [0009](0009-indice-de-lectura-en-memoria.md) | Índice de lectura columnar en memoria | proposed | 2026-11-17 |
| [0010](0010-deduplicacion-de-importaciones.md) | Deduplicación con huella canónica y contador de ocurrencias | proposed | 2026-11-17 |
