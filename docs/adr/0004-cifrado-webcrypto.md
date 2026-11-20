# ADR-0004: Copia de seguridad cifrada con WebCrypto (PBKDF2-SHA-256 + AES-GCM 256)

**Date**: 2026-11-17
**Status**: accepted
**Deciders**: agente `architect` (ECC); validado por el responsable del proyecto (2026-11-17)

## Context

Los datos financieros solo viven en el navegador; la copia exportable es la única vía de recuperación y
de migración entre dispositivos. El archivo puede acabar en nubes o correos, así que debe ir cifrado con una
contraseña del usuario. El brief prohíbe librerías criptográficas propias y exige WebCrypto.

## Decision

`WebCryptoBackupCipher` implementa `BackupCipherPort`. Derivación: PBKDF2-HMAC-SHA-256 con 600.000 iteraciones
y sal aleatoria de 16 B → clave AES-GCM de 256 bits no extraíble. Cifrado: AES-GCM con IV aleatorio de 12 B
por exportación y etiqueta de 128 bits. El contenido es el `BackupSnapshot` JSON versionado, comprimido con
`CompressionStream('gzip')`. Sobre binario `.ccbackup`: magic `CCBK` · longitud de cabecera (uint32 BE) ·
cabecera JSON (`v`, parámetros KDF y cifrado) · ciphertext; la cabecera es `additionalData` de AES-GCM.
Un único error `backup.wrongPasswordOrCorrupted` para cualquier fallo de autenticación. La restauración valida
el snapshot entero antes de reemplazar los datos en una transacción.

## Alternatives Considered

### Alternativa 1: Argon2id (WASM)
- **Pros**: KDF resistente a GPU por uso de memoria; recomendación preferente de OWASP.
- **Cons**: no está en WebCrypto; exigiría librería WASM externa, contraria al brief.
- **Why not**: restricción "sin librerías criptográficas"; PBKDF2 con 600.000 iteraciones es el mínimo OWASP para SHA-256.

### Alternativa 2: AES-CBC + HMAC
- **Pros**: ampliamente soportado.
- **Cons**: dos claves y composición manual encrypt-then-MAC, más superficie de error.
- **Why not**: AES-GCM aporta cifrado autenticado en una sola primitiva.

### Alternativa 3: exportación sin cifrar (JSON) con advertencia
- **Pros**: interoperable, sin riesgo de pérdida por contraseña olvidada.
- **Cons**: expone datos financieros sensibles.
- **Why not**: el brief exige copia cifrada.

## Consequences

### Positive
- Confidencialidad e integridad (cabecera y contenido autenticados) sin dependencias.
- Formato versionado: permite subir iteraciones o cambiar algoritmo con `v: 2` sin romper copias antiguas.
- Testeable en Vitest con el WebCrypto nativo de Node.

### Negative
- Sin recuperación si se olvida la contraseña (por diseño; aviso explícito en la UI).
- 600.000 iteraciones tardan ~0,5–1 s en móvil al exportar e importar.

### Risks
- Contraseñas débiles. Mitigación: mínimo 12 caracteres e indicador de fortaleza; PBKDF2 solo ralentiza.
- Reutilización de IV. Mitigación: IV y sal nuevos en cada `encrypt`, con test que lo comprueba.
- Snapshots de esquemas antiguos. Mitigación: `migrateSnapshot` por `schemaVersion` con tests de fixtures.
