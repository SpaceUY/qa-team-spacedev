# QA Agent v2 — Registro de decisiones

Historial de las decisiones de diseño de la v2, con su porqué. Sirve de fuente para el manual de
usuario y para entender, más adelante, por qué algo es como es.

**Cómo usarlo:**

- Las decisiones no se borran ni se reescriben. Si una cambia, se agrega una nueva que la
  **reemplaza** y se marca la vieja como `Reemplazada por D-0XX`.
- **Estado:** `Vigente`, `Implementada` (ya está en el código) o `Reemplazada`.
- **Manual:** qué parte del manual de usuario afecta, o `—` si es interna.

**Documentos relacionados:**
[resumen del brainstorming](2026-10-15-qa-agent-v2-brainstorming.md) ·
[spec del subproyecto 2](superpowers/specs/2026-10-15-qa-agent-plugin-config-design.md) ·
[cambios respecto a la v1](changes-from-v1.md)

---

## Índice

| ID | Fecha | Decisión | Estado | Manual |
|---|---|---|---|---|
| D-001 | 2026-10-15 | Objetivo de la v2: reemplazar al QA humano en proyectos sin QA | Vigente | Introducción |
| D-002 | 2026-10-15 | Dos etapas de QA: pre-review y To Test | Vigente | Flujo de trabajo |
| D-003 | 2026-10-15 | Gate pre-review por hook sobre el MCP de ClickUp, más modo manual | Vigente | Flujo de trabajo |
| D-004 | 2026-10-15 | El gate actúa en In Progress → In Review | Vigente | Flujo de trabajo |
| D-005 | 2026-10-15 | Pre-review prueba contra el localhost del dev | Vigente | Flujo de trabajo, Requisitos |
| D-006 | 2026-10-15 | Pre-review bloquea sin crear tickets; bypass registrado | Vigente | Flujo de trabajo |
| D-007 | 2026-10-15 | El vault del proyecto es fuente de casos, en solo lectura | Vigente | Fuentes de casos |
| D-008 | 2026-10-15 | To Test hace un testeo completo con bugs asignados al dev | Vigente | Flujo de trabajo |
| D-009 | 2026-10-15 | To Test prueba contra staging compartido | Vigente | Flujo de trabajo, Requisitos |
| D-010 | 2026-10-15 | To Test se dispara a mano o por barrido de la columna | Vigente | Comandos |
| D-011 | 2026-10-15 | El ticket se mueve según la severidad de los bugs | Vigente | Flujo de trabajo |
| D-012 | 2026-10-15 | Un motor (`qa-ticket-test`) con dos profundidades + orquestador `qa-lead` | Vigente | Comandos |
| D-013 | 2026-10-15 | Un PASS vale para un commit SHA | Vigente | Flujo de trabajo |
| D-014 | 2026-10-15 | Caja negra con una excepción: leer el diff para decidir qué probar | Vigente | Cómo prueba el agente |
| D-015 | 2026-10-15 | Confirmación antes de crear tickets hasta medir confiabilidad | Vigente | Reporte de bugs |
| D-016 | 2026-10-15 | Orden de la hoja de ruta: To Test antes que el gate | Vigente | — |
| D-017 | 2026-10-15 | Estrategia de branches: integración + un branch por subproyecto | Vigente | — |
| D-018 | 2026-10-15 | Solo Claude Code (se elimina el soporte de Codex) | Implementada | Requisitos |
| D-019 | 2026-10-15 | Playwright MCP en `.mcp.json` con versión fija | Implementada | Instalación |
| D-020 | 2026-10-15 | El agente `qa-regression` pasa a llamarse `qa-e2e-runner` | Implementada | Comandos |
| D-021 | 2026-10-15 | El HTML manual se genera con `/qa-report-render` | Implementada | Reportes |
| D-022 | 2026-10-15 | La v2 es un plugin que reemplaza el modelo de template | Vigente | Instalación |
| D-023 | 2026-10-15 | Este repo es el marketplace; el plugin vive en `plugins/qa-agent/` | Vigente | Instalación |
| D-024 | 2026-10-15 | El contexto de QA vive en `.qa-agent/context/` | Vigente | Configuración |
| D-025 | 2026-10-15 | Secretos en `.qa-agent/.env`; se elimina `CLICKUP_API_KEY` | Vigente | Configuración |
| D-026 | 2026-10-15 | Se elimina OpenKnowledge (`ok init`) | Vigente | Configuración |
| D-027 | 2026-10-15 | `e2e-tests/` sale del repo; el runner usa la suite del proyecto | Vigente | Comandos |
| D-028 | 2026-10-15 | `CLAUDE.md` se reemplaza por la skill `qa-protocol` + hook de estado | Vigente | — |
| D-029 | 2026-10-15 | Config por proyecto en `.qa-agent/config.json` y sus reglas | Vigente | Configuración |
| D-030 | 2026-10-15 | Las skills de otros plugins son opcionales | Vigente | Requisitos |

