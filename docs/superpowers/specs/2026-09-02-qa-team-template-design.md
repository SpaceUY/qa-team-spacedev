# Design: `qa-team` as a QA department template repo

**Date:** 2026-09-02
**Author:** Julia Disarli (julia.disarli@otonomi.ai)
**Status:** Approved

## Purpose

Turn `qa-team` from a single-project repo into a **reusable template** for
the whole QA department: any tester creates their own separate repo per
client/project (e.g. `qa-otonomi`, `qa-catalyst`) from this template, and
gets, from day one, the same execution skills, the same three testing
scenarios, and an OpenKnowledge (OK) project scaffolded and ready to be
filled in — via a guided setup skill — with that project's own navigation
map and regression flows.

This replaces today's model, where `qa-agent` is a standalone module with
no persistent context: every session starts blank, navigation has to be
re-explained each time, there's no record of the current sprint/ticket
being smoke-tested, and there's no living list of core regression flows.

## Scope decision: template repo, not a multi-project monorepo

Two models were considered:

1. **Multi-project monorepo** — `qa-team/projects/otonomi/`,
   `qa-team/projects/catalyst/`, all living inside this one repo.
2. **Template repo** — `qa-team` carries only the shared skeleton (skills +
   empty OK scaffold); each project becomes its own separate repo created
   from it.

**Chosen: (2), template repo.** Each tester's project gets full repo
independence (its own git history, its own access control, its own OK
project with no risk of cross-project contamination), and there is no
need to solve "how do multiple projects' contexts coexist without
colliding" inside one repo — a problem the monorepo model would otherwise
require solving with per-project skill duplication or symlinks.

## Distribution mechanism: GitHub Template Repository

`qa-team` is marked as a GitHub **Template repository**. A tester creates
their own project repo via GitHub's "Use this template" button (or
`gh repo create --template <owner>/qa-team`), which produces a new repo
with the template's file tree but a fresh, empty git history — not a fork,
not a clone with `.git` still pointing at `qa-team`.

Rationale over manual clone+reinit: native GitHub mechanism, zero manual
steps prone to error (forgetting to strip `.git`, accidentally pushing back
to the template), and it's the standard, well-understood pattern for
"repo I want copies of," which is exactly what this is.

## Repo structure (in every project repo created from the template)

```
qa-<project>/
├── .claude/
│   └── skills/
│       ├── qa-blackbox/SKILL.md          ← Exploratory (existing, adapted)
│       ├── qa-smoke-test/SKILL.md        ← Smoke (new)
│       ├── qa-regression/SKILL.md        ← Regression (new)
│       ├── qa-text-check/SKILL.md        ← existing, moved here
│       ├── qa-project-setup/SKILL.md     ← new — the guided-setup skill
│       ├── report-bugs-to-clickup/
│       └── report-improvements-to-clickup/
├── .ok/                                   ← OpenKnowledge project config (post `ok init`)
├── context/                               ← OK content, filled in by qa-project-setup
│   ├── navigation-map.md                  ← Exploratory
│   ├── regression-flows.md                ← Regression (+ written to by Smoke)
│   └── README.md                          ← explains each file, for a human reading without Claude
├── evidence/                              ← gitignored, session output (screenshots, reports)
├── CLAUDE.md
└── README.md
```

**What moves and what doesn't:**

- `qa-blackbox`, `qa-text-check`, `report-bugs-to-clickup`,
  `report-improvements-to-clickup` — all of `qa-team`'s own skills — are
  consolidated into a single `.claude/skills/` at the repo root. Today
  they're split between `qa-agent/.agents/skills/` and the root
  `.claude/skills/`; that split existed because `qa-blackbox` needed
  Playwright MCP (only configured under `qa-agent/`) while the ClickUp
  skills needed the ClickUp MCP (only configured at the root). Going
  forward, the whole repo is one project with one `.claude/settings.local.json`
  carrying both MCP servers, so the split is no longer needed.
- `frontend-design` and `verification-before-completion` remain
  third-party/plugin skills, invoked the same way `qa-blackbox` already
  invokes them — they are not moved or copied into this repo's own
  `.claude/skills/`.
