# QA Agent v2 — Cambios respecto a la v1

Qué cambia para quien usa el agente. La v1 es la de `main` (el repo de QA por proyecto creado desde el
template). Cada cambio enlaza a la decisión que lo explica en [`decisions.md`](decisions.md).

**Estados:**

- ✅ **Hecho:** ya está en `feature/qa-agent-v2`.
- 🛠 **Planificado:** diseñado y aprobado; se implementa en el subproyecto indicado.
- 💡 **Previsto:** en la hoja de ruta, todavía sin diseño detallado.

Al cerrar cada subproyecto se actualizan los estados de este documento.

---

## Resumen

| Tema | v1 | v2 | Estado |
|---|---|---|---|
| Dónde vive el agente | Un repo de QA por proyecto, creado desde el template | Plugin instalado en el repo de código del proyecto | 🛠 Subproyecto 2 |
| Configuración | `.env` en la raíz + preguntas en cada sesión | `.qa-agent/config.json` (commiteado) + `.qa-agent/.env` | 🛠 Subproyecto 2 |
| Preguntas por sesión | Idioma, viewports, URL, cuenta, Bugs List, Sprint List, assignee… | Solo lo que no esté en la config | 🛠 Subproyecto 2 |
| Testeo de un ticket | Smoke test enfocado (`/qa-smoke-test`) | Testeo completo en To Test con bugs asignados al dev | 💡 Subproyecto 4 |
| Gate antes del code review | No existe | Hook en In Progress → In Review | 💡 Subproyecto 6 |
| Agentes compatibles | Claude Code y Codex | Solo Claude Code | ✅ |

---

## Instalación y distribución

| Cambio | Qué haces distinto | Estado | Decisión |
|---|---|---|---|
| La v2 es un plugin de Claude Code; ya no se crea un repo desde el template. | En el repo del proyecto: `claude plugin marketplace add SpaceUY/qa-team-spacedev --scope project` y `claude plugin install qa-agent@spacedev-qa --scope project`. | 🛠 2 | D-022, D-023 |
| Requisito: acceso de lectura a `SpaceUY/qa-team-spacedev` y git autenticado sin prompts. | Una vez por máquina: `gh auth login` + `gh auth setup-git`. | 🛠 2 | D-023 |
| Playwright MCP viene con el plugin, con versión fija. | Ya no se copia un `settings.local.json` para conectar Playwright; solo se aprueba el servidor la primera vez. | ✅ en `.mcp.json` de la raíz · 🛠 2 dentro del plugin | D-019, D-023 |
| Se elimina el soporte de Codex (`AGENTS.md`, `.agents/`). | Usar Claude Code. | ✅ | D-018 |
| Las actualizaciones llegan por el marketplace. | `/plugin marketplace update spacedev-qa` o activar el auto-update del marketplace. | 🛠 2 | D-023 |

## Configuración

| Cambio | Qué haces distinto | Estado | Decisión |
|---|---|---|---|
| Nueva config del proyecto en `.qa-agent/config.json`. | Correr `/qa-config` una vez por proyecto y commitear lo que genera. | 🛠 2 | D-029 |
| Las credenciales pasan de `.env` en la raíz a `.qa-agent/.env`, por ambiente y rol (`STAGING_ADMIN_EMAIL`, etc.). | Completar `.qa-agent/.env` siguiendo `.qa-agent/.env.example`. Mismas reglas: valores entre comillas simples, nunca pegarlos en el chat. | 🛠 2 | D-025 |
| `BASE_URL` desaparece: cada ambiente tiene su URL en la config. | Decir en el chat "en staging" o "en local"; con un solo ambiente no hace falta. | 🛠 2 | D-029 |
| Se elimina `CLICKUP_API_KEY`. | Nada: ClickUp se usa a través del conector de claude.ai. | 🛠 2 | D-025 |
| `context/` pasa a `.qa-agent/context/`. | Nada: `/qa-project-setup` lo crea ahí. | 🛠 2 | D-024 |
| `evidence/` pasa a `.qa-agent/evidence/` (gitignored). | Buscar los reportes en la nueva ruta. | 🛠 2 | D-024 |
| Se elimina OpenKnowledge (`ok init`). | Nada. | 🛠 2 | D-026 |
| Un mensaje al iniciar la sesión indica el estado de la config y las variables vacías de `.env` (solo nombres). | Si dice que falta config, correr `/qa-config`. | 🛠 2 | D-028 |

## Skills y agentes

