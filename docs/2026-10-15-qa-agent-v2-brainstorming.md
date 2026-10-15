# QA Agent v2 — Resumen del brainstorming

**Fecha:** 2026-10-15
**Branch:** `feature/qa-agent-v2`
**Estado:** exploración cerrada. El saneamiento (subproyecto 1) está hecho; el resto está pendiente de spec.
**Ver también:** [registro de decisiones](decisions.md) · [cambios respecto a la v1](changes-from-v1.md)

---

## 1. Objetivo

Hoy los agentes de QA de este repo complementan el trabajo de los QA humanos. La v2 busca que sean
la base para **reemplazarlos en proyectos donde no se puede contar con QA humano**.

En esos proyectos, cuando un ticket llega a "To Test", hoy pasa una de dos cosas: el developer prueba
el happy path y lo pasa a Done, o no se prueba nada. La v2 tiene que cubrir ese hueco con un testeo
completo del ticket que:

- no se limite al happy path: criterios de aceptación, reglas de negocio, casos negativos y bordes;
- deje evidencia de que se testeó;
- levante los bugs que encuentre y los asigne al developer que hizo la tarea;
- mueva el ticket según el resultado.

Para eso el agente tiene que poder correr **sin alguien que le conteste preguntas** y su veredicto
tiene que ser **confiable** como para liberar o devolver un ticket.

---

## 2. Auditoría del repo (estado al 2026-10-15)

### Lo que ya funciona bien

- `qa-evidence-discipline`: la separación PASS / FAIL / BLOCKED, la corrección de falsos positivos
  por escrito, y la regla de que "esperar más no es diagnóstico". Es el criterio más difícil de
  conseguir en un agente y ya existe.
- Manejo de credenciales: `.env` solo se lee desde el shell, nunca se imprime.
- Gates de seguridad: nada de datos de producción, pagos ni acciones masivas o externas.

### Inconsistencias encontradas

| # | Problema | Estado |
|---|---|---|
| 1 | `AGENTS.md` era una copia de `CLAUDE.md` con "Claude" → "Codex" (ruta rota `.Codex/...`, tabla de skills desactualizada). `.agents/skills` era un symlink que en Windows quedaba como archivo de texto. | ✅ Resuelto: se eliminó el soporte de Codex (el equipo usa solo Claude Code). |
| 2 | Playwright MCP estaba en `settings.local.json.example` bajo `mcpServers`, clave que Claude Code no lee desde settings. También tenía `allowedTools` (clave inválida), `@playwright/mcp@latest` sin fijar, y permisos `echo`/`python3` innecesarios. | ✅ Resuelto: `.mcp.json` commiteado con versión fija; el ejemplo de settings solo pre-aprueba el servidor. |
| 3 | `qa-regression` era a la vez un agente (suite scripteada `e2e-tests/`) y una skill (flujos de `context/`). `qa-ad-hoc` y `qa-api-regression` mandaban a la skill equivocada. | ✅ Resuelto: el agente pasó a llamarse `qa-e2e-runner`. |
| 4 | La documentación decía que `/qa-report-test-execution <path>` genera el HTML, pero esa skill es interna y recibe resultados crudos. La que renderiza un `qa-report.md` es `qa-report-render`. | ✅ Resuelto: `qa-report-render` es invocable a mano. |
| 5 | `CLAUDE.md` decía que la skill de bugs asocia al sprint y pone estado OPEN; no hace ninguna de las dos. | ✅ Resuelto en la documentación. |
| 6 | Restos de proyectos anteriores: "TradingView" en `qa-blackbox`, `ps aux` (no funciona en Windows) en `qa-project-setup`. | ✅ Resuelto. |
| 7 | Hay tres protocolos "oficiales" para URL + flujo que no coinciden: `CLAUDE.md` (`qa-blackbox` → `frontend-design`), `qa-ui-tester` (`qa-blackbox` → `qa-platform-discovery` → `qa-app-regression` …) y `qa-app-regression`, que dice que lo invocan `qa-smoke-test` y `qa-regression` (no lo hacen). | ⏳ Diferido al subproyecto 4 (`qa-ticket-test` lo reemplaza). |
| 8 | Hay cuatro plantillas de reporte (blackbox, smoke, regression, `qa-report-test-execution`) y el parser de ClickUp depende de markdown exacto (em dash, bullets con `-`, sin `---`). `CLAUDE.md` promete un `findings.json` que ninguna skill escribe. | ⏳ Diferido al subproyecto 3. |
| 9 | `report-bugs-to-clickup` pide el Sprint List ID y no lo usa. Además, el Bug Register solo tiene "Description", pero el ticket exige Steps / Actual / Expected: o se dejan vacíos o se inventan, lo que contradice "never fabricate". | ⏳ Diferido al subproyecto 3. |
| 10 | La regla "no subagents" de los agentes dice que la evidencia de un subagente se pierde. No es así: lo que guarda en disco persiste; solo se pierde su transcript. La regla impide paralelizar. | ⏳ Diferido al subproyecto 5 (`qa-lead`). |