---

## Brainstorming de la v2

### D-001 — Objetivo de la v2

- **Decisión:** la v2 es la base para reemplazar al QA humano en proyectos donde no se puede contar con
  uno. Debe correr sin alguien que le conteste preguntas y su veredicto debe ser confiable como para
  liberar o devolver un ticket.
- **Contexto:** en esos proyectos, en "To Test" el dev prueba el happy path y pasa el ticket a Done,
  o no se prueba nada.
- **Consecuencia:** se priorizan la configuración por proyecto (menos preguntas), la integración con
  ClickUp y la medición de confiabilidad.

### D-002 — Dos etapas de QA

- **Decisión:** hay dos momentos de QA: **pre-review** (filtro rápido antes del code review) y
  **To Test** (testeo completo del ticket).
- **Contexto:** el usuario quería tanto un gate automático como cubrir el hueco de To Test, que son
  objetivos distintos.
- **Consecuencia:** un solo motor con dos profundidades (D-012).

### D-003 — Gate pre-review por hook

- **Decisión:** además del modo manual, un hook `PreToolUse` intercepta la llamada de Claude a
  `clickup_update_task`. Si no hay un QA PASS válido, deniega con un motivo que le indica a Claude
  qué prueba correr. El hook es solo el portero: **nunca ejecuta la prueba**.
- **Alternativas:** ejecutar la prueba dentro del hook (descartado: los hooks tienen timeout y correr
  un navegador ahí es frágil); automatización de ClickUp o CI (queda como complemento futuro).
- **Consecuencia:** el hook solo ve los cambios hechos vía Claude. Si alguien mueve el ticket desde la
  UI de ClickUp, el gate no se entera; funciona si el equipo mueve los tickets vía Claude.

### D-004 — Transición del gate

- **Decisión:** el gate actúa cuando el dev mueve el ticket de **In Progress → In Review**.
- **Contexto:** después del code review el ticket pasa a To Test. El gate es QA *shift-left*, no el
  reemplazo de To Test.

### D-005 — Ambiente de pre-review

- **Decisión:** pre-review prueba contra el **localhost** del dev.
- **Consecuencia:** todo corre en la máquina del dev; no hace falta CI para esta etapa. Hace falta un
  pre-flight "el servidor local responde" y cuentas de prueba del seed local (si faltan → BLOCKED).

### D-006 — Hallazgos en pre-review

- **Decisión:** si encuentra bugs, **bloquea y avisa al dev, sin crear tickets**. Existe un bypass
  explícito ("mover igual, motivo: X") que queda registrado como comentario en el ticket.
- **Alternativas:** crear tickets siempre; que el dev decida por severidad.
- **Porqué del bypass:** un gate sin salida frena al dev ante un falso positivo y termina desactivado.
  Registrado, el reviewer lo ve y los falsos positivos se pueden medir.

### D-007 — El vault como fuente de casos

- **Decisión:** el vault de Obsidian vive en el repo del proyecto, organizado con mapas de concepto por
  feature o módulo. El agente entra por los mapas, sigue los `[[wikilinks]]` uno o dos niveles, y
  usa las reglas de negocio para generar casos negativos y bordes.
- **Reglas:** solo lectura; si la app contradice una nota, se reporta como *discrepancia con la
  documentación*, no como bug; el reporte cita las notas usadas; sin documentación no se inventan
  reglas (se declara la brecha de cobertura).
- **Consecuencia:** al estar versionado con el código, el agente prueba contra la documentación del
  mismo branch.

### D-008 — Testeo completo en To Test

- **Decisión:** To Test hace un testeo completo del ticket: criterios de aceptación, reglas del vault,
  negativos y bordes, flujos vecinos y viewports. Deja una matriz criterio → casos → resultado →
  evidencia, y crea bug tickets **asignados al assignee del ticket original** y vinculados a él.
