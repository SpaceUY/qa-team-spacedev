# QA Agent v2 — Subproyecto 2: plugin + config por proyecto

**Fecha:** 2026-10-15
**Branch:** `feature/qa-agent-v2-plugin-config` (se mergea a `feature/qa-agent-v2`)
**Contexto:** [`docs/2026-10-15-qa-agent-v2-brainstorming.md`](../../2026-10-15-qa-agent-v2-brainstorming.md)
**Estado:** diseño aprobado en chat; spec pendiente de revisión.

---

## 1. Objetivo

Que el agente QA se instale **dentro del repo de código de cada proyecto** como un plugin de
Claude Code, con una configuración por proyecto commiteada. Con eso:

- desaparecen las preguntas que hoy se repiten en cada sesión (idioma, viewports, URL, cuenta,
  Bugs List, Sprint List);
- el agente ve el repo del proyecto (vault, PRs, suite e2e), algo que necesitan los subproyectos 4 a 6;
- las actualizaciones llegan a todos los proyectos desde un solo lugar.

Es la base de los subproyectos 3 (contrato `findings.json` + adaptador ClickUp), 4 (`qa-ticket-test`),
5 (`qa-lead`) y 6 (gate pre-review).

### Fuera de alcance

- Reescribir el contenido de fondo de las skills (protocolos en conflicto, plantillas de reporte,
  `findings.json`, regla "no subagents"). Aquí la adaptación es **mecánica**: rutas, nombres y origen
  de los valores.
- Campos de config para subproyectos futuros (estados del gate, verificación de deploy).
- Hooks distintos del `SessionStart` (el `PreToolUse` del gate es del subproyecto 6).
- Ejecución en CI o headless.

---

## 2. Decisiones tomadas

| Decisión | Elegido | Alternativas descartadas |
|---|---|---|
| Modelo de distribución | Plugin de Claude Code instalado en el repo de código de cada proyecto. **Reemplaza** el modelo "un repo de QA por proyecto creado desde el template". `main` (v1) sigue disponible para los QAs hasta migrar. | Convivir con el template; mantener el template. |
| Layout | **Este repo es el marketplace** (`.claude-plugin/marketplace.json`) y el plugin vive en `plugins/qa-agent/`. Es el layout documentado y evita que el plugin arrastre `docs/` o la evidencia de la v1. | Plugin en la raíz (`source: "."`, no documentado); copiar archivos al proyecto con `/qa-install` (diverge, actualizaciones manuales). |
| Contexto de QA del proyecto | `.qa-agent/context/` en el repo del proyecto, separado del vault, porque el agente escribe ahí y el vault es de solo lectura. | Dentro del vault; mixto. |
| Secretos | `.qa-agent/.env` gitignored, por proyecto. Solo credenciales de prueba. | `userConfig` del plugin: es por usuario y no por proyecto, y no hay secretos por usuario que guardar. |
| `CLICKUP_API_KEY` | **Se elimina.** Ninguna skill la usa; todo pasa por el conector de ClickUp. | — |
| OpenKnowledge (`ok init`) | **Se elimina.** Lo cubren el vault y `.qa-agent/context/`. | — |
| `e2e-tests/` y su workflow | **Salen de este repo.** `qa-e2e-runner` corre la suite del proyecto (`e2e.path`). | — |
| `CLAUDE.md` | Un plugin no puede traer `CLAUDE.md`. Su protocolo pasa a la skill `qa-protocol`; un hook `SessionStart` inyecta solo el estado de la config. | Inyectar el protocolo completo por hook en cada sesión (caro en tokens). |

---

## 3. Estructura

### Este repo

```
qa-team-spacedev/
├── .claude-plugin/
│   └── marketplace.json                 # marketplace "spacedev-qa"
├── plugins/qa-agent/
│   ├── .claude-plugin/plugin.json       # plugin "qa-agent"
│   ├── .mcp.json                        # Playwright MCP 0.0.83
│   ├── agents/
│   │   ├── qa-ui-tester.md
│   │   ├── qa-api-tester.md
│   │   └── qa-e2e-runner.md
│   ├── skills/                          # 14 actuales + qa-config + qa-protocol
│   ├── hooks/
│   │   ├── hooks.json                   # SessionStart
│   │   └── scripts/session-status.mjs
│   └── lib/
│       ├── qa-config-check.mjs          # validador de config (CLI + módulo)
│       └── *.test.mjs
├── docs/
├── CLAUDE.md                            # corto: solo para quien desarrolla el plugin
└── README.md                            # instalación y uso de la v2
```