### Fricción con el flujo de desarrollo (el problema de fondo)

- **Demasiadas preguntas por sesión.** Un smoke test seguido de la carga de bugs hace unas 10
  preguntas (idioma, viewport, URL, cuenta, ruta, sincronizar regresión, Bugs List, Sprint,
  assignee, confirmación), casi todas con la misma respuesta siempre dentro de un proyecto.
  **Mientras el agente pregunte, no puede correr solo.**
- **El agente vive en su propio repo, no en el del proyecto.** No ve el PR ni el diff, y
  `evidence/` (gitignored) queda solo en la PC de quien lo ejecutó.
- **Todo es exploración con LLM vía MCP**, incluso las regresiones, que deberían ser idénticas en
  cada corrida. Es lento, caro y no determinístico.
- **No hay forma de medir si el agente es confiable** (falsos positivos y bugs que se le escapan).
  Sin eso, el reemplazo no se puede justificar.

---

## 3. Decisiones tomadas

| Pregunta | Decisión | Por qué / implicancias |
|---|---|---|
| ¿Qué dispara la prueba de un ticket? | **Manual** + **hook** sobre la llamada al MCP de ClickUp. | El hook solo ve los cambios que hace Claude; si alguien mueve el ticket desde la UI de ClickUp no se entera. Sirve como gate si el equipo adopta la convención de mover tickets vía Claude. |
| ¿En qué transición actúa el gate del hook? | **In Progress → In Review** (antes del code review). | Es QA *shift-left*: un filtro antes del review, no el reemplazo de "To Test". |
| ¿Contra qué ambiente prueba el gate? | **Localhost del dev.** | Todo corre en la máquina del dev; no hace falta CI para esta etapa. Pre-flight: el servidor local responde. |
| ¿Qué pasa si el gate encuentra bugs? | **Bloquea y avisa al dev, sin crear tickets.** | Es trabajo en curso del propio dev; corrige en su branch y reintenta. |
| ¿Dónde vive el vault de Obsidian? | **En el repo del proyecto.** | Va versionado junto con el código: el agente prueba contra la documentación del mismo branch. |
| ¿Cómo está organizado el vault? | **Mapas de concepto por feature/módulo** (siguiendo la skill de Mario). | El agente entra por los mapas y sigue los `[[wikilinks]]` en lugar de leer todo el vault. |
| ¿Qué pasa hoy en "To Test" sin QA humano? | El dev prueba el happy path y lo pasa a Done, o nada. | **Es el hueco principal** que la v2 tiene que cubrir. |
| ¿Dónde está el código en "To Test"? | **Staging/dev compartido.** | Cualquiera puede correr la prueba, no solo el dev. Hay que verificar que el código esté desplegado y cuidar los datos compartidos. |
| ¿Qué dispara el testeo en "To Test"? | **Manual** (un ticket) **+ barrido** de la columna. | El barrido justifica un orquestador (`qa-lead`). |
| ¿Qué hace el agente con el ticket original? | **Según severidad.** | Sin bugs o solo Low → Done. Algún High o Medium → vuelve a In Progress con los bugs vinculados. Siempre comenta el reporte. |
| ¿Codex? | **Solo Claude Code.** | Se eliminó `AGENTS.md` y `.agents/`. |

---

## 4. Flujo de destino

### Las dos etapas de QA

