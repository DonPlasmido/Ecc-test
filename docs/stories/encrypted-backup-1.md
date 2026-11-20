# Story: Exportar copia cifrada

**ID:** encrypted-backup-1
**Epic:** encrypted-backup
**Sprint:** 7
**Status:** todo
**Points:** 5

## Context

Como usuario quiero exportar todos mis datos cifrados con contraseña para guardarlos de forma segura. Contribuye a la épica «Copia de seguridad cifrada» (F6).

## Acceptance Criteria

Detalle verificable (Dado/Cuando/Entonces) en `docs/acceptance-criteria.md`; evidencia en `docs/TESTS.md`.

- [ ] AC-036: Formato de exportación cifrada — se descarga `cuentas-claras-AAAA-MM-DD.ccbackup` con cabecera `{format, version: 1, kdf: "PBKDF2-SHA-256", iterations: 600000, salt (16 B), iv (12 B)}` y el contenido cifrado con AES-GCM de 256 bits mediante `crypto.subtle` (TEST-BAK-001)
- [ ] AC-037: Sin texto plano y sin reutilizar sal/IV — los bytes del archivo no contienen esos conceptos ni importes; las dos exportaciones tienen sal, IV y cifrado distintos (TEST-BAK-002)
- [ ] AC-042: Contraseña: validación y no persistencia — los dos primeros casos se rechazan; tras exportar, la contraseña no aparece en IndexedDB, `localStorage`, `sessionStorage` ni en la consola (TEST-BAK-007)
- [ ] AC-043: Solo WebCrypto — no hay dependencias criptográficas (lista negra: `crypto-js`, `node-forge`, `tweetnacl`, `sjcl`, `libsodium*`, `bcryptjs`) (TEST-BAK-008)

## Technical Notes

Solo `crypto.subtle`. Revisión obligatoria con security-reviewer.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
