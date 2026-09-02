# Design: `.env` credentials support + end-to-end `GUIDE.md`

**Date:** 2026-09-02
**Author:** Julia Disarli (julia.disarli@otonomi.ai)
**Status:** Approved

## Purpose

Two related additions to the `qa-team` template repo, both aimed at
making the template genuinely clone-and-use: a tester should be able to
create a project repo from the template, follow one document end to end,
and have working QA sessions against a real site — without guessing
where credentials go or which skill to run for which situation.

1. **`.env` support** — real credentials and site data (base URL, test
   user credentials, optional API tokens) move out of chat-time
   back-and-forth and into a local, gitignored `.env` file that skills
   read directly. This replaces `context/navigation-map.md`'s current
   `## Base URL` and `## Test Credentials` sections, which today only
   store a *reference* to where a secret lives, not the secret itself.
2. **`GUIDE.md`** — a new, narrative, root-level document a tester reads
   once, top to bottom: clone → context mapping → `.env` setup → which
   testing skill to run when → how reports become ClickUp tickets.
   `README.md` stays a short technical quickstart and links to it.

## Part 1 — `.env` credentials support

### What goes in `.env`

- `BASE_URL` — the site's base URL (was `navigation-map.md`'s
  `## Base URL` section; now lives here as the real value instead of a
  placeholder note).
- `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` (and, if the site has more
  than one relevant role, additional `TEST_<ROLE>_EMAIL`/`_PASSWORD`
  pairs, following the same naming pattern) — was `navigation-map.md`'s
  `## Test Credentials` section, which today only stores a reference
  ("1Password vault: X") rather than the credential itself.
- `API_KEY` (optional) — any API key or token the site under test
  requires (e.g. a header the app needs, a feature-flag token to enable
  functionality under test). Optional because not every project needs
  one; `qa-project-setup` asks whether it applies before including it.

### Files

- **`.env.example`** — versioned, committed, placeholder values only
  (e.g. `BASE_URL=https://staging.example.com`,
  `TEST_USER_EMAIL=qa@example.com`, `TEST_USER_PASSWORD=`,
  `# API_KEY=` commented out by default since it's optional).
- **`.env`** — never committed. Added to `.gitignore` at the repo root,
  same treatment as `.claude/settings.local.json`. Each tester creates
  their own by copying `.env.example` and filling in real values for
  their project.

### `context/navigation-map.md`'s template changes

The template (and the live file in any project repo created from this
template) drops `## Base URL` and `## Test Credentials` entirely. It
keeps only:

- `## Site Structure` — sidebar sections, tabs, routes. Not a secret;
  makes sense versioned and readable without `.env` configured.
- `## Known Non-Bug Quirks` — same as today, unchanged.

This removes the overlap the current design has: today the same two
data points (base URL, credentials) are asked about twice in different
places with different trust models (a plaintext-forbidding Markdown
note vs. a real gitignored value). After this change there is exactly
one place for each: secrets in `.env`, non-secret structure in
`navigation-map.md`.

### Skill changes

- **`qa-project-setup`** — Step 2 (today: fill in `navigation-map.md`,
  asking about Base URL and Test Credentials among other things) changes
  to: first check whether `.env` exists; if not, tell the user to copy
  `.env.example` to `.env` and fill it in (this skill does not write
  real credential values into any file itself — it only checks for
  `.env`'s existence and guides the user to create/edit it by hand,
  since actual secrets should never pass through the conversation more
  than necessary). Then continue asking about `## Site Structure` and
  `## Known Non-Bug Quirks` only, dropping the Base URL/Test Credentials
  questions entirely.
- **`qa-blackbox`, `qa-smoke-test`** — their existing "read project
  context" step additionally reads `.env` (via `Bash`, e.g.
  `set -a && source .env && set +a` or an equivalent safe read) to get
  `BASE_URL` and credentials, instead of expecting those two values in
  `navigation-map.md`. If `.env` doesn't exist or `BASE_URL` is empty,
  the skill tells the user to run `/qa-project-setup` (which now covers
  the `.env`-creation reminder) or manually create `.env` from
  `.env.example`, the same way an unfilled `navigation-map.md` is
  already handled today.
