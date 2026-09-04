# QA Team — End-to-End Guide

This is the one document to read start to finish the first time you use
a project repo created from the `qa-team` template. It walks through
every step: getting the repo, mapping your project's context,
configuring credentials, running the right testing skill for the
situation, and turning results into ClickUp tickets.

For a short technical quickstart (install commands, command reference),
see [`README.md`](./README.md) instead — this document is the narrative
version.

---

## 1. Clone the repo

This repo (`qa-team`) is a GitHub **Template repository**. To start a
new project:

1. On GitHub, open `qa-team` and click **"Use this template"** (or run
   `gh repo create --template <owner>/qa-team <new-repo-name>`) to
   create your own, separate repo for this client/project — don't fork
   or clone-and-reinit by hand.
2. Clone your new repo locally.
3. Install prerequisites and set up the Playwright MCP — see
   `README.md`'s Quickstart section for the exact commands
   (`npx playwright install chromium`, copying
   `.claude/settings.local.json.example`).

## 2. Map your project's context

Before running any test, tell Claude about the project once:

> `/qa-project-setup`

This guided, re-invocable skill will:

1. Set up OpenKnowledge (`ok init`) for this project's `context/`
   directory, if it hasn't been already.
2. Check whether you've configured `.env` yet (see step 3 below) and
   remind you if not — it will not ask you to paste credentials into
   the chat.
3. Ask about your site's structure (sidebar sections, tabs, routes) and
   any known non-bug quirks (intentional behaviors that shouldn't be
   reported as bugs), writing them into `context/navigation-map.md`.
4. Ask about the product's core end-to-end flows — the ones that should
   always be regression-tested — writing them into
   `context/regression-flows.md`.

**Re-run it any time** the app's structure changes or a core flow's
steps change — it edits what's there instead of overwriting it.

## 3. Configure `.env` (Application & ClickUp Integration)

Copy the example file and fill in real values for your project:

```bash
cp .env.example .env
```

Edit `.env` and set:

### Application Configuration

- `BASE_URL` — your project's base URL (e.g.
  `https://staging.your-client.com`).
- `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` — a test user's real
  credentials. Add more `TEST_<ROLE>_EMAIL`/`_PASSWORD` pairs if your
  project needs more than one test role.
- `API_KEY` — only if your site needs one; leave it commented out
  otherwise.

### ClickUp Integration (Required for Creating Tickets)

To create QA bug and improvement tickets in ClickUp from reports, add:

- `CLICKUP_API_KEY` — your Personal Access Token from ClickUp
  (generate at `https://app.clickup.com/settings` → API → Generate Token).
  Token format: begins with `pk_`.
- `CLICKUP_BUGS_LIST_ID` — the ID of your "Bugs" list in ClickUp
  (find it in the URL when viewing the list: `/l/[LIST_ID]/`).
- `CLICKUP_SPRINT_LIST_ID` — the ID of your active Sprint list in ClickUp
  (where created tickets will be associated for sprint tracking).

**Finding ClickUp List IDs:**
1. Open ClickUp and navigate to your project
2. Click on the list you want (e.g., "Bugs", "Active Sprint")
3. Copy the URL from your browser address bar
4. Extract the list ID from the path: `https://app.clickup.com/[WORKSPACE]/v/l/[LIST_ID]/...`
5. Use only the numeric part (e.g., `901408710081`, not `6-901408710081-1`)

**Important Quoting Rules:**

Single-quote every value (e.g. `TEST_USER_PASSWORD='p@ss word!'`).
The testing skills read `.env` by having the shell `source` it, not by
parsing it as plain key/value pairs — so an unquoted value containing a
space is silently cut short, and an unquoted value containing `$`,
backticks, `;`, or `&` runs as a shell command instead of being treated
as a literal credential. `.env.example` already shows every value
quoted; keep that quoting when you fill in real values.

**Security:**

`.env` is gitignored — it is never committed, and you should never
paste its contents into a chat message. Every testing skill below
reads it directly; you only fill it in once per project (update it
again only if credentials change).

## 4. Your First QA Session — Automatic Questions

When you start Claude Code for the first time and initiate a QA session, you will be asked **two important questions** that establish how all reports and tickets are generated:

### Step 0.4: Project Language Selection

> **"What language does this project use?"**

Choose one:
- **Spanish (Español)** — All reports, findings, and ClickUp tickets will be in Spanish
- **English** — All reports, findings, and ClickUp tickets will be in English  
- **Bilingual (Es/En)** — Reports will include both languages; ClickUp tickets in the language you specify

This selection applies to:
- All QA reports (`qa-report.md`, `AUDIT-SUMMARY-*.md`)
- All text QA findings (`text-qa-report.md`)
- All ClickUp tickets created via `/report-bugs-to-clickup` and `/report-improvements-to-clickup`
- All scenario names, bug descriptions, and recommendations