- **Contexto:** es el hueco principal que describió el usuario.

### D-009 — Ambiente de To Test

- **Decisión:** To Test prueba contra **staging/dev compartido**.
- **Consecuencia:** cualquiera puede correrlo. Pre-flight obligatorio: el código del ticket está
  desplegado (si no → BLOCKED, no FAIL). Datos compartidos: cuentas propias del agente, datos con
  prefijo identificable y limpieza al terminar. El scoping usa el diff del PR mergeado.

### D-010 — Disparo de To Test

- **Decisión:** **manual** (un ticket) **+ barrido** de la columna To Test.
- **Alternativas:** hook al mover a To Test; solo barrido.

### D-011 — Resultado del ticket según severidad

- **Decisión:** sin bugs o solo Low → **Done**. Algún High o Medium → vuelve a **In Progress** con los
  bugs vinculados. Siempre se comenta el reporte.
- **Alternativas:** no mover nunca; cualquier bug devuelve el ticket; configurable por proyecto.

### D-012 — Arquitectura: motor único y orquestador

- **Decisión:** un agente `qa-ticket-test` con `--depth=quick|full` (pre-review usa `quick`, To Test
  usa `full`) y un orquestador `qa-lead` para el barrido. Las skills son el conocimiento compartido.
- **Criterio general:** skills = el *cómo*; agentes = el *quién*; orquestador = solo cuando el trabajo
  es grande y paralelizable.
- **Consecuencia:** el barrido v1 es **secuencial**, porque Playwright MCP comparte navegador y perfil
  por sesión. El paralelo (un proceso por ticket) queda para más adelante.

### D-013 — PASS por commit

- **Decisión:** "reciente" se mide contra el código: un PASS vale para un commit SHA. Commits nuevos
  lo invalidan y el gate vuelve a bloquear.

### D-014 — Excepción a la caja negra

- **Decisión:** el agente puede leer el diff y el ticket **solo para decidir qué probar**. Juzga
  únicamente por lo que observa en el navegador.
- **Contexto:** con el plugin instalado en el repo del proyecto, el agente tiene acceso al código.

### D-015 — Confirmación antes de crear tickets

- **Decisión:** se mantiene la confirmación manual antes de crear tickets hasta que el benchmark de
  confiabilidad demuestre que el agente es fiable. Después se puede quitar por proyecto.

### D-016 — Orden de la hoja de ruta

- **Decisión:** saneamiento → plugin + config → `findings.json` + adaptador ClickUp →
  `qa-ticket-test` full → `qa-lead` → gate pre-review. El benchmark corre en paralelo desde
  `qa-ticket-test`.
- **Porqué:** To Test va antes que el gate porque es donde está el hueco principal.

### D-017 — Estrategia de branches

- **Decisión:** `feature/qa-agent-v2` es el branch de integración; cada subproyecto tiene un branch
  corto que se mergea a él. `main` sigue siendo la v1 que usan los QAs y solo recibe la v2 completa
  y probada.

---

## Saneamiento (subproyecto 1)

### D-018 — Solo Claude Code

- **Decisión:** se eliminan `AGENTS.md` y `.agents/skills`.
- **Contexto:** el equipo usa solo Claude Code. `AGENTS.md` era una copia desactualizada de `CLAUDE.md`
  con una ruta rota, y el symlink quedaba como archivo de texto en Windows.

### D-019 — Playwright MCP en `.mcp.json`

- **Decisión:** el servidor se define en `.mcp.json` con `@playwright/mcp@0.0.83` fijo.
- **Contexto:** Claude Code no lee `mcpServers` desde los archivos de settings, así que el ejemplo de
  la v1 nunca conectaba Playwright. `@latest` hacía que cada máquina corriera una versión distinta.
- **Nota:** D-023 mueve este archivo dentro del plugin.

### D-020 — Agente renombrado a `qa-e2e-runner`

- **Decisión:** el agente que corre la suite scripteada se llama `qa-e2e-runner`; la skill
  `/qa-regression` (flujos de `context/`) mantiene su nombre.
- **Contexto:** compartían nombre y dos skills mandaban al usuario a la equivocada.

### D-021 — HTML manual con `/qa-report-render`

- **Decisión:** `qa-report-render` es invocable a mano (`/qa-report-render <qa-report.md>`);
  `qa-report-test-execution` sigue siendo interna.
