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
cp .env.example .env   # then fill in BASE_URL and test credentials
claude
```

Then tell Claude: *"Navigate to `<URL>` and test the `<flow>` flow."*

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
`context/navigation-map.md` (base URL, site structure, test credentials
reference, known non-bug quirks) and `context/regression-flows.md`
(this product's core end-to-end flows). Re-run it any time the app's
structure or core flows change — it edits existing content, it doesn't
overwrite it.

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
`API_KEY` if your project needs one). `.env` is gitignored — never
commit it or paste its contents into chat. See
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
ticket per row, in the project's fixed Bugs List, additionally associated
with the active sprint, tagged by environment and assigned to the
logged-in ClickUp user.

This is a manual, on-demand skill — it does not run automatically at the
end of a `qa-blackbox` session. Run it explicitly when you're ready to
file tickets:

```bash
/report-bugs-to-clickup path/to/qa-report.md
```

See `docs/superpowers/specs/2026-09-01-report-bugs-to-clickup-design.md`
for the full design.

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
