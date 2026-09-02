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

## Step 2 — Fill in or update `context/navigation-map.md`

Read `context/navigation-map.md` first. For each of its four sections
(`## Base URL`, `## Site Structure`, `## Test Credentials`,
`## Known Non-Bug Quirks`), check whether it still holds the empty
template placeholder text (e.g. "not yet configured") or already has
real content.

For each section that's still a placeholder, ask the user (one question
at a time, via `AskUserQuestion` where the answer is a clear choice, or
a direct question when it's open-ended free text):

1. **Base URL**: "What's the base URL for this project? (e.g.
   `https://staging.example.com`)"
2. **Site Structure**: "What are the main sidebar sections or tabs, and
   their routes? (e.g. Dashboard → `/dashboard`, Settings → `/settings`)"
3. **Test Credentials**: "Where are test user credentials for this
   project kept? (Never paste an actual password — give a reference,
   e.g. '1Password vault: QA-Otonomi, entry: staging-test-user'.)" If the
   user tries to paste a real plaintext password, stop them and ask for
   a reference instead — do not write a plaintext credential into this
   file.
4. **Known Non-Bug Quirks**: "Are there any known visual/UX behaviors
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

## Step 3 — Fill in or update `context/regression-flows.md`

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
`**Last successful run:** never run` — the run-date field is only ever
updated by `qa-regression`, never by this skill.

Keep asking "Any more core flows to add?" until the user says no.

If the file already has flows, ask: "This project already has N
regression flows: `<list their names>`. Do you want to add a new one,
update an existing one, or are we done?" and loop accordingly.

## Step 4 — Summary

Once done, show the user a short summary of what's now in
`context/navigation-map.md` (filled sections vs. still-empty ones) and
`context/regression-flows.md` (flow count and names), and tell them
they're ready to run `qa-blackbox`, `qa-smoke-test`, or `qa-regression`.

## Constraints

- Never write a plaintext credential or secret into `context/` — always
  a reference to where it's stored.
- Never overwrite a section the user didn't ask to change.
- Never fabricate a flow, URL, or credential reference the user didn't
  actually provide — leave a section as its explicit placeholder rather
  than guessing.