**Se eliminan de este branch:** `.claude/skills/`, `.claude/agents/`,
`.claude/settings.local.json.example`, `.mcp.json` de la raíz (pasa al plugin), `context/`,
`.env.example`, `GUIDE.md`, `SKILLS_OVERVIEW.md`, `e2e-tests/`, `.github/workflows/e2e.yml`.
Todo sigue existiendo en `main`.

**Desarrollo del plugin en este repo:** `claude --plugin-dir plugins/qa-agent`.

### `marketplace.json`

```json
{
  "name": "spacedev-qa",
  "owner": { "name": "SpaceDev" },
  "plugins": [
    { "name": "qa-agent", "source": "./plugins/qa-agent", "description": "Black-box QA agent for SpaceDev projects" }
  ]
}
```

### `plugin.json`

```json
{
  "name": "qa-agent",
  "description": "Black-box QA agent: ticket tests, regression, audits, ClickUp reporting",
  "version": "2.0.0-alpha.1"
}
```

`version` es explícita: los proyectos reciben una actualización solo cuando cambia. Mientras la v2 esté
en desarrollo, se prueba fijando el branch: `marketplace add SpaceUY/qa-team-spacedev#feature/qa-agent-v2`.

### Repo de cada proyecto

```
.claude/settings.json      # extraKnownMarketplaces + enabledPlugins (commiteado)
.qa-agent/
├── config.json            # commiteado
├── .env.example           # commiteado: nombres de variables, valores vacíos
├── context/               # commiteado
│   ├── navigation-map.md
│   └── regression-flows.md
├── .env                   # gitignored
└── evidence/              # gitignored
```

### Instalación (una vez por proyecto)

1. `claude plugin marketplace add SpaceUY/qa-team-spacedev --scope project`
2. `claude plugin install qa-agent@spacedev-qa --scope project`
3. En Claude Code: `/qa-config`.
4. Commitear `.claude/settings.json`, `.qa-agent/config.json`, `.qa-agent/.env.example`,
   `.qa-agent/context/` y `.gitignore`.

El resto del equipo abre el proyecto, acepta la confianza del workspace y, si se lo pide, corre el
`plugin install` del paso 2. Requisitos por persona: acceso de lectura a `SpaceUY/qa-team-spacedev`
y git autenticado sin prompts (`gh auth login` + `gh auth setup-git`).

---

## 4. Config: `.qa-agent/config.json`

```json
{
  "schemaVersion": 1,
  "project": { "name": "Acme Portal", "language": "es" },
  "viewports": ["desktop", "mobile"],
  "environments": {
    "local": {
      "url": "http://localhost:5173",
      "accounts": {
        "user": { "emailVar": "LOCAL_USER_EMAIL", "passwordVar": "LOCAL_USER_PASSWORD" }
      }
    },
    "staging": {
      "url": "https://staging.acme.com",
      "accounts": {
        "user":  { "emailVar": "STAGING_USER_EMAIL",  "passwordVar": "STAGING_USER_PASSWORD" },
        "admin": { "emailVar": "STAGING_ADMIN_EMAIL", "passwordVar": "STAGING_ADMIN_PASSWORD" }
      }
    }
  },
  "pm": {
    "tool": "clickup",
    "workflow": "sprint",
    "bugsListId": "901234567890",
    "improvementsListId": "901234567891",
    "sprintsFolderId": "90123456"
  },
  "knowledge": { "vaultPath": "docs/vault", "vaultRootNote": "Home.md" },
  "repo": "SpaceUY/acme-portal",
  "e2e": { "path": "e2e-tests" }
}
```

### Esquema

