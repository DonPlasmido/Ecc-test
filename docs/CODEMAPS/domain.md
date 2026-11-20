# Domain Codemap

<!-- Generated: 2026-11-20 | Files: src/domain/** (~45 .ts) | Sin dependencias externas -->

**Entry points:** `src/domain/shared/Result.ts`, `src/domain/transaction/Transaction.ts`, `src/domain/import/normalizeRows.ts`

## Módulos clave

| Módulo | Exports principales | Archivo |
|---|---|---|
| shared | `Result`, `ok`, `err`, `DomainError`, `domainError`, `DOMAIN_ERROR_CODES`, `normalizeText`, `Brand` | `shared/*.ts` |
| money | `Money` (céntimos enteros), `Cents`, `parseSpanishAmount`, `isAmbiguousAmount` | `money/Money.ts`, `money/parseSpanishAmount.ts` |
| date | `IsoDate` (`YYYY-MM-DD`), `YearMonth`, `parseSpanishDate`, `hasAmbiguousDates` | `date/*.ts` |
| account | `Account`, `AccountId`, `Currency` (= `'EUR'`) | `account/Account.ts` |
| category | `Category`, `CategoryId`, `UNCATEGORIZED`, `DEFAULT_CATEGORIES` | `category/*.ts` |
| transaction | `Transaction`, `TransactionDraft`, `recategorize`, `withNote`, `withDescription`, `baseFingerprint`, `assignDedupKeys`, `DedupKey` | `transaction/*.ts` |
| rule | `Rule`, `RuleOperator`, `matchRule`, `categorize`, `sortRules`, `suggestRule`, `matchesRulePattern` | `rule/*.ts` |
| budget | `Budget`, `budgetStatus` (ok/near/over en puntos básicos), `NEAR_THRESHOLD_BASIS_POINTS` | `budget/*.ts` |
| import | `RawTable`, `ColumnMapping`, `detectHeaderRow`, `detectColumnMapping`, `validateMapping`, `headerSignature`, `normalizeRows`, `ImportBatch`, `ImportProfile`, `RowError`, `RowWarning`, `StatementFile` | `import/*.ts` |

## Invariantes

- Importes: `Money` en céntimos; sin `parseFloat` (`parseSpanishAmount` acepta `1.234,56`, `-12,30`, `12,30-`, `(1.234,56)`).
- Fechas: `IsoDate` sin zona horaria.
- Errores esperados: `Result<T, DomainError>`; el dominio devuelve códigos, no textos.
- Clave de dedup: `${cuenta}|${fecha}|${céntimos}|${concepto normalizado}|${saldo}#${ocurrencia}`.
- Reglas: primera regla por prioridad; una categoría manual nunca se pisa (`categorize`).

## Dependencias internas

- `transaction` → `money`, `date`, `shared`, `category`
- `rule` → `transaction`, `shared`
- `import` → `money`, `date`, `shared`
- Sin imports de `application`, `infrastructure` ni `ui`.

## Tests

`tests/domain/*.test.ts` (money, date, rule, transaction, import, budget-category, shared).

## Related

[INDEX](INDEX.md) · [application](application.md)