- `qa-agent/` as a standalone directory goes away; its `CLAUDE.md` content
  (the standard test scenarios table, evidence folder naming rules, "no
  scripts" rule, etc.) moves to the repo-root `CLAUDE.md`, since the whole
  repo is now the "QA agent." Its `README.md` content (prerequisites,
  Playwright browser install step, MCP settings setup, troubleshooting)
  moves to the repo-root `README.md` for the same reason — a tester
  cloning their new project repo should find one README with everything
  needed to get a working session running, not have to know a `qa-agent/`
  subdirectory used to exist.

### Why skills work from any subdirectory

Claude Code discovers project-level skills at `.claude/skills/` starting
from the session's working directory and walking **up to the repository
root** — a session started in any subdirectory still sees skills defined
at the repo root. This was verified against Claude Code's own
documentation before adopting this structure: it means every skill above
is visible regardless of where inside the repo a tester happens to start
`claude`, with no symlinks or per-subdirectory duplication needed.

## The three execution scenarios

| Scenario | Skill | Reads from `context/` | Writes to `context/` |
|---|---|---|---|
| Exploratory | `qa-blackbox` (existing, adapted) | `navigation-map.md` | — |
| Smoke | `qa-smoke-test` (new) | — (ticket passed at invocation) | `regression-flows.md` (conditionally, see below) |
| Regression | `qa-regression` (new) | `regression-flows.md` | `regression-flows.md` (last-run history) |

### Exploratory (`qa-blackbox`, adapted)

Before running its existing protocol (unchanged: quality dimensions,
scoring, standard scenarios), it reads `context/navigation-map.md` to
learn:

- Base URL and the site's route/sidebar/tab structure, so it knows what
  to visit instead of discovering it cold every session.
- Which test user/credentials to use — a *reference* to where real
  credentials are stored (e.g. a secrets manager or password vault), never
  a plaintext password committed to the repo.
- Known visual/UX quirks that are not bugs (e.g. "sidebar collapses on
  mobile by design," "logo is slow to load due to a third-party CDN"), so
  they aren't reported as false positives session after session.

If `navigation-map.md` doesn't exist yet or is empty, `qa-blackbox` tells
the user to run `/qa-project-setup` first rather than guessing or
crawling blind.

### Smoke (`qa-smoke-test`, new)

Invoked as `/qa-smoke-test <ClickUp ticket link or ID>`. Ticket context
(title, description, acceptance criteria) is fetched fresh from ClickUp
via the ClickUp MCP at invocation time — **never persisted** in
`context/`, since a ticket's content is a moving target during a sprint
and stale ticket data would be actively misleading. It runs a focused set
of checks scoped to that ticket's feature, not `qa-blackbox`'s full
protocol.

**End-of-run regression sync (new requirement):** after every
`/qa-smoke-test` run, regardless of whether the smoke test passed or
found bugs, the skill asks the user (via `AskUserQuestion`, never
assumed) one of:

1. **Add** this as a new flow to `context/regression-flows.md` — the
   ticket introduced a feature that should now be part of the ongoing
   regression set.
2. **Update** an existing flow entry in `context/regression-flows.md` —
   the ticket changed a step, a test data value, or a URL for a flow
   that's already documented there.
3. **Skip** — this ticket doesn't warrant a regression-flows change (e.g.
   a minor cosmetic fix).

If the user picks Add or Update, `qa-smoke-test` writes directly to
`context/regression-flows.md` using the steps and test data it exercised
during the smoke run — this is what keeps the regression context living
and mandatorily current, instead of drifting out of sync with what
`qa-regression` actually needs to cover.

### Regression (`qa-regression`, new)

Reads `context/regression-flows.md` — the list of core flows, each with
its end-to-end steps and reusable test data — and executes them in full.
At the end of each flow's run, it updates that flow's "last successful
run" date/result in the same file, so it's easy to spot a flow that
hasn't been validated in a long time.

## The setup skill (`qa-project-setup`)

New skill, the first thing a tester runs in a freshly created project
repo: `/qa-project-setup`. It's a short, guided brainstorming — one
question at a time, following the same discipline as this document's own
creation process — that fills in:

- **`context/navigation-map.md`**: base URL, where test credentials are
  kept, sidebar/tab structure, known non-bug quirks.
- **`context/regression-flows.md`**: the product's core end-to-end flows,
  their steps, and reusable test data per flow.

It then runs `ok init` if the project hasn't been initialized yet, so the
OK MCP and the project-local OK runtime skill get wired in.

**Re-invocable, not one-shot.** Running `/qa-project-setup` again later
(e.g. the app added a new section, or a regression flow's steps changed)
edits the existing `context/` files rather than blindly overwriting them
— it should recognize existing content and ask what to add/change, the
same way `qa-smoke-test`'s regression-sync step does.

## Tester workflow, end to end

1. Click "Use this template" on `qa-team` in GitHub → creates
   `qa-<project>` (own repo, no `qa-team` git history).
2. Clone the new repo locally.
3. Run `/qa-project-setup` once → fills in `context/`, runs `ok init`.
4. Day-to-day: start `claude` anywhere inside the repo, invoke
   `qa-blackbox` / `qa-smoke-test` / `qa-regression` / `qa-text-check` as
   the day's scenario calls for.

## Out of scope (for this iteration)

- Automating repo creation via the GitHub API/CLI — the tester uses the
  "Use this template" button or `gh repo create --template` manually.
- Propagating updates made to the `qa-team` template retroactively into
  already-created project repos — each project repo is independent after
  creation; "how do we push a template improvement to existing projects"
  is a separate future problem, not solved here.
- The full, line-by-line SKILL.md content for `qa-smoke-test` and
  `qa-regression` — that level of detail belongs in the implementation
  plan, not this architecture spec.
- Any change to `qa-blackbox`'s existing scoring model, standard
  scenarios, or report format — only its context-reading step (checking
  `navigation-map.md` first) is added; everything else about how it
  scores and reports is unchanged.