| | **Pre-review** | **To Test** ← el hueco principal |
|---|---|---|
| Transición | In Progress → In Review | To Test → Done / In Progress |
| Ambiente | Localhost del dev | Staging compartido |
| Disparo | Hook `PreToolUse` sobre ClickUp + manual | Manual (un ticket) + barrido de la columna |
| Profundidad | `quick`: criterios de aceptación + happy path + validaciones obvias | `full`: criterios de aceptación + vault + negativos y bordes + flujos vecinos + viewports |
| Hallazgos | Bloquea y avisa al dev; sin tickets; bypass registrado | Bug tickets asignados al dev, vinculados al ticket original, con evidencia |
| Resultado | Deja pasar o bloquea el cambio de estado | Sin bugs o solo Low → Done. High o Medium → In Progress. Siempre comenta. |
| Pre-flight propio | El servidor local responde | El código del ticket está desplegado en staging (si no, BLOCKED) |

### Pre-review, paso a paso

1. El dev trabaja en su branch con el servidor en localhost y Claude Code abierto en el repo del proyecto.
2. Le pide a Claude mover el ticket de In Progress → In Review.
3. Un hook `PreToolUse` intercepta `clickup_update_task`. El matcher es una regex
   (`mcp__.*[Cc]lick[Uu]p.*__clickup_update_task`) porque el id del servidor MCP cambia entre sesiones.
4. Si el estado destino está protegido, el hook busca un QA PASS de ese ticket **para el commit actual**.
5. Si no lo hay, **deniega con un motivo** ("Corre `/qa-ticket-test <id> --depth=quick` antes de moverlo").
   Claude lee el motivo, corre la prueba y reintenta.
6. PASS → comenta el veredicto con evidencia en el ticket y el cambio de estado pasa.
   FAIL → bloquea y muestra el reporte al dev.

El hook es **solo el portero**: nunca ejecuta la prueba él mismo, porque tiene timeout y correr un
navegador dentro de un hook es frágil.

**Salida de emergencia:** un bypass explícito ("mover igual, motivo: X") que queda registrado como
comentario en el ticket. Sin bypass, un falso positivo frena al dev y la gente termina desactivando
el gate. Con el bypass registrado, el reviewer lo ve y los falsos positivos se pueden medir.

### To Test, paso a paso

1. Pre-flight: el código del ticket está desplegado en staging. Se compara la versión desplegada
   (endpoint `/version`, SHA en el footer o estado del pipeline, según el proyecto) con el merge del
   ticket. Si no coincide → BLOCKED, no FAIL.
2. Fuentes de casos: el ticket y sus criterios de aceptación (leídos frescos de ClickUp), el vault
   recorrido por sus mapas de concepto, y el diff del PR mergeado (encontrado por el ID del ticket en
   el branch o en los commits).
3. Testeo en profundidad `full`, con las técnicas de `qa-app-regression` (particiones de equivalencia,
   valores límite, error guessing) a los viewports de la config.
4. Reporte con **matriz criterio de aceptación → casos → resultado → evidencia**.
5. Bugs: un ticket por bug en la Bugs List, asignado al assignee del ticket original y vinculado a él.
6. Ticket original: se comenta el reporte y se mueve según severidad.

---

## 5. Arquitectura propuesta

| Pieza | Tipo | Qué hace |
|---|---|---|
| `qa-ticket-test` | Agente (un ticket) | Lee ticket + vault + diff → verifica el ambiente → prueba con `--depth=quick\|full` → escribe `findings.json` → actúa en ClickUp según la etapa |
| `qa-lead` | Orquestador | Lista los tickets en To Test → descarta los no desplegados (BLOCKED) → corre `qa-ticket-test` por ticket → consolida un resumen del barrido |
| Skills | Conocimiento compartido | Técnicas de testeo, disciplina de evidencia, contrato `findings.json`, adaptador de ClickUp, búsqueda en el vault |

**¿Agente, skill u orquestador?** Depende del caso de uso:

- **Skills** = el *cómo*: protocolos, criterios, formatos.
- **Agentes** = el *quién*: un trabajador con contexto y permisos propios.
- **Orquestador** = solo cuando el trabajo es grande y paralelizable (barrido de To Test,
  más adelante regresión o auditoría completa).

**Paralelismo del barrido.** Playwright MCP comparte un navegador y un perfil por sesión; varios
subagentes en paralelo se pisarían las pestañas y los logins.

