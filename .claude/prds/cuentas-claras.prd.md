# Cuentas Claras

> Modo autónomo: el usuario pidió no hacer preguntas. Las fases FRAME/GROUND/DECIDE de `/plan-prd`
> se resolvieron con supuestos explícitos, marcados como tales.

## Problem
Personas que llevan sus finanzas con extractos del banco (CSV/Excel) no saben en qué se les va el dinero
cada mes: los extractos mezclan conceptos crípticos ("COMPRA TARJ 4512 MERCADONA SL"), cada banco usa un
formato distinto y categorizar a mano en una hoja de cálculo es lento y se abandona. El coste de no
resolverlo es no ver a tiempo que se supera un presupuesto.

## Evidence
- Assumption — needs validation via user research (entrevistas a 5 personas que exportan extractos).
- Assumption — needs validation via prototype: el abandono se debe al tiempo de categorización manual.

## Users
- **Primary**: adulto en España con 1–3 cuentas bancarias que exporta extractos mensualmente desde el móvil
  y no quiere dar acceso a su banca a un agregador externo (privacidad).
- **Not for**: empresas/autónomos con contabilidad formal, usuarios que quieren conexión automática con el banco (PSD2).

## Hypothesis
We believe **importar el extracto y categorizarlo automáticamente con reglas que aprenden de las correcciones**
will **reducir el tiempo de revisión mensual de finanzas** for **personas que exportan extractos y valoran la privacidad**.
We'll know we're right when **≥ 80 % de los movimientos de un segundo extracto quedan categorizados sin intervención
y la revisión mensual completa lleva < 5 minutos**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Movimientos auto-categorizados tras 1 mes de reglas | ≥ 80 % | Test E2E con extracto de ejemplo de 2 meses |
| Tiempo de importación de un extracto de 1 año (~1.500 movs.) | < 2 s en móvil medio | Benchmark (CPU throttling ×4) |
| Interacción fluida con 100.000 movimientos | filtro < 200 ms | Benchmark automatizado |
| Accesibilidad | 0 violaciones axe serias/críticas | E2E con @axe-core/playwright |
| Datos que salen del dispositivo | 0 peticiones con datos | Revisión de seguridad + E2E sin red |

## Scope
**MVP** — Importar CSV/XLSX con detección de columnas, dedup, reglas + aprendizaje, presupuestos,
panel, lista con filtros, copia cifrada, ES/EN, PWA offline.

**Out of scope**
- Conexión directa con bancos (PSD2) — exige backend y licencias.
- Sincronización entre dispositivos — exige backend; la copia cifrada cubre la migración manual.
- Multi-moneda con conversión — TBD — needs validation via user research; se asume EUR.
- Inversiones, préstamos, previsiones — fuera del problema principal.

## Delivery Milestones
| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Importar y ver | El usuario importa un extracto y ve sus movimientos, sin duplicados al reimportar | pending | — |
| 2 | Categorizar | Los movimientos se categorizan por reglas y las correcciones proponen reglas nuevas | pending | — |
| 3 | Controlar | Presupuestos con estado y panel con gráficos | pending | — |
| 4 | Proteger | Copia de seguridad cifrada exportable/importable | pending | — |
| 5 | Pulir | ES/EN, accesible, offline, fluida con 100k movimientos | pending | — |

## Open Questions
- [ ] ¿Signo de los importes: todos los bancos objetivo exportan cargos como negativos? (afecta a la detección)
- [ ] ¿Fechas ambiguas (01/02) — siempre dd/mm en bancos españoles? Se asume que sí.
- [ ] ¿Recuperación si se olvida la contraseña de la copia? Se asume que no hay recuperación posible (por diseño).
- [ ] ¿Categorías por defecto que espera el usuario? Se asume un conjunto inicial editable.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Formatos de banco no reconocidos | Alta | Alto | Vista previa con mapeo manual de columnas |
| Reglas aprendidas demasiado amplias | Media | Medio | Proponer, no aplicar automáticamente; vista previa de afectados |
| Rendimiento con 100k en móvil de gama baja | Media | Alto | Índices, consultas paginadas, lista virtualizada, benchmark en CI |
| Pérdida de datos (borrado del navegador) | Media | Alto | Recordatorio de copia de seguridad |
| Contraseña olvidada | Media | Alto | Aviso explícito al cifrar |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