**You are asked this once per session.** All testing and ticket creation that session will use the language you selected. See `CLAUDE.md` Step 0.4 for details.

### Step 0.5: Viewport Scope Selection

> **"What's the scope for this QA session?"**

Choose one:
- **Desktop only** — Test at 1440×900 px only
- **Mobile only** — Test at 375×667 px only
- **Both** (recommended default) — Test both desktop and mobile viewports

This affects which responsiveness scenarios are run and reported. See `CLAUDE.md` Step 0.5 for details.

---

## 5. The testing skills

Each skill below is manual and on-demand — none of them run
automatically except `qa-blackbox`, which triggers automatically when
you give Claude a URL and a flow to test.

| Skill | Scope | When to use it | How to invoke |
|-------|-------|-----------------|----------------|
| **`qa-blackbox`** (Exploratory) | Full black-box audit of one flow, or an entire site (Full Site Audit mode) — standard scenario checklist (S1-S12), error-guessing heuristics, scoring, accessibility, and a full report. | Auditing a flow you haven't tested before, or a general health check of a whole area of the product. | "Navigate to `<URL>` and test the `<flow>` flow." (automatic) or "Investigate the entire site at `<URL>`." |
| **`qa-text-check`** | Typo, grammar, mixed-language, and punctuation issues on specific screens, in Spanish or English. | A dedicated pass for copy/text quality, independent of functional testing. | `/qa-text-check <url-or-flow> --lang=es\|en` |
| **`qa-smoke-test`** (Smoke) | A focused check scoped to one ClickUp ticket's feature — not the full S1-S12 protocol. Fetches the ticket fresh from ClickUp every time (never cached). | Verifying a specific ticket's feature works before/after it ships, mid-sprint. | `/qa-smoke-test <ticket link or ID>` |
| **`qa-regression`** (Regression) | Executes every flow documented in `context/regression-flows.md`, end-to-end, and updates each flow's last-successful-run date. | A full regression pass across the product's core flows — before a release, or on a schedule. | `/qa-regression` |

`qa-smoke-test` ends every run by asking whether the flow it just tested
should be added to, or update, `context/regression-flows.md` — this is
how the regression set stays current as features ship, without a
separate manual step.

## 6. Reports and tickets

`qa-blackbox`, `qa-text-check`, `qa-smoke-test`, and `qa-regression` all
save evidence (a report plus screenshots) to
`evidence/{hostname}/{subpath}/{YYYY-MM-DD}/` — `qa-blackbox`,
`qa-smoke-test`, and `qa-regression` (one per flow run) write
`qa-report.md`, `qa-text-check` writes `text-qa-report.md`, all in the
same 4-column Bug Register format (`ID | Severity | Description |
Evidence`). `qa-regression` also writes a session-level
`evidence/{hostname}/AUDIT-SUMMARY-{YYYY-MM-DD}.md` summarizing all
flows run in that session, the same pattern `qa-blackbox`'s Full Site
Audit mode uses for multiple paths.

### Creating ClickUp Tickets from QA Reports

To turn a report's findings into ClickUp tickets, run one or both of
these (manual, on-demand — they never run automatically):

```bash
/report-bugs-to-clickup path/to/qa-report.md
```

**What this does:**
1. Reads your report's **Bug Register** table (ID | Severity | Description | Evidence)
2. Creates one ClickUp bug ticket per bug row in your fixed **Bugs List**
3. Sets each ticket's status to **OPEN**
4. Associates each ticket with the **active sprint**
5. Tags tickets by **environment** (Staging, Production, etc.)
6. Attaches **evidence screenshots** to each ticket
7. Assigns tickets to you
8. Shows a confirmation table before creating anything — **nothing is filed without your review**

**Ticket Title Format:**
Tickets are titled concisely for easy scanning:
```
[BUG-001] Saldo de Billetera Atrapado en "Cargando..."
[BUG-002] Bottom Nav Superpone Contenido en Móvil
```

**Ticket Description:**
Includes all context:
- Full bug description
- Steps to reproduce (if available)
- Expected behavior
- Severity level
- Platform/Page affected
- URL under test
- Evidence screenshot filename
- Your name as reporter

**Language:**
All ticket titles and descriptions are in the **language you selected at session start** (Step 0.4).

```bash
/report-improvements-to-clickup path/to/qa-report.md
```

Creates one ClickUp Improvement ticket per item in the report's "Nice to
Have" recommendations, in the project's fixed Improvements List, same
sprint-association model.

Both ask you to confirm the full list of tickets before creating
anything — nothing is filed without your review.

---

That's the whole loop: map context once, configure `.env` once, then
run the testing skill that fits the situation as often as you need,
turning results into tickets when you're ready to act on them.