- v1: barrido **secuencial**, a demanda. Más lento, pero confiable.
- v2: un proceso por ticket (`claude -p` con su propio Playwright MCP aislado), cuando el volumen lo justifique.

### Configuración

| Qué | Dónde | Contenido |
|---|---|---|
| Config del proyecto | Commiteada en el repo del proyecto | Herramienta de PM, Bugs List, folder de sprints (no el Sprint List ID, que rota), sprint o kanban, estados protegidos, idioma, viewports, URL local, URL de staging, cómo verificar el deploy, cuentas esperadas, ruta del vault y su mapa raíz, repo |
| Secretos | Archivo local gitignored, en la PC de cada ejecutor | Credenciales de prueba, API key de ClickUp |

Se configura con un comando `/qa-config`. Con la config completa, las preguntas por sesión desaparecen.

### Contrato de datos: `findings.json`

Es la fuente de verdad de cada corrida. El markdown, el HTML y los tickets se generan desde ahí.
Como mínimo guarda: ID del ticket, commit SHA, etapa y profundidad, ambiente, veredicto, casos con su
resultado y evidencia, bugs, notas del vault usadas. Reemplaza las cuatro plantillas y el parsing
frágil de markdown, y es lo que el hook consulta para saber si hay un PASS válido.

---

## 6. Reglas de la v2

- **Caja negra, con una excepción explícita.** El agente puede leer el diff y el ticket **solo para
  decidir qué probar**. Juzga únicamente por lo que observa en el navegador.
- **El vault es de solo lectura** durante el QA. Si la app contradice una nota, se reporta como
  *discrepancia con la documentación*, no como bug; el dev decide cuál está mal. El reporte cita las
  notas usadas.
- **Sin documentación no se inventan reglas.** Si no hay mapa ni notas del módulo, se declara como
  brecha de cobertura.
- **"Reciente" se mide contra el código:** un PASS vale para un commit SHA. Commits nuevos lo invalidan.
- **Staging es compartido:** cuentas propias del agente, datos con prefijo identificable
  (por ejemplo `qa-bot-…`), limpieza al terminar.
- **Confirmación antes de crear tickets**, hasta que el benchmark demuestre que el agente es
  confiable. Después se puede quitar por proyecto.
- Se mantiene todo lo de `qa-evidence-discipline` y los gates actuales.

---

## 7. Hoja de ruta

| # | Subproyecto | Tipo | Estado |
|---|---|---|---|
| 1 | Saneamiento (puntos 1–6 de la auditoría) | Bounded | ✅ Hecho (`feature/qa-agent-v2-cleanup`, mergeado) |
| 2 | Plugin de Claude Code + config por proyecto (`/qa-config`) | Arquitectural | Siguiente: requiere spec |
| 3 | Contrato `findings.json` + adaptador de ClickUp (assignee del ticket, vincular, comentar, mover según severidad) | Arquitectural | Pendiente |
| 4 | `qa-ticket-test` con profundidad `full` (To Test) + vault | Arquitectural | Pendiente |
| 5 | `qa-lead`: barrido secuencial de To Test | Arquitectural | Pendiente |
| 6 | Gate pre-review: profundidad `quick` + hook + bypass | Arquitectural | Pendiente |
| ∥ | Benchmark de confiabilidad (app con bugs sembrados; precisión y recall) | — | Arranca en paralelo desde el paso 4 |
| Después | Barrido en paralelo y programado (CI / headless), regresión con specs Playwright determinísticos, auditorías completas con orquestador | — | — |

To Test va antes que el gate pre-review porque es donde está el hueco principal.

**Forma de trabajo:** `feature/qa-agent-v2` es el branch de integración. Cada subproyecto tiene su
propio branch corto que se mergea a él. `main` sigue siendo la versión que usan los QAs hoy y solo
recibe la v2 completa cuando esté probada.

---

## 8. Preguntas abiertas

- Cómo verifica cada proyecto qué versión está desplegada en staging (endpoint, footer, pipeline).
- Qué cuentas y datos de prueba existen en local y en staging para cada proyecto.
- Si conviene sumar una automatización de ClickUp para que el gate cubra también los cambios de
  estado hechos desde la UI.
- Cuándo y cómo se programa el barrido (requiere una máquina o CI que lo ejecute).
