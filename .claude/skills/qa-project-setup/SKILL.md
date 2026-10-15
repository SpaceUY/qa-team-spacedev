---
name: qa-project-setup
description: Guided, re-invocable setup that fills in this project's context/navigation-map.md and context/regression-flows.md, and runs `ok init` the first time. Invoke manually when starting a new project repo, or again any time the app's structure or core flows change.
user-invocable: true
allowed-tools: Read, Write, Edit, AskUserQuestion, Bash
---

# qa-project-setup — Guided Project Context Setup

You fill in this repo's `context/` directory — `navigation-map.md` and
`regression-flows.md` — through a short, one-question-at-a-time
conversation, the same discipline as a brainstorming session: don't ask
several things in one message, and don't guess an answer the user hasn't
given you. This is manual, on-demand: only run it when the user
explicitly invokes `/qa-project-setup`.

**Re-invocable.** This is not one-shot setup. Running it again later (a
new site section shipped, a regression flow's steps changed) edits the
existing files in place — it never blindly overwrites content that's
already there. Always read the current file content first and decide,
file by file, whether it's empty-template or already-filled before
deciding whether to ask "let's fill this in" or "what do you want to
add/change".

## Step 1 — Initialize OpenKnowledge, if not already done

Check whether `.ok/` exists at the repo root:

```bash
test -d .ok && echo "OK_EXISTS" || echo "OK_MISSING"
```

- If `OK_MISSING`: run `ok init` (or `npx @inkeep/open-knowledge init` if
  `ok` isn't on PATH) from the repo root, then continue.
- If `OK_EXISTS`: skip straight to Step 2 — this is a re-run.

If the `ok`/`npx` command fails (e.g. no internet access, Node.js not
installed), tell the user exactly what failed and stop — do not attempt
to hand-write `.ok/`'s internals yourself.

## Step 2 — Guide `.env` creation, if not already done

Check whether `.env` exists at the repo root:

```bash
test -f .env && echo "ENV_EXISTS" || echo "ENV_MISSING"
```

- If `ENV_MISSING`: tell the user to copy `.env.example` to `.env` and
  fill in `BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` (and
  `API_KEY` if their project needs one) with real values for this
  project. **Never ask the user to paste these values into the chat,
  and never write them into any file yourself** — `.env` holds real
  secrets, and this skill's job here is only to point the user at it,
  not to handle the values. Wait for the user to confirm they've done
  this before moving on to Step 3.
- If `ENV_EXISTS`: skip straight to Step 3 — this is a re-run, or the
  user already configured it. Do not read or print `.env`'s contents at
  any point — its mere existence is all this skill needs to know.

## Step 3 — Fill in or update `context/navigation-map.md`

Read `context/navigation-map.md` first. For each of its two sections
(`## Site Structure`, `## Known Non-Bug Quirks`), check whether it still
holds the empty template placeholder text (e.g. "not yet configured") or
already has real content.

For each section that's still a placeholder, ask the user (one question
at a time, via `AskUserQuestion` where the answer is a clear choice, or
a direct question when it's open-ended free text):

1. **Site Structure**: "What are the main sidebar sections or tabs, and
   their routes? (e.g. Dashboard → `/dashboard`, Settings → `/settings`)"
2. **Known Non-Bug Quirks**: "Are there any known visual/UX behaviors
   that are intentional, not bugs, that qa-blackbox should not report?
   (e.g. 'sidebar collapses on mobile by design'). If none, say so —
   it's fine to leave this section explicitly empty."

For each section that already has real content, ask instead: "Section X
already has: `<current content>`. Do you want to update it, or leave it
as-is?" — only touch what the user asks to change.

Write each answer into the corresponding section of
`context/navigation-map.md` using `Edit`, replacing only that section's
placeholder or prior content — never rewrite the whole file from
scratch, since a re-run must preserve untouched sections exactly.

## Step 4 — Fill in or update `context/regression-flows.md`

Read `context/regression-flows.md` first. If it still has no `## Flow:`
entries (just the empty-state placeholder text), ask: "What are this
product's core end-to-end flows — the ones that should always be
regression-tested? Let's add them one at a time. What's the first one?"

For each flow the user describes, ask follow-up questions one at a time
to capture:
- **Flow name** (short, e.g. "Registration → First Purchase")
- **Steps** (numbered, end-to-end)
- **Test data** (any reusable values needed to run it — a test card
  number, a valid test address, etc. — same credential-safety rule as
  Step 2: references to where sensitive test data lives, not real
  secrets pasted into this file)

Write each flow as a new `## Flow: {name}` section (matching the
template's exact heading pattern from `context/regression-flows.md`'s
own template comment), with `**Steps:**`, `**Test data:**`, and
`**Last successful run:** never run` — this skill always writes
`never run`, since documenting a flow here is not the same as
executing it. The run-date field is only ever stamped with an actual
date by `qa-regression` (after running the flow end-to-end) or by
`qa-smoke-test` (when its end-of-run regression sync adds or updates
this flow and the smoke test passed) — never by `qa-project-setup`.

Keep asking "Any more core flows to add?" until the user says no.

If the file already has flows, ask: "This project already has N
regression flows: `<list their names>`. Do you want to add a new one,
update an existing one, or are we done?" and loop accordingly.

## Step 5 — Summary

Once done, show the user a short summary of what's now in `.env`
(configured or still needs filling in — never show its actual values),
`context/navigation-map.md` (filled sections vs. still-empty ones), and
`context/regression-flows.md` (flow count and names), and tell them
they're ready to run `qa-blackbox`, `qa-smoke-test`, or `qa-regression`.

## Pre-flight for a browser run

Before the first browser session on a machine, check these known Playwright MCP pitfalls:

- **All `@playwright/mcp` instances share one profile directory.** A stale server still holding
  it makes `browser_navigate` fail with "Browser is already in use". Check for running
  `playwright-mcp` processes and kill stale ones before starting: `ps aux | grep playwright-mcp`
  on macOS/Linux; on Windows, `Get-CimInstance Win32_Process | Where-Object CommandLine -like '*playwright*mcp*'`
  in PowerShell.
- **Login state from an old server can look like an app bug.** If a session fails in a way that
  looks like authentication, confirm the Playwright MCP server running is the current one, not a
  leftover from an earlier configuration, before reporting it.
- **Do not assume every `--caps` value listed in `--help` is validated.** Check the tool list
  after changing capabilities.
- **`--secrets <path>` crashes when the file is missing.** Do not point it at a path that does not
  exist; credentials still stay in `.env` and are never printed.

## Constraints

- Never write any credential or secret value into `context/` or any
  other tracked file — `.env` is the only place they belong, and this
  skill never writes to `.env` itself, only checks whether it exists.
- Never ask the user to paste a real `.env` value into the chat, and
  never read or print `.env`'s contents.
- Never overwrite a section the user didn't ask to change.
- Never fabricate a flow, site-structure entry, or quirk the user didn't
  actually provide — leave a section as its explicit placeholder rather
  than guessing.