| Campo | Requerido | Tipo / valores |
|---|---|---|
| `schemaVersion` | sí | `1` |
| `project.name` | sí | string no vacío |
| `project.language` | sí | `es` \| `en` \| `bilingual` |
| `viewports` | sí | array no vacío, sin repetidos, de `desktop` \| `mobile` |
| `environments` | sí | objeto con al menos una clave; clave = `^[a-z][a-z0-9-]*$` |
| `environments.<env>.url` | sí | URL `http://` o `https://` |
| `environments.<env>.accounts` | no | objeto; clave de rol = `^[a-z][a-z0-9-]*$` |
| `…accounts.<rol>.emailVar` / `passwordVar` | sí (si existe el rol) | `^[A-Z][A-Z0-9_]*$` |
| `pm` | no | si falta, las skills de ClickUp preguntan como hoy |
| `pm.tool` | sí (si existe `pm`) | `clickup` |
| `pm.workflow` | sí (si existe `pm`) | `sprint` \| `kanban` |
| `pm.bugsListId` | sí (si existe `pm`) | string de dígitos |
| `pm.improvementsListId` | no | string de dígitos |
| `pm.sprintsFolderId` | sí si `workflow` = `sprint`; prohibido si `kanban` | string de dígitos |
| `knowledge.vaultPath` | no | ruta relativa al repo, sin `..`, sin ser absoluta |
| `knowledge.vaultRootNote` | no (requiere `vaultPath`) | ruta relativa a `vaultPath`, sin `..`, terminada en `.md` |
| `repo` | no | `^[\w.-]+/[\w.-]+$` |
| `e2e.path` | no | ruta relativa al repo, sin `..`, sin ser absoluta |

Las claves desconocidas generan un **aviso**, no un error, para que una config hecha para una versión
más nueva no rompa una más vieja.

### Reglas

1. **Precedencia:** lo pedido explícitamente en el chat, luego la config, y por último preguntar. Si el
   agente pregunta algo que podría vivir en la config, ofrece guardarlo (lo hace `/qa-config`).
2. **Elegir ambiente:** si el chat nombra un ambiente o una URL, se usa eso. Si no y la config tiene un
   solo ambiente, ese. Si tiene varios, se pregunta cuál, eligiendo por nombre.
3. **Transparencia:** al arrancar, toda skill o agente de testeo dice en una línea qué tomó de la config
   (por ejemplo `staging · https://staging.acme.com · cuenta user · desktop+mobile · es`).
4. **Sin secretos en la config:** el validador rechaza valores de cuenta que no tengan forma de nombre
   de variable.
5. **Sin config, nada se rompe:** las skills vuelven al modo actual (preguntar) y sugieren `/qa-config`.
6. **Extensión:** los campos de subproyectos futuros se agregan como opcionales sin subir
   `schemaVersion`. Solo un cambio incompatible lo sube.

### Validador: `lib/qa-config-check.mjs`

- Node, sin dependencias. Se usa como módulo (`validateConfig(obj) → { errors: string[], warnings: string[] }`)
  y como CLI: `node ${CLAUDE_PLUGIN_ROOT}/lib/qa-config-check.mjs <ruta-config>`, que imprime un JSON
  `{ ok, errors, warnings }` y sale con código 0 si `ok`, 1 si no.
- Lo usan el hook `SessionStart`, `/qa-config` (antes de escribir) y cualquier skill que dude de la config.

---

## 5. Secretos: `.qa-agent/.env`

- Contiene solo las variables que nombra la config (credenciales de prueba por ambiente y rol).
- Mantiene las reglas de hoy, actualizadas a la nueva ruta: todos los valores entre comillas simples;
  se lee solo con `set -a && source .qa-agent/.env && set +a` dentro de un único comando de Bash;
  nunca se abre con `Read`, nunca se imprime, nunca se hace `echo`, `cat`, `env` ni `printenv`.
- `.qa-agent/.env.example` (commiteado) lo genera `/qa-config` a partir de la config.

---

## 6. Skill `/qa-config`

Nueva, `user-invocable: true`, se puede volver a correr. Una pregunta por mensaje.

1. **Ubicación:** trabaja sobre la raíz del repo del proyecto (`git rev-parse --show-toplevel`). Si no
   está en un repo git, se detiene y lo dice.
2. **Modo edición:** si `config.json` existe, lo valida, muestra los valores actuales y pregunta qué
   cambiar. Nunca reescribe campos que no se pidieron.
3. **Preguntas, detectando lo posible para no preguntarlo:**
   - nombre del proyecto (por defecto, el nombre del repo), idioma, viewports;
   - ambientes: nombre y URL, y los roles de cada uno. Los nombres de variables se generan como
     `{AMBIENTE}_{ROL}_EMAIL` / `_PASSWORD` en mayúsculas, con `-` → `_`;
   - ClickUp, si el conector está disponible (se resuelve con `ToolSearch`, sin hardcodear nombres):
     recorre la jerarquía del workspace y se elige la Bugs List, la de mejoras (opcional), `sprint` o
     `kanban`, y el folder de sprints **por nombre**. Sin conector, se pueden escribir los IDs o
     saltear `pm`;
   - vault: busca carpetas `.obsidian/` en el repo (sin entrar en `node_modules/` ni `.git/`) y propone
     la ruta; la nota raíz se elige entre las notas de primer nivel;
   - repo: de `git remote get-url origin`; suite e2e: busca `playwright.config.*`.
