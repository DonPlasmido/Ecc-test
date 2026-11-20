# ECC instalado en este repo

Origen: `affaan-m/ECC` @ `3f14a10`. Instalación manual (sin plugin, sin hooks).

| Tipo | Cantidad | Dónde |
|---|---|---|
| Skills | 82 | `.claude/skills/` |
| Comandos | 40 | `.claude/commands/` |
| Agentes | 32 | `.claude/agents/` |
| Rules | common, typescript, react, web | `.claude/rules/ecc/` |

## Notas
- Los agentes de `.claude/agents/` se registran en caliente, pero con retraso: justo tras
  copiarlos `Agent(subagent_type: "planner")` fallaba, y unos minutos después ya estaban
  disponibles en la misma sesión. Mientras tanto se emularon con agentes `general-purpose`
  que leen `.claude/agents/<nombre>.md`.
- Los subagentes no pueden lanzar sus propios subagentes: skills como `council` o `dev-team`,
  que piden voces independientes en paralelo, las redactan en un único contexto.
- Algunas skills llaman a scripts de ECC (`$CLAUDE_PLUGIN_ROOT/scripts/...`). Para usarlos,
  clona ECC, ejecuta `npm ci` dentro y exporta `CLAUDE_PLUGIN_ROOT=/ruta/al/clon`.
- Comandos y skills con el mismo nombre (`issue-review`, `plan-canvas`, `security-scan`,
  `orch-*`) se instalaron solo como skill para que no se pisen.
- Algunas piezas dependen de servicios externos que aquí no hay (Codex para `multi-plan`,
  AgentShield para `security-scan`, Context7 para `documentation-lookup`).