- **Contexto:** el diseño aprobado proponía hacer invocable `qa-report-test-execution`, pero esa skill
  recibe resultados crudos de una corrida, no la ruta a un reporte. Se corrigió durante la
  implementación y se informó al usuario.

---

## Plugin + config por proyecto (subproyecto 2)

### D-022 — La v2 es un plugin y reemplaza al template

- **Decisión:** la v2 se instala como plugin de Claude Code en el **repo de código** de cada proyecto.
  Reemplaza el modelo "un repo de QA por proyecto creado desde el template". Los QAs siguen con `main`
  (v1) hasta migrar.
- **Alternativas:** que convivan ambos modelos; mantener el template.
- **Porqué:** el agente necesita ver el vault, los PRs y la suite e2e del proyecto, y la config tiene
  que vivir donde trabaja el equipo.

### D-023 — Layout del marketplace

- **Decisión:** este repo es el marketplace `spacedev-qa` (`.claude-plugin/marketplace.json`) y el
  plugin `qa-agent` vive en `plugins/qa-agent/`.
- **Alternativas:** plugin en la raíz con `source: "."` (patrón no documentado; el plugin arrastraría
  todo el repo); comando `/qa-install` que copie archivos al proyecto (cada copia diverge y las
  actualizaciones son manuales).
- **Consecuencia:** cada dev necesita acceso de lectura a `SpaceUY/qa-team-spacedev` y git autenticado
  sin prompts (`gh auth setup-git`).

### D-024 — Contexto de QA en `.qa-agent/context/`

- **Decisión:** el mapa de navegación, los quirks conocidos y los flujos de regresión viven en
  `.qa-agent/context/` del repo del proyecto.
- **Alternativas:** dentro del vault; mixto.
- **Porqué:** el agente escribe ahí (fechas de última corrida, flujos nuevos) y el vault es de solo
  lectura (D-007).

### D-025 — Secretos en `.qa-agent/.env`

- **Decisión:** las credenciales de prueba viven en `.qa-agent/.env` (gitignored, por proyecto). Se
  elimina `CLICKUP_API_KEY`.
- **Alternativas:** `userConfig` del plugin con valores sensibles en el almacén seguro del sistema.
- **Porqué:** `userConfig` es por usuario, no por proyecto, y las credenciales de prueba cambian de
  proyecto a proyecto. `CLICKUP_API_KEY` no la usaba ninguna skill: todo pasa por el conector.

### D-026 — Se elimina OpenKnowledge

- **Decisión:** `/qa-project-setup` deja de correr `ok init`.
- **Porqué:** el vault y `.qa-agent/context/` cubren su rol, y era una dependencia más que instalar.

### D-027 — `e2e-tests/` sale del repo

- **Decisión:** se eliminan `e2e-tests/` y su workflow de este repo. `qa-e2e-runner` corre la suite
  del proyecto, en la ruta de `e2e.path` (por defecto `e2e-tests/`).

### D-028 — `CLAUDE.md` → `qa-protocol` + hook de estado

- **Decisión:** el protocolo de `CLAUDE.md` pasa a la skill `qa-protocol`, que los agentes precargan.
  Un hook `SessionStart` inyecta como máximo 5 líneas con el estado de la config.
- **Contexto:** un plugin no puede traer un `CLAUDE.md`.
- **Alternativa:** inyectar el protocolo completo por hook en cada sesión (caro en tokens).
- **Consecuencia:** las 440 líneas que la v1 cargaba en cada sesión se cargan solo cuando se usan.

### D-029 — Config por proyecto

- **Decisión:** `.qa-agent/config.json` commiteado, con idioma, viewports, ambientes (URL y cuentas
  por rol), ClickUp (listas, sprint o kanban, folder de sprints), vault, repo y ruta de la suite e2e.
  Se configura con `/qa-config`.
- **Reglas:** precedencia chat > config > preguntar; el agente dice en una línea qué tomó de la config;
  la config solo guarda nombres de variables, nunca secretos; sin config, las skills preguntan como
  en la v1; los campos nuevos se agregan como opcionales.
- **Detalle:** ver §4 de la spec del subproyecto 2.

### D-030 — Skills de otros plugins son opcionales

- **Decisión:** `frontend-design:frontend-design` y `superpowers:verification-before-completion` se
  usan si están instaladas; si no, se omiten y el reporte lo dice.
- **Porqué:** viven en otros plugins y el nuestro no puede garantizar que estén.
