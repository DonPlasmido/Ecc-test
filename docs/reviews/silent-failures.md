# Fallos silenciosos (agente `silent-failure-hunter` de ECC)

Fecha: 2026-11-18 · Confirmados con test: ALTA-1 y ALTA-2. El resto, por lectura de código.

## ALTA
1. `IndexSync`: `hydration: failed` no llega a la UI, pierde el error y no vuelve a `ready` tras una pasada correcta.
2. `IndexSync`: una reconciliación que falla a mitad deja upserts aplicados y borrados sin aplicar (datos desfasados).
3. `ImportStatementUseCase`: si `rememberMapping` falla tras `insertImport`, no se llama a `onDataChanged` y se informa error.
4. `LearnRuleFromCorrectionUseCase`: regla guardada + `updateMany` fallido → sin `onDataChanged`.

## MEDIA
5. Ajustes (restaurar/exportar/borrar): `.catch(() => null)` pierde el error; mensaje genérico.
6. `openDatabase`: `blocking` cierra sin avisar; sin `blocked`/`terminated` → `InvalidStateError` genéricos o arranque colgado.
7. `registerSW` sin `onRegisterError`.
8. Semilla de categorías no atómica: un fallo a mitad deja el catálogo incompleto para siempre.

## BAJA
9. `catch {}` sin log en varias pantallas. 10. Recuento de reglas fallido cacheado como `null`.
11. `requestPersistence` mezcla "denegado" y "error".