4. **Escritura**, en este orden:
   1. valida el objeto final con `qa-config-check.mjs`; si falla, muestra los errores y no escribe nada;
   2. `config.json`;
   3. `.env.example` con todas las variables de la config, valores `''`. Se regenera completo en cada
      corrida (no tiene secretos y su única fuente es la config);
   4. `.env`: si no existe, se crea igual que el ejemplo. Si existe, solo se **agregan** al final las
      variables que falten; las existentes no se tocan ni se leen sus valores;
   5. plantillas de `context/navigation-map.md` y `context/regression-flows.md`, solo si faltan;
   6. en `.gitignore`, las líneas `.qa-agent/.env` y `.qa-agent/evidence/`, solo si faltan.
5. **Verificación del plugin:** lee `.claude/settings.json`. Si no declara `qa-agent@spacedev-qa`,
   muestra los dos comandos de instalación.
6. **Cierre:** resumen de lo configurado, las variables de `.env` que el usuario tiene que completar
   (por nombre) y la lista de archivos para commitear. **No commitea.**

Nunca pide en el chat el valor de un secreto.

---

## 7. Hook `SessionStart`

`hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-status.mjs\"" } ] }
    ]
  }
}
```

`session-status.mjs` lee `${CLAUDE_PROJECT_DIR}/.qa-agent/` y devuelve
`hookSpecificOutput.additionalContext` con **5 líneas como máximo**:

| Estado | Contexto inyectado |
|---|---|
| Config válida | `QA agent: <proyecto> · ambientes <a, b> · <viewports> · <idioma>` y, si las hay, `Variables vacías en .qa-agent/.env: X, Y` (solo nombres) |
| Config válida con avisos | Lo anterior + los avisos |
| Sin `config.json` | `El plugin qa-agent está activo pero falta .qa-agent/config.json: corre /qa-config.` |
| Config inválida | `qa-agent: .qa-agent/config.json tiene errores:` + los errores (hasta 3) |

- Para detectar variables vacías parsea `.env` en memoria. **Nunca** escribe un valor en la salida, ni
  siquiera parcial.
- Cualquier error interno (archivo ilegible, JSON roto, `CLAUDE_PROJECT_DIR` ausente) se resuelve sin
  output y con código 0: el hook nunca bloquea ni rompe una sesión.

---

## 8. Skill `qa-protocol`

Nueva, `user-invocable: false`. Contiene lo que hoy está en `CLAUDE.md` y sigue vigente:

- estructura de evidencia y reglas de nombres, con base en `.qa-agent/evidence/`;
- protocolo de URL + flujo y de auditoría completa del sitio;
- escenarios estándar S1–S12 y su relación con `viewports`;
- formato de `qa-report.md` y de `AUDIT-SUMMARY`;
- "No scripts — ever" y restricciones de ejecución;
- pre-flight de Playwright MCP con los nombres nuevos de herramientas (ver §9).

Lo que **no** pasa: las preguntas de idioma y viewports (ahora vienen de la config) y las instrucciones
de setup (pasan a `/qa-config` y al README).

Los agentes la precargan con `skills: [qa-protocol, qa-evidence-discipline]`. Las skills que hoy
remiten a "`CLAUDE.md` § X" pasan a remitir a "`qa-protocol` § X". La activación automática con
"URL + flujo" pasa a las `description` de `qa-blackbox` y `qa-ui-tester`.

**Skills externas opcionales:** el protocolo actual invoca `frontend-design:frontend-design` y
`superpowers:verification-before-completion`, que viven en otros plugins y pueden no estar instalados.
`qa-protocol` las trata como opcionales: si no están, se omiten y el reporte lo dice. El README
recomienda instalarlas.

---

## 9. Adaptación de las skills y agentes existentes