- **`qa-regression`** — today it reads only `context/regression-flows.md`
  and has no "read project context" step at all, since each flow entry
  already carries its own steps and test data. This iteration adds one:
  before executing any flow, read `context/navigation-map.md`'s
  `## Site Structure` (general orientation) and `## Known Non-Bug
  Quirks` sections, and cross-check anything found during a flow run
  against Known Non-Bug Quirks before reporting it as a bug — the same
  false-positive guard `qa-blackbox` already has. `qa-regression` does
  **not** read `.env` — it never needed a base URL or credentials of its
  own (each flow's own `**Steps:**`/`**Test data:**` already carries
  whatever it needs), and that remains true after this change.
- **Security rule, all of the above** — no skill ever prints `.env`'s
  contents into the conversation transcript or into any report file.
  `.env` values are read for internal use (navigating, logging in) only.

## Part 2 — `GUIDE.md`

A new root-level file, narrative and sequential — meant to be read once,
top to bottom, by a tester who just cloned a project repo created from
this template. Sections, in order:

1. **Clone the repo** — created from the `qa-team` GitHub Template
   ("Use this template"), then cloned locally.
2. **Map the project's context** — run `/qa-project-setup`: what it
   asks, what it produces (`context/navigation-map.md`'s Site Structure
   and Known Non-Bug Quirks sections, `context/regression-flows.md`,
   and `.ok/` via `ok init`), and that it's safe to re-run later.
3. **Configure `.env`** — copy `.env.example` to `.env`, fill in
   `BASE_URL`, test credentials, and `API_KEY` if applicable; explicit
   reminder it's gitignored and must never be committed or pasted into
   chat.
4. **The testing skills** — one subsection per skill, each stating scope
   and invocation:
   - `qa-blackbox` (Exploratory) — full black-box audit of a flow or
     site, automatic on a URL+flow message.
   - `qa-text-check` — typo/grammar/mixed-language checks, manual
     invocation with `--lang`.
   - `qa-smoke-test` (Smoke) — focused check of one ClickUp ticket's
     feature, manual invocation with a ticket link/ID.
   - `qa-regression` (Regression) — full run of every documented core
     flow, manual invocation.
5. **Reports and tickets** — how each testing skill produces a report
   (`qa-report.md`, `text-qa-report.md`) in `evidence/`, and how
   `report-bugs-to-clickup` / `report-improvements-to-clickup` turn a
   report's Bug Register / Nice-to-Have list into ClickUp tickets (bugs
   vs. improvements), each manual and on-demand.

`README.md` is trimmed to a short technical quickstart (install,
prerequisites, command reference table) with a prominent link to
`GUIDE.md` near the top, rather than duplicating the narrative.

## Validation goal for this iteration

The explicit acceptance bar for this work (per user request): the
finished template repo must be clonable and usable end-to-end against a
real project, to confirm the whole chain actually works — not just that
each file's content reads correctly in isolation. The implementation
plan's final task must include cloning the repo (or an equivalent
same-repo dry run, since a literal "use this template" clone requires
GitHub access this control session doesn't have) and walking through
`GUIDE.md` step by step against a real or realistic site, the same way
the earlier `qa-text-check` and `qa-team-template` plans left their live
Playwright-MCP verification as an explicit, disclosed open item when a
live browser session wasn't available in the control session.

## Out of scope (for this iteration)

- Multi-role `.env` support beyond the naming convention described above
  (e.g. a structured multi-user config format) — one primary test user
  is the default; additional roles follow the same flat naming pattern
  if needed, no new file format.
- Any change to `qa-text-check`, `report-bugs-to-clickup`, or
  `report-improvements-to-clickup`'s own logic — they're referenced by
  `GUIDE.md` but not modified.
- Secrets-manager integration (e.g. auto-fetching from 1Password/Vault)
  — `.env` is a manually-filled local file, not an integration.
