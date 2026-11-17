# ECC instalado en este repo

Origen: `affaan-m/ECC` @ `3f14a10`. Instalación manual (sin plugin, sin hooks).

| Tipo | Cantidad | Dónde |
|---|---|---|
| Skills | 82 | `.claude/skills/` |
| Comandos | 40 | `.claude/commands/` |
| Agentes | 32 | `.claude/agents/` |
| Rules | common, typescript, react, web | `.claude/rules/ecc/` |

## Notas
- Los agentes solo se registran al **arrancar** una sesión de Claude Code. En la sesión
  que los instaló se emularon lanzando agentes `general-purpose` que leen
  `.claude/agents/<nombre>.md` y actúan como ese agente.
- Algunas skills llaman a scripts de ECC (`$CLAUDE_PLUGIN_ROOT/scripts/...`). Para usarlos,
  clona ECC, ejecuta `npm ci` dentro y exporta `CLAUDE_PLUGIN_ROOT=/ruta/al/clon`.
- Comandos y skills con el mismo nombre (`issue-review`, `plan-canvas`, `security-scan`,
  `orch-*`) se instalaron solo como skill para que no se pisen.
- Algunas piezas dependen de servicios externos que aquí no hay (Codex para `multi-plan`,
  AgentShield para `security-scan`, Context7 para `documentation-lookup`).