| Hoy | Pasa a |
|---|---|
| `.env`, `context/`, `evidence/` en la raíz | `.qa-agent/.env`, `.qa-agent/context/`, `.qa-agent/evidence/` |
| Herramientas `mcp__playwright__*` | `mcp__plugin_qa-agent_playwright__*` (MCP del plugin). Afecta el pre-flight de todas las skills de browser y el `tools:` de `qa-ui-tester`. |
| Preguntar idioma y viewports | De la config; se pregunta solo si faltan |
| Preguntar base URL; no usar `.env` sin confirmación | Regla de elección de ambiente (§4, regla 2) |
| Preguntar cuenta por nombre de variable | Se elige por **rol** de la config; se pregunta solo si hay varios roles y el chat no nombra uno |
| `report-bugs-to-clickup` pide Bugs List y Sprint List | Bugs List de `pm.bugsListId`; deja de pedir el Sprint ID, que no usaba |
| `report-improvements-to-clickup` pide lista y folder de sprints | De `pm.improvementsListId` y `pm.sprintsFolderId`; con `kanban` no asocia a sprint |
| `node .claude/skills/<skill>/parse-*.mjs` | `node "${CLAUDE_PLUGIN_ROOT}/skills/<skill>/parse-*.mjs"` |
| `qa-e2e-runner` corre `e2e-tests/` de este repo | Corre la suite en `e2e.path` del proyecto (por defecto `e2e-tests/`) y lee `.qa-agent/.env` |
| `qa-project-setup` corre `ok init` y guía `.env` | Solo `.qa-agent/context/`; si falta la config, sugiere `/qa-config` |
| Referencias a `CLAUDE.md` | Referencias a `qa-protocol` |

---

## 10. Documentación

- `README.md` nuevo: qué es la v2, requisitos (acceso al repo, `gh auth setup-git`, Node), instalación
  en un proyecto, `/qa-config`, tabla de skills y agentes, skills externas recomendadas,
  troubleshooting (plugin no aparece, MCP pendiente de aprobación, `.env` con valores vacíos).
- `CLAUDE.md` de este repo: corto, para desarrollar el plugin (layout, `--plugin-dir`, cómo correr los
  tests, cuándo subir `version`).
- Se eliminan `GUIDE.md` y `SKILLS_OVERVIEW.md`; su contenido vigente pasa al README.

---

## 11. Verificación y criterios de aceptación

**Automatizable:**

1. `node --test` pasa:
   - validador: config de ejemplo válida; cada campo requerido faltante; `language`, `viewports` y
     `workflow` inválidos; `sprintsFolderId` con `kanban`; valor de cuenta con forma de secreto;
     rutas con `..` o absolutas; clave desconocida → aviso, no error;
   - `session-status.mjs`: sin config, config válida, config inválida, `.env` con variables vacías,
     `CLAUDE_PROJECT_DIR` ausente (salida vacía, código 0). Un test pone valores conocidos en `.env`
     y verifica que **no aparezcan** en la salida;
   - los 51 tests existentes de los parsers, en su nueva ubicación.
2. `claude plugin validate` sin errores, sobre el plugin y sobre el marketplace.
3. En un repo de prueba en el scratchpad: `marketplace add <ruta local> --scope project` +
   `plugin install --scope project` → aparecen las 16 skills y los 3 agentes, Playwright MCP figura
   como servidor del plugin, y el hook inyecta el mensaje de "falta config".
4. Grep sin resultados (fuera de `docs/`): `CLAUDE.md §`, `mcp__playwright__`, `ok init`,
   `CLICKUP_API_KEY`, rutas `context/` o `evidence/` sin el prefijo `.qa-agent/`.

**Aceptación manual (Diego):**

5. `/qa-config` en un proyecto real: crea los archivos de §6, elige listas de ClickUp por nombre, y al
   reabrir la sesión el hook muestra el resumen.
6. Una corrida de `/qa-smoke-test` en ese proyecto toma idioma, viewports, ambiente y cuenta de la
   config, sin preguntarlos.

---

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| Devs sin acceso a la org de GitHub (por ejemplo, devs del cliente) no pueden instalar el plugin. | Requisito explícito en el README. Si aparece el caso, se evalúa publicar el plugin en un repo con acceso más amplio. |
| Un proyecto que ya tiene su propio Playwright MCP duplica el servidor. | Los nombres no chocan (`plugin_qa-agent_playwright`); las skills usan solo el del plugin. |
| La sustitución de `${CLAUDE_PLUGIN_ROOT}` en el markdown de las skills no funciona en algún caso. | El test de instalación (§11.3) verifica que la ruta sustituida exista. Si falla, se cambia el diseño antes de seguir (no se deja un fallback improvisado). |
| La adaptación mecánica rompe un flujo de la v1 que nadie probó. | `main` sigue intacto; la v2 solo se mergea a `main` completa y probada. |
