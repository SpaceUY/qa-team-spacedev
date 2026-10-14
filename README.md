# QA E2E Toolkit

> This repo is a GitHub **Template repository**. To start a new
> project, use GitHub's "Use this template" button (or
> `gh repo create --template <owner>/qa-team <new-repo-name>`) — don't
> fork or clone-and-reinit by hand.

> **New to this repo?** Read [`GUIDE.md`](./GUIDE.md) end to end first —
> it walks through cloning, mapping your project's context, configuring
> `.env`, and which testing skill to use when. This README is a
> technical quickstart/reference, not the full walkthrough.

SpaceDev's shared toolkit for end-to-end testing. Two independent pieces —
pick the one that fits what you're doing:

| Piece | What it is | When to use it |
|--------|------------|-----------------|
| QA Agent skills (`.claude/skills/`) | Claude Code + Playwright MCP black-box QA — `qa-blackbox`, `qa-text-check`, `qa-project-setup`, `qa-smoke-test`, `qa-regression`, run from the repo root | Interactive/exploratory QA sessions, focused smoke tests, and end-to-end regression — auditing a flow or a whole site, ad hoc bug hunting, generating an evidence report to share. |
| [`e2e-tests/`](./e2e-tests) | Traditional [Playwright Test](https://playwright.dev/docs/test-intro) suite (`.spec.ts`), runs via `npx playwright test`. | Automated regression testing you want versioned in code and run in CI on every PR. |

Both pieces use [Playwright](https://playwright.dev/) under the hood, but
in different modes: the QA Agent skills use the Playwright **MCP server**
(browser control exposed as tools Claude calls directly), while
`e2e-tests/` uses the Playwright **Test runner** (compiled `.spec.ts`
files executed by a CLI).

## Quickstart — QA Agent

```bash
npx playwright install chromium   # one-time
cp .claude/settings.local.json.example .claude/settings.local.json
cp .env.example .env   # then fill in BASE_URL, test credentials, and ClickUp settings (keep all values single-quoted — see GUIDE.md)
claude
```

Then tell Claude: *"Navigate to `<URL>` and test the `<flow>` flow."*

**First Session Automatic Questions:**

When you start your first QA session, Claude will automatically ask:

1. **Project Language** — "What language does this project use?"
   - Choose: Spanish (Español) / English / Bilingual
   - All reports and ClickUp tickets will be generated in this language
   
2. **Viewport Scope** — "What's the scope for this QA session?"
   - Choose: Desktop only / Mobile only / Both (recommended)
   - Tests will run for the selected viewport(s) only

These questions are asked once per session and apply to all reports and tickets created that session.

### Configuring `.env`

After copying `.env.example` to `.env`, fill in:

**Application:**
- `BASE_URL` — staging/test environment URL
- `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` — test account credentials

**ClickUp Integration (for creating bug/improvement tickets):**
- `CLICKUP_API_KEY` — Personal Access Token from ClickUp (generate at https://app.clickup.com/settings → API)
- ~~`CLICKUP_BUGS_LIST_ID`~~ — **Not needed anymore** (v3.0+) — you provide Bugs List ID when running `/report-bugs-to-clickup` (remembered in chat)
- ~~`CLICKUP_SPRINT_LIST_ID`~~ — **Not needed anymore** (v3.0+) — you provide Sprint List ID each time (rotates every 15 days)

⚠️ **All values must be single-quoted** to protect special characters: `CLICKUP_API_KEY='pk_...'`

At session start, the following skills should appear in the available
skills banner: `qa-blackbox`, `qa-text-check`, `qa-project-setup`,
`qa-smoke-test`, `qa-regression`, `report-bugs-to-clickup`,
`report-improvements-to-clickup`, `frontend-design`,
`verification-before-completion`. The first seven live in this repo's
`.claude/skills/`; the latter two are Claude Code plugin skills (sourced
from `anthropics/skills` and `obra/superpowers` respectively) — see
`CLAUDE.md` for the full protocol.

## Running a Text QA Check

Unlike `qa-blackbox`, this does **not** run automatically — invoke it
explicitly:

> `/qa-text-check <url-or-flow> --lang=es|en`

Optionally pass `--pages=<screen list>` to name the screens to visit;
otherwise Claude asks which screens or flow to cover. Claude will:
1. Verify Playwright MCP is connected
2. Visit each screen, extract visible UI text, take one evidence
   screenshot per screen, review for issues, and write the report —
   running that entire pipeline as a single background task instead
   of inline when the scope covers more than 5 screens
3. Report only high-confidence typo/grammar/mixed-language/
   punctuation issues
4. Save `text-qa-report.md` (in `report-bugs-to-clickup`'s exact
   4-column Bug Register format) to the same evidence folder
   structure used by `qa-blackbox`

See [`.claude/skills/qa-text-check/SKILL.md`](./.claude/skills/qa-text-check/SKILL.md)
for the full protocol.

## Setting Up a New Project

The first time you use a project repo created from this template, run:

> `/qa-project-setup`

Claude will run `ok init` if needed, then walk you through filling in
`context/navigation-map.md` (site structure, known non-bug quirks) and
`context/regression-flows.md` (this product's core end-to-end flows).
Base URL and test credentials live in `.env`, not `navigation-map.md` —
`qa-project-setup` reminds you to configure `.env` too (see
"Credentials (`.env`)" below) but never writes secrets into any tracked
file. Re-run it any time the app's structure or core flows change — it
edits existing content, it doesn't overwrite it.

## Running Smoke Tests

For a specific ClickUp ticket, invoke:

> `/qa-smoke-test <ticket link or ID>`

Claude fetches the ticket fresh from ClickUp, runs a focused set of
checks scoped to that ticket's feature (not the full `qa-blackbox`
protocol), and — at the end of every run — asks whether this flow should
be added to or update `context/regression-flows.md`, so the regression
set stays current as features ship.

## Running Regression Tests

To execute every documented core flow end-to-end:

> `/qa-regression`

Claude reads `context/regression-flows.md`, runs each flow's steps with
its test data, records any bugs found, and updates each passing flow's
last-successful-run date.

## Project Context (OpenKnowledge)

This repo's `context/` directory is an [OpenKnowledge](https://github.com/inkeep/open-knowledge)
project once initialized. The first time you use a project repo created
from this template, run `/qa-project-setup` — it runs `ok init` for you,
reminds you to configure `.env` (see below), and walks you through
filling in `context/navigation-map.md` and `context/regression-flows.md`
with your project's specifics.

You do not need to run `ok init` yourself, and this template repo does
not ship with `.ok/` already created — `qa-project-setup` creates it the
first time, scoped to your new project repo. See
[`GUIDE.md`](./GUIDE.md) for the full walkthrough.

## Credentials (`.env`)

```bash
cp .env.example .env
```

Fill in `BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` (and
`API_KEY` if your project needs one), **single-quoting every value**
(e.g. `TEST_USER_PASSWORD='p@ss word!'`) — the QA skills read `.env` via
the shell (`source .env`), so an unquoted value with a space, `$`,
backtick, `;`, or `&` will either get silently truncated or executed as
a command instead of read as a literal credential. `.env` is gitignored
— never commit it or paste its contents into chat. See
[`GUIDE.md`](./GUIDE.md#3-configure-env) for details.

## Quickstart — e2e-tests

```bash
cd e2e-tests
npm ci
npx playwright install --with-deps
BASE_URL=https://your-app.example.com npm test
```

See [`e2e-tests/README.md`](./e2e-tests/README.md) for details, including
how to add specs for a new project.

## CI

`.github/workflows/e2e.yml` runs the `e2e-tests/` suite on every pull
request and on pushes to `main`. The QA agent is interactive-only
and does not run in CI.

## Reporting bugs to ClickUp

The `report-bugs-to-clickup` skill (`.claude/skills/report-bugs-to-clickup/`)
reads any `qa-report.md`'s Bug Register table and creates one ClickUp bug
ticket per row. Each ticket:

- **Bugs List ID:** You provide it in Step 1 (remembered in chat for future runs in same conversation)
- **Template structure:** Fully completed with Precondition, Steps to reproduce, Actual result, Expected result, Additional information
- **Evidence:** Screenshots attached as files + markdown image references
- **Environment:** Tagged by environment (`staging`, `production`, `dev`)
- **Assigned to:** You select who owns these tickets — supports team workflows
- **Sprint:** Added manually post-creation (you provide Sprint List ID each time)

This is a manual, on-demand skill — run it explicitly when you're ready to
file tickets:

```bash
/report-bugs-to-clickup path/to/qa-report.md
```

**Workflow:**
1. Provide your **Bugs List ID** (remembered in chat) → e.g., `123456789012`
2. Provide current **Sprint List ID** (each run) → e.g., `123456789013`
3. Select **assignee** (email, username, or "me") → e.g., `jane.doe`
4. Review confirmation table
5. Tickets created in Bugs List
6. **Manually add to Sprint** in ClickUp (clear instructions provided)

See `.claude/skills/report-bugs-to-clickup/GUIDE.md` for detailed walkthrough and
`.claude/skills/report-bugs-to-clickup/CHANGELOG.md` for version history.

## Reporting improvements to ClickUp

The `report-improvements-to-clickup` skill
(`.claude/skills/report-improvements-to-clickup/`) reads a `qa-report.md`'s
"Nice to Have" recommendations and creates one ClickUp Improvement ticket
per item, in the project's fixed Improvements List, additionally
associated with the active sprint, assigned to the logged-in ClickUp
user, with the report's shared happy-path screenshot attached.

Also manual/on-demand:

```bash
/report-improvements-to-clickup path/to/qa-report.md
```

See
`docs/superpowers/specs/2026-09-01-report-improvements-to-clickup-design.md`
for the full design, including the fixed-List-plus-sprint-association
model both skills share.

## Project Structure

```
qa-team/
├── .claude/
│   ├── skills/
│   │   ├── qa-blackbox/SKILL.md
│   │   ├── qa-text-check/SKILL.md
│   │   ├── qa-project-setup/SKILL.md
│   │   ├── qa-smoke-test/SKILL.md
│   │   ├── qa-regression/SKILL.md
│   │   ├── report-bugs-to-clickup/
│   │   └── report-improvements-to-clickup/
│   ├── settings.local.json.example   # copy to settings.local.json
│   └── settings.local.json           # gitignored, created locally
├── context/                           # this project's OK knowledge base
│   ├── README.md
│   ├── navigation-map.md
│   └── regression-flows.md
├── e2e-tests/                         # traditional Playwright Test suite (unchanged)
├── evidence/                          # gitignored — screenshots and reports
├── docs/superpowers/                  # specs and plans (this document's own home)
├── CLAUDE.md
└── README.md
```

## Troubleshooting

**Playwright MCP tools (`mcp__playwright__*`) not available — session halted**

Claude Code will refuse to start any QA session if the Playwright MCP is
not connected:

> QA session halted — Playwright MCP is not connected.

Fix checklist:
1. Verify `.claude/settings.local.json` exists and contains the
   `mcpServers.playwright` entry (copy it from `.example` if missing).
2. Run `/mcp` inside Claude Code to reconnect MCP servers without
   restarting.
3. Confirm `npx @playwright/mcp@latest` runs without errors in your
   terminal.
4. If nothing works, close and reopen Claude Code.

Do **not** attempt to work around a missing Playwright MCP by writing
scripts. Claude is configured to refuse this (see `CLAUDE.md`).

**Skills not showing up at session start**

- Verify the `.claude/skills/` directory exists and contains the
  `SKILL.md` files.
- Close and reopen Claude Code — skills load at session start only.

**Browser not found when MCP starts**

```bash
npx playwright install chromium
```