| Cambio | Qué haces distinto | Estado | Decisión |
|---|---|---|---|
| El agente `qa-regression` (suite scripteada) se llama `qa-e2e-runner`. La skill `/qa-regression` no cambia. | Pedir "corre la suite e2e" llama al agente nuevo. | ✅ | D-020 |
| `qa-e2e-runner` corre la suite e2e del proyecto, no la de este repo. | Indicar la ruta en `e2e.path` si no es `e2e-tests/`. | 🛠 2 | D-027 |
| El HTML de un reporte existente se genera con `/qa-report-render <qa-report.md>` (antes la documentación decía `/qa-report-test-execution`, que no funcionaba así). | Usar `/qa-report-render`. | ✅ | D-021 |
| Nueva skill `/qa-config`. | Ver "Configuración". | 🛠 2 | D-029 |
| `/qa-project-setup` solo arma `.qa-agent/context/`; ya no corre `ok init` ni guía el `.env`. | Correr primero `/qa-config`. | 🛠 2 | D-024, D-026 |
| Las skills llevan el nombre del plugin (`/qa-agent:qa-smoke-test`). | El nombre corto (`/qa-smoke-test`) sigue funcionando si no choca con otro. | 🛠 2 | D-023 |
| Idioma y viewports se toman de la config. | Ya no se responden al iniciar cada sesión; se pueden pedir otros en el chat. | 🛠 2 | D-029 |
| La cuenta de prueba se elige por rol (`user`, `admin`…). | Decir "como admin"; con un solo rol no hace falta. | 🛠 2 | D-029 |
| `frontend-design` y `verification-before-completion` pasan a ser opcionales. | Instalarlas se recomienda; si faltan, el reporte lo indica. | 🛠 2 | D-030 |
| Nuevo agente `qa-ticket-test` (`--depth=quick\|full`) y orquestador `qa-lead` para barrer To Test. | Comandos nuevos para testear tickets. | 💡 4 y 5 | D-012 |

## Reporte de bugs en ClickUp

| Cambio | Qué haces distinto | Estado | Decisión |
|---|---|---|---|
| `CLAUDE.md` decía que `/report-bugs-to-clickup` asocia los tickets al sprint y pone estado OPEN; no hace ninguna de las dos. Se corrigió la documentación. | Seguir agregando los bugs al sprint a mano, como ya se hacía. | ✅ | — |
| La Bugs List y el folder de sprints salen de la config. | Ya no se escriben IDs en el chat. | 🛠 2 | D-029 |
| `/report-bugs-to-clickup` deja de pedir el Sprint List ID, que no usaba. | Una pregunta menos. | 🛠 2 | D-029 |
| Con `kanban`, `/report-improvements-to-clickup` no asocia a sprint. | Elegir `kanban` en `/qa-config` si el proyecto no usa sprints. | 🛠 2 | D-029 |
| Los bugs de To Test se asignan solos al dev del ticket y se vinculan a él; el ticket se mueve según severidad. | Ya no se elige assignee. | 💡 3 y 4 | D-008, D-011 |
| Las plantillas de reporte se unifican en un `findings.json`, del que salen el markdown, el HTML y los tickets. | Nada visible, salvo reportes más consistentes. | 💡 3 | — |

## Flujo de trabajo

| Cambio | Qué haces distinto | Estado | Decisión |
|---|---|---|---|
| To Test pasa a tener un testeo completo: criterios de aceptación, vault, negativos y bordes, viewports, matriz de trazabilidad y evidencia en el ticket. | Correrlo por ticket o barrer la columna. | 💡 4 y 5 | D-008, D-010 |
| El vault del proyecto se usa como fuente de casos. | Mantener el vault al día con la skill de Mario. | 💡 4 | D-007 |
| Gate pre-review: al mover un ticket a In Review vía Claude, se exige un QA PASS del commit actual. | Tener el servidor local levantado; usar el bypass con motivo si el agente se equivoca. | 💡 6 | D-003 a D-006, D-013 |

## Eliminado de este repo

| Qué | Por qué | Estado | Decisión |
|---|---|---|---|
| `AGENTS.md`, `.agents/skills` | Solo Claude Code | ✅ | D-018 |
| `.claude/skills/`, `.claude/agents/` | Pasan a `plugins/qa-agent/` | 🛠 2 | D-023 |
| `CLAUDE.md` con el protocolo completo | Pasa a la skill `qa-protocol`; queda un `CLAUDE.md` corto para desarrollar el plugin | 🛠 2 | D-028 |
| `context/`, `.env.example`, `.claude/settings.local.json.example` | Pasan al repo de cada proyecto, bajo `.qa-agent/` | 🛠 2 | D-024, D-025 |
| `GUIDE.md`, `SKILLS_OVERVIEW.md` | Se reemplazan por el README de la v2 | 🛠 2 | — |
| `e2e-tests/`, `.github/workflows/e2e.yml` | Cada proyecto tiene su propia suite | 🛠 2 | D-027 |

Todo lo eliminado sigue disponible en `main` mientras la v1 esté en uso.
