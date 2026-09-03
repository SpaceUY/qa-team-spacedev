# .env Credentials Support + GUIDE.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move site credentials (base URL, test user credentials, optional API key) out of `context/navigation-map.md`'s reference-only model into a real, gitignored `.env` file that skills read directly, and add a single narrative `GUIDE.md` a tester reads once end-to-end (clone → context mapping → `.env` → testing skills → reports/tickets) — then validate the whole chain by walking through it for real.

**Architecture:** `.env.example` is committed with placeholders; `.env` is gitignored and holds real values. `context/navigation-map.md`'s template drops its `## Base URL` and `## Test Credentials` sections (secrets no longer live there even as references) and keeps only `## Site Structure` and `## Known Non-Bug Quirks`. `qa-project-setup`, `qa-blackbox`, and `qa-smoke-test` are edited to read `.env` instead of those two removed sections. `qa-regression` gains a new "read project context" step of its own — it starts reading `context/navigation-map.md`'s `## Site Structure` and `## Known Non-Bug Quirks` sections (same false-positive guard `qa-blackbox` has), but does NOT read `.env` — it never needed a base URL or credentials, since each flow entry in `regression-flows.md` already carries its own steps and test data. `GUIDE.md` is new, root-level, narrative; `README.md` gets a prominent link to it near the top.

**Tech Stack:** Markdown skill definitions (instructions-only, no executable code), a `.env` file read via `Bash` (`source`) by the skills that need it, no new dependencies.

## Global Constraints

- `.env` is never committed. `.env.example` is committed with placeholders only, no real values (spec, "Files").
- `.env` holds exactly: `BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` (extendable to more `TEST_<ROLE>_EMAIL`/`_PASSWORD` pairs using the same naming pattern if a project needs more than one role), and an optional `API_KEY` (spec, "What goes in `.env`").
- `context/navigation-map.md`'s template keeps only `## Site Structure` and `## Known Non-Bug Quirks` — `## Base URL` and `## Test Credentials` are removed entirely, not merely deprecated (spec, "`context/navigation-map.md`'s template changes").
- `qa-project-setup` never writes real credential values into any file — it only checks whether `.env` exists and guides the user to create/fill it by hand (spec, "Skill changes"). This is a *stronger* rule than before: previously it wrote a credential *reference* into `navigation-map.md`; now it writes nothing about credentials at all.
- No skill ever prints `.env`'s contents into the conversation transcript or into any report file (spec, "Security rule, all of the above").
- `qa-regression` gains a "read project context" step (Task 5b, added after user feedback during implementation) that reads `context/navigation-map.md`'s `## Site Structure` and `## Known Non-Bug Quirks` sections, mirroring `qa-blackbox`'s equivalent step — but it does NOT read `.env`: it never needed a base URL or credentials of its own (confirmed by reading its current SKILL.md before writing this plan: it only reads `context/regression-flows.md`, where each flow's own steps carry whatever URL/data it needs), and that stays true after this change.
- `README.md` becomes a short technical quickstart with a prominent link to `GUIDE.md` — the narrative content moves to `GUIDE.md`, not duplicated in both (spec, "Part 2").
- The plan's final task must validate the whole chain against a real or realistic site by actually walking `GUIDE.md` step by step — not just confirm each file reads correctly in isolation (spec, "Validation goal for this iteration").

---

### Task 1: Create `.env.example` and gitignore `.env`

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the `BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `API_KEY` variable names that Tasks 2-5 (skill edits) and Task 8 (GUIDE.md) all reference by these exact names — do not rename any of these in later tasks without updating this file too.

- [ ] **Step 1: Create `.env.example`**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
```

Write this exact content to `.env.example`:

```bash
# Copy this file to .env and fill in real values for your project.
# .env is gitignored — never commit it, never paste its contents into chat.

# The site's base URL.
BASE_URL=https://staging.example.com

# Primary test user credentials.
TEST_USER_EMAIL=qa@example.com
TEST_USER_PASSWORD=

# If your site has more than one relevant test role, add more pairs
# following this same pattern, e.g.:
# TEST_ADMIN_EMAIL=admin@example.com
# TEST_ADMIN_PASSWORD=

# Optional: an API key or token the site under test requires (a header
# the app needs, a feature-flag token to enable functionality under
# test). Leave commented out if not applicable to this project.
# API_KEY=
```

- [ ] **Step 2: Add `.env` to `.gitignore`**

Read the current `.gitignore` first:

```bash
cat .gitignore
```

Expected current content:

```
node_modules/
evidence/
.playwright-mcp/
test-results/
playwright-report/
blob-report/
.claude/settings.local.json
.DS_Store
.ok/
```

Append `.env` as a new line:

```bash
echo ".env" >> .gitignore
```

- [ ] **Step 3: Verify**

```bash
grep -n "^\.env$" .gitignore
cat .env.example
git status --porcelain
```

Expected: `.gitignore` grep finds one match; `.env.example`'s content matches Step 1 exactly; `git status --porcelain` shows `.env.example` and `.gitignore` as the only changes (no `.env` file listed, since it doesn't exist yet — this task creates the example, not a real `.env`).

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "feat: add .env.example and gitignore .env for site credentials"
```

---

### Task 2: Remove `## Base URL` and `## Test Credentials` from the `navigation-map.md` template

**Files:**
- Modify: `context/navigation-map.md`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the final two-section template (`## Site Structure`, `## Known Non-Bug Quirks`) that Task 3 (`qa-project-setup`) and Task 4 (`qa-blackbox`) must both stop referencing the removed sections against.

- [ ] **Step 1: Read the current file**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
cat context/navigation-map.md
```

Expected current content (this is the template as it exists before this task, still empty/unfilled since no real project has run `/qa-project-setup` against this template repo):

```markdown
# Navigation Map

<!-- Filled in by /qa-project-setup. Do not delete these section headers —
     qa-blackbox looks for them by name. Re-run /qa-project-setup any time
     the app's structure changes; it edits this file in place rather than
     overwriting it. -->

## Base URL

_(not yet configured — run /qa-project-setup)_

## Site Structure

_(sidebar sections, tabs, and their routes — not yet configured)_

## Test Credentials

_(reference to where test user credentials are stored — never a plaintext
password in this file. Not yet configured.)_

## Known Non-Bug Quirks

_(visual/UX behaviors that are intentional, not bugs — so qa-blackbox
doesn't report them as false positives. Not yet configured.)_
```

If the file's actual current content differs from this (e.g. because a prior task already changed it), stop and report — this task's edit assumes this exact starting point.

- [ ] **Step 2: Rewrite with `## Base URL` and `## Test Credentials` removed**

Replace the full file content with:

```markdown
# Navigation Map

<!-- Filled in by /qa-project-setup. Do not delete these section headers —
     qa-blackbox looks for them by name. Re-run /qa-project-setup any time
     the app's structure changes; it edits this file in place rather than
     overwriting it. Base URL and test credentials live in .env, not
     here — see .env.example. -->

## Site Structure

_(sidebar sections, tabs, and their routes — not yet configured)_

## Known Non-Bug Quirks

_(visual/UX behaviors that are intentional, not bugs — so qa-blackbox
doesn't report them as false positives. Not yet configured.)_
```

- [ ] **Step 3: Verify**

```bash
grep -n "^## " context/navigation-map.md
```

Expected: exactly two headings, `## Site Structure` and `## Known Non-Bug Quirks`, in that order — no `## Base URL` or `## Test Credentials` anywhere in the file.

- [ ] **Step 4: Commit**

```bash
git add context/navigation-map.md
git commit -m "refactor: remove Base URL and Test Credentials sections from navigation-map.md (moved to .env)"
```

---

### Task 3: Update `qa-project-setup` to guide `.env` creation instead of asking for Base URL/Test Credentials

**Files:**
- Modify: `.claude/skills/qa-project-setup/SKILL.md`

**Interfaces:**
- Consumes: `.env.example`'s existence and variable names from Task 1; `context/navigation-map.md`'s two-section template from Task 2.
- Produces: nothing new consumed by later tasks — this is the last change to `qa-project-setup` in this plan.

- [ ] **Step 1: Read the current file**

Already read in full during plan authoring — its current Step 2 (lines 41-76) asks about Base URL, Site Structure, Test Credentials, and Known Non-Bug Quirks as four sequential questions, writing each into the corresponding `navigation-map.md` section. Re-read the live file before editing to confirm it hasn't drifted:

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
sed -n '41,76p' .claude/skills/qa-project-setup/SKILL.md
```

- [ ] **Step 2: Replace Step 1 (OpenKnowledge init) to also check `.env`, and replace Step 2 to drop the Base URL/Test Credentials questions**

Find this exact block (the skill's current Step 1 through the start of Step 2):

```markdown
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
```

Replace it with:

```markdown
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
```

- [ ] **Step 3: Renumber the remaining steps**

The file's current "Step 3" (regression-flows.md) becomes "Step 4", and
the current "Step 4" (Summary) becomes "Step 5". Update both heading
lines:

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
```

Find `## Step 3 — Fill in or update \`context/regression-flows.md\`` and
change it to `## Step 4 — Fill in or update \`context/regression-flows.md\``.

Find `## Step 4 — Summary` and change it to `## Step 5 — Summary`.

Also update the Summary step's closing sentence, which currently says
"they're ready to run `qa-blackbox`, `qa-smoke-test`, or `qa-regression`"
— add a mention that `.env` should be configured too if it wasn't
already:

Find:
```markdown
Once done, show the user a short summary of what's now in
`context/navigation-map.md` (filled sections vs. still-empty ones) and
`context/regression-flows.md` (flow count and names), and tell them
they're ready to run `qa-blackbox`, `qa-smoke-test`, or `qa-regression`.
```

Replace with:
```markdown
Once done, show the user a short summary of what's now in `.env`
(configured or still needs filling in — never show its actual values),
`context/navigation-map.md` (filled sections vs. still-empty ones), and
`context/regression-flows.md` (flow count and names), and tell them
they're ready to run `qa-blackbox`, `qa-smoke-test`, or `qa-regression`.
```

- [ ] **Step 4: Update the Constraints section**

Find:
```markdown
## Constraints

- Never write a plaintext credential or secret into `context/` — always
  a reference to where it's stored.
- Never overwrite a section the user didn't ask to change.
- Never fabricate a flow, URL, or credential reference the user didn't
  actually provide — leave a section as its explicit placeholder rather
  than guessing.
```

Replace with:
```markdown
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
```

- [ ] **Step 5: Verify**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
grep -n "^## Step" .claude/skills/qa-project-setup/SKILL.md
grep -n "Base URL\|Test Credentials" .claude/skills/qa-project-setup/SKILL.md
```

Expected: five `## Step` headings in order (1 OpenKnowledge, 2 `.env`, 3 navigation-map.md, 4 regression-flows.md, 5 Summary); the second grep finds no remaining reference to "Base URL" or "Test Credentials" as things this skill asks about (a mention inside a comment explaining *why* they were removed, if any, would be the only acceptable match — there shouldn't be one here since Task 2's comment change lives in a different file).

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/qa-project-setup/SKILL.md
git commit -m "feat: qa-project-setup guides .env creation instead of asking for Base URL/Test Credentials"
```

---

### Task 4: Update `qa-blackbox` to read `.env` for Base URL and credentials

**Files:**
- Modify: `.claude/skills/qa-blackbox/SKILL.md`

**Interfaces:**
- Consumes: `.env.example`'s variable names (`BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`) from Task 1; `context/navigation-map.md`'s two-section template from Task 2.
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Read the current "Reading Project Context" section**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
sed -n '14,37p' .claude/skills/qa-blackbox/SKILL.md
```

- [ ] **Step 2: Replace the section**

Find this exact block:

```markdown
## Reading Project Context

Before running any scenario, check `context/navigation-map.md` (relative
to the repo root — use `AskUserQuestion` or state the assumption
explicitly if you're unsure of the repo root from your current working
directory):

- If the file still reads as the empty template (its `## Base URL`
  section says "not yet configured"), tell the user to run
  `/qa-project-setup` first, and ask whether to proceed anyway with a
  cold-start session (no persisted navigation map) or stop and wait.
- If it's filled in, use its `## Base URL`, `## Site Structure`, and
  `## Test Credentials` sections to know what to visit and which test
  user to log in as (never invent or guess credentials — if the
  reference points to a secrets manager or vault, tell the user which
  secret to retrieve rather than trying to access it yourself).
- Cross-check anything you're about to report as a bug against the
  `## Known Non-Bug Quirks` section first — if it's listed there, do not
  report it; treat it as confirmed-intentional behavior.

This step does not replace or skip Step 0's Playwright MCP pre-flight
check (see `CLAUDE.md`) — it happens after Playwright MCP is confirmed
available, before Scenario S1.
```

Replace it with:

```markdown
## Reading Project Context

Before running any scenario, read two sources (relative to the repo
root — use `AskUserQuestion` or state the assumption explicitly if
you're unsure of the repo root from your current working directory):

**`.env`** — read it via `Bash` (e.g. `set -a && source .env && set +a`,
then reference `$BASE_URL`, `$TEST_USER_EMAIL`, `$TEST_USER_PASSWORD`),
never by opening it with `Read` and never by printing its contents into
the conversation or into any report. If `.env` doesn't exist, or
`BASE_URL` comes out empty, tell the user to copy `.env.example` to
`.env` and fill it in (or run `/qa-project-setup`, which reminds them to
do this), and ask whether to proceed anyway with a cold-start session
(no base URL, prompting the user for one manually) or stop and wait.
`BASE_URL` is what you navigate to; `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`
are what you log in with — never invent or guess a credential, and never
report a value read from `.env` back to the user or into a report file.

**`context/navigation-map.md`** — use its `## Site Structure` section to
know what else to visit beyond the base URL (sidebar sections, tabs,
routes). Cross-check anything you're about to report as a bug against
its `## Known Non-Bug Quirks` section first — if it's listed there, do
not report it; treat it as confirmed-intentional behavior. If both
sections still read as their empty-template placeholder text, that's
fine — proceed with whatever `.env` gave you and no additional
structure guidance.

This step does not replace or skip Step 0's Playwright MCP pre-flight
check (see `CLAUDE.md`) — it happens after Playwright MCP is confirmed
available, before Scenario S1.
```

- [ ] **Step 3: Verify the edit didn't disturb anything else**

```bash
grep -n "^## " .claude/skills/qa-blackbox/SKILL.md | head -5
```

Expected: `## Reading Project Context`, `## Error Guessing Heuristics`, `## Quality Dimensions & Scoring`, then the rest of the file's existing headings unchanged — identical structure to before this task, only the first section's content changed.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/qa-blackbox/SKILL.md
git commit -m "feat: qa-blackbox reads .env for BASE_URL and test credentials instead of navigation-map.md"
```

---

### Task 5: Update `qa-smoke-test` to optionally read `.env`

**Files:**
- Modify: `.claude/skills/qa-smoke-test/SKILL.md`

**Interfaces:**
- Consumes: `.env.example`'s variable names from Task 1.
- Produces: nothing new consumed by later tasks.

`qa-smoke-test` today optionally reads `context/navigation-map.md` for base URL/site structure, but doesn't require it (it can proceed with a URL the user gives it directly). This task updates that optional-read to point at `.env` instead of `navigation-map.md`'s (now-removed) Base URL section, while keeping the same "optional, not required" behavior.

- [ ] **Step 1: Read the current relevant paragraph**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
grep -n "navigation-map.md" .claude/skills/qa-smoke-test/SKILL.md
```

- [ ] **Step 2: Replace the paragraph**

Find this exact block (inside "## Step 2 — Scope the smoke test to the ticket's feature"):

```markdown
Optionally check `context/navigation-map.md` for the base URL and site
structure, the same way `qa-blackbox` does — this skill benefits from
that context too, but does not require it to be filled in (a smoke test
can proceed with a URL the user provides directly if `navigation-map.md`
is still an empty template).
```

Replace it with:

```markdown
Optionally read `.env` via `Bash` (same method as `qa-blackbox`: source
it, never `Read` it or print its contents) for `BASE_URL`, and check
`context/navigation-map.md`'s `## Site Structure` section — this skill
benefits from both but does not require either (a smoke test can
proceed with a URL the user provides directly if `.env` isn't configured
yet).
```

- [ ] **Step 3: Verify**

```bash
grep -n "navigation-map.md\|\.env" .claude/skills/qa-smoke-test/SKILL.md
```

Expected: the updated paragraph is the only place either is mentioned, reading correctly with both `.env` and `navigation-map.md`'s `## Site Structure` referenced, no stale mention of a "Base URL" section inside `navigation-map.md`.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/qa-smoke-test/SKILL.md
git commit -m "feat: qa-smoke-test optionally reads .env for BASE_URL instead of navigation-map.md"
```

---

### Task 5b: `qa-regression` reads `context/navigation-map.md`

**Files:**
- Modify: `.claude/skills/qa-regression/SKILL.md`

**Interfaces:**
- Consumes: `context/navigation-map.md`'s two-section template (`## Site Structure`, `## Known Non-Bug Quirks`) from Task 2.
- Produces: nothing new consumed by later tasks.

**Why this task exists separately, added mid-plan:** the original design for this iteration only touched `qa-project-setup`, `qa-blackbox`, and `qa-smoke-test` — `qa-regression` was believed to have no reason to read `navigation-map.md`, since each flow entry in `regression-flows.md` already carries its own steps and test data. User feedback during implementation pointed out this was an inconsistency: `qa-blackbox` cross-checks findings against `## Known Non-Bug Quirks` before reporting a bug, but `qa-regression` — which also finds and reports bugs while running a flow — never did the same check. This task closes that gap. It does **not** add `.env` reading to `qa-regression` — that part of the original design was correct and stays unchanged: `qa-regression` still has no need for a base URL or credentials of its own.

- [ ] **Step 1: Read the current file and locate the insertion point**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
grep -n "^## " .claude/skills/qa-regression/SKILL.md
```

Expected current headings, in order: `## Step 0 — Pre-flight: verify Playwright MCP`, `## Step 1 — Load the regression flows`, `## Step 2 — Execute each selected flow`, `## Step 3 — Update last-run history`, `## Step 4 — Final report`, `## Constraints`. Insert the new context-reading step between Step 0 and Step 1 — after Playwright MCP is confirmed available, before flows are loaded — mirroring where `qa-blackbox`'s "Reading Project Context" section sits relative to its own Step 0.

- [ ] **Step 2: Insert the new step, and renumber the rest**

Find this exact block (the boundary between the current Step 0 and Step 1):

```markdown
## Step 0 — Pre-flight: verify Playwright MCP

Same check as `qa-blackbox`, `qa-text-check`, and `qa-smoke-test`:
confirm `mcp__playwright__browser_navigate` is available before doing
anything else. If not, stop immediately with the same halted-session
message pattern as the other skills' Step 0 ("**Regression run halted —
Playwright MCP is not connected.**").

## Step 1 — Load the regression flows
```

Replace it with:

```markdown
## Step 0 — Pre-flight: verify Playwright MCP

Same check as `qa-blackbox`, `qa-text-check`, and `qa-smoke-test`:
confirm `mcp__playwright__browser_navigate` is available before doing
anything else. If not, stop immediately with the same halted-session
message pattern as the other skills' Step 0 ("**Regression run halted —
Playwright MCP is not connected.**").

## Step 1 — Reading Project Context

Read `context/navigation-map.md`'s `## Site Structure` section for
general orientation on the site's layout — this is supplementary to
each flow's own `**Steps:**`, which already say exactly where to go;
use Site Structure only if a flow's steps reference a section by name
without a concrete route. This skill does not read `.env` — it has no
base URL or credential of its own to look up; every flow's steps and
test data already carry whatever a specific flow needs.

Cross-check anything you're about to report as a bug (per Step 3 below)
against `## Known Non-Bug Quirks` first — if it's listed there, do not
report it; treat it as confirmed-intentional behavior. This is the same
false-positive guard `qa-blackbox` already applies.

If both sections still read as their empty-template placeholder text,
that's fine — proceed using only what each flow's own steps provide.

## Step 2 — Load the regression flows
```

- [ ] **Step 3: Renumber the remaining steps**

The file's current "Step 2" (Execute each selected flow) becomes
"Step 3", current "Step 3" (Update last-run history) becomes "Step 4",
and current "Step 4" (Final report) becomes "Step 5". Update each
heading line and every internal cross-reference to a step number:

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
grep -n "Step [0-4]" .claude/skills/qa-regression/SKILL.md
```

Read the matches and update:
- `## Step 2 — Execute each selected flow` → `## Step 3 — Execute each selected flow`
- `## Step 3 — Update last-run history` → `## Step 4 — Update last-run history`
- `## Step 4 — Final report` → `## Step 5 — Final report`
- Any internal prose reference to "Step 3" (the old "Update last-run
  history" step, if referenced by number anywhere else in the file) →
  "Step 4"; any reference to "Step 2" (old "Execute each selected
  flow") → "Step 3". Read the full file after the heading renumber to
  catch any such cross-reference — do not assume there are none without
  checking.

- [ ] **Step 4: Verify**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
grep -n "^## " .claude/skills/qa-regression/SKILL.md
```

Expected, in order: `## Step 0 — Pre-flight: verify Playwright MCP`,
`## Step 1 — Reading Project Context`, `## Step 2 — Load the regression
flows`, `## Step 3 — Execute each selected flow`, `## Step 4 — Update
last-run history`, `## Step 5 — Final report`, `## Constraints`.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/qa-regression/SKILL.md
git commit -m "feat: qa-regression reads context/navigation-map.md for Site Structure and Known Non-Bug Quirks"
```

---

### Task 6: Write `GUIDE.md`

**Files:**
- Create: `GUIDE.md`

**Interfaces:**
- Consumes: the final state of every skill and file this plan and the prior `qa-team-template` plan produced — `qa-project-setup` (Task 3), `qa-blackbox` (Task 4), `qa-smoke-test` (Task 5), `qa-regression` (Task 5b), `qa-text-check`, `report-bugs-to-clickup`, `report-improvements-to-clickup`, `.env.example` (Task 1), `context/navigation-map.md`'s final two-section template (Task 2).
- Produces: the file `GUIDE.md` that Task 7 (`README.md` trim) links to.

- [ ] **Step 1: Write `GUIDE.md`**

```markdown
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

## 3. Configure `.env`

Copy the example file and fill in real values for your project:

```bash
cp .env.example .env
```

Edit `.env` and set:

- `BASE_URL` — your project's base URL (e.g.
  `https://staging.your-client.com`).
- `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` — a test user's real
  credentials. Add more `TEST_<ROLE>_EMAIL`/`_PASSWORD` pairs if your
  project needs more than one test role.
- `API_KEY` — only if your site needs one; leave it commented out
  otherwise.

**`.env` is gitignored — it is never committed, and you should never
paste its contents into a chat message.** Every testing skill below
reads it directly; you only fill it in once per project (update it
again only if credentials change).

## 4. The testing skills

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

## 5. Reports and tickets

`qa-blackbox`, `qa-text-check`, `qa-smoke-test`, and `qa-regression` all
save evidence (a report plus screenshots) to
`evidence/{hostname}/{subpath}/{YYYY-MM-DD}/` — `qa-blackbox` and
`qa-smoke-test` write `qa-report.md`, `qa-text-check` writes
`text-qa-report.md`, both in the same 4-column Bug Register format
(`ID | Severity | Description | Evidence`).

To turn a report's findings into ClickUp tickets, run one or both of
these (manual, on-demand — they never run automatically):

```bash
/report-bugs-to-clickup path/to/qa-report.md
```

Creates one ClickUp bug ticket per row in the report's Bug Register, in
the project's fixed Bugs List, associated with the active sprint, tagged
by environment, assigned to you.

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
```

- [ ] **Step 2: Verify**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
grep -n "^## " GUIDE.md
```

Expected: five numbered sections (`## 1. Clone the repo` through `## 5. Reports and tickets`), in order.

- [ ] **Step 3: Commit**

```bash
git add GUIDE.md
git commit -m "docs: add GUIDE.md — end-to-end narrative walkthrough"
```

---

### Task 7: Trim `README.md` to a short quickstart and link to `GUIDE.md`

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `GUIDE.md`'s existence from Task 6.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Read the current `README.md` in full**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
cat README.md
```

- [ ] **Step 2: Add a prominent `GUIDE.md` link near the top**

Insert this immediately after the existing "This repo is a GitHub
**Template repository**..." blockquote and before the "SpaceDev's
shared toolkit..." paragraph:

```markdown
> **New to this repo?** Read [`GUIDE.md`](./GUIDE.md) end to end first —
> it walks through cloning, mapping your project's context, configuring
> `.env`, and which testing skill to use when. This README is a
> technical quickstart/reference, not the full walkthrough.
```

- [ ] **Step 3: Update the Quickstart section's credential-setup step**

Find the "## Quickstart — QA Agent" section's code block, which
currently reads:

```markdown
```bash
npx playwright install chromium   # one-time
cp .claude/settings.local.json.example .claude/settings.local.json
claude
```
```

Add a `.env` copy step, since Task 1 introduced it:

```markdown
```bash
npx playwright install chromium   # one-time
cp .claude/settings.local.json.example .claude/settings.local.json
cp .env.example .env   # then fill in BASE_URL and test credentials
claude
```
```

- [ ] **Step 4: Update "Project Context (OpenKnowledge)" section for the `.env` split**

Find:

```markdown
## Project Context (OpenKnowledge)

This repo's `context/` directory is an [OpenKnowledge](https://github.com/inkeep/open-knowledge)
project once initialized. The first time you use a project repo created
from this template, run `/qa-project-setup` — it runs `ok init` for you
and then walks you through filling in `context/navigation-map.md` and
`context/regression-flows.md` with your project's specifics.

You do not need to run `ok init` yourself, and this template repo does
not ship with `.ok/` already created — `qa-project-setup` creates it the
first time, scoped to your new project repo.
```

Replace with:

```markdown
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
```

- [ ] **Step 5: Add a short `.env` section**

Insert this new section right after "Project Context (OpenKnowledge)"
and before "Setting Up a New Project":

```markdown
## Credentials (`.env`)

```bash
cp .env.example .env
```

Fill in `BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` (and
`API_KEY` if your project needs one). `.env` is gitignored — never
commit it or paste its contents into chat. See
[`GUIDE.md`](./GUIDE.md#3-configure-env) for details.
```

- [ ] **Step 6: Verify**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
grep -n "GUIDE.md" README.md
grep -n "^## " README.md
```

Expected: at least 3 matches for `GUIDE.md` (the new top note, and the two links added in Steps 4-5); heading list now includes the new "Credentials (`.env`)" section between "Project Context (OpenKnowledge)" and "Setting Up a New Project".

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: trim README.md to a quickstart, link to GUIDE.md, add .env setup step"
```

---

### Task 8: Validate the whole chain end to end

**Files:**
- None created or modified — this task exercises Tasks 1-7's output for real.

**Interfaces:**
- Consumes: everything from Tasks 1-7.
- Produces: a validation report confirming the template repo is genuinely clone-and-use, per this plan's explicit acceptance bar (spec, "Validation goal for this iteration"). Like the prior `qa-text-check` and `qa-team-template` plans, live browser/MCP verification is disclosed as an open item if this control session has no MCP tools — but the file-level and skill-instruction-level chain IS fully verifiable without live MCP, and this task does that verification for real rather than skipping straight to disclosure.

- [ ] **Step 1: Simulate a from-template clone in a scratch directory**

A literal GitHub "Use this template" clone requires GitHub access this
control session doesn't have. Simulate the equivalent locally: clone
this repo's current branch into a fresh scratch directory, which
exercises the same "I just got this repo, nothing local is configured
yet" starting state a real tester would have.

```bash
rm -rf /tmp/qa-team-validate
git clone /Users/juliadisarli/Documents/GitHub/qa-team /tmp/qa-team-validate
cd /tmp/qa-team-validate
git checkout feature/qa-team-template 2>/dev/null || git checkout $(git -C /Users/juliadisarli/Documents/GitHub/qa-team branch --show-current)
ls -la
```

Expected: a clean clone with `.env` absent (gitignored, never committed)
and `.env.example` present; `context/navigation-map.md` in its
just-two-sections empty-template state; no `.ok/` directory.

- [ ] **Step 2: Walk `GUIDE.md` section 1-3 for real**

```bash
cd /tmp/qa-team-validate
cat GUIDE.md | head -60
```

Confirm section 1 ("Clone the repo") accurately describes what you just
did (modulo the GitHub-vs-local-clone substitution noted in Step 1).

Then actually perform section 3's step:

```bash
cp .env.example .env
```

Edit `/tmp/qa-team-validate/.env` with realistic placeholder-but-valid-shaped
values (e.g. `BASE_URL=https://example.com`,
`TEST_USER_EMAIL=qa-validate@example.com`,
`TEST_USER_PASSWORD=validate-test-password-123`) — this doesn't need to
be a real site, since this step validates the *mechanism* (a skill can
read `.env` and get the values out), not a live browser session.

- [ ] **Step 3: Confirm `.env` is actually readable the way the skills describe**

```bash
cd /tmp/qa-team-validate
set -a && source .env && set +a
echo "BASE_URL=$BASE_URL"
echo "TEST_USER_EMAIL=$TEST_USER_EMAIL"
```

Expected: both print the values you set in Step 2 — confirms the
`source`-based read pattern Tasks 4 and 5 wrote into `qa-blackbox` and
`qa-smoke-test` actually works as literal shell commands, not just as
prose that sounds plausible.

- [ ] **Step 4: Confirm `git status` shows `.env` untracked/ignored, never stageable**

```bash
cd /tmp/qa-team-validate
git status --porcelain --ignored | grep "\.env$"
git check-ignore -v .env
```

Expected: `.env` appears only under ignored files (`!!` prefix in
`--ignored` output), and `git check-ignore -v .env` reports it matches
the `.env` line in `.gitignore` — confirms Task 1's gitignore entry
actually protects a real `.env` file from being committed, not just in
theory.

- [ ] **Step 5: Confirm the skill files' `.env`-reading instructions are internally consistent with what's on disk**

```bash
cd /tmp/qa-team-validate
grep -n "BASE_URL\|TEST_USER_EMAIL\|TEST_USER_PASSWORD" .claude/skills/qa-blackbox/SKILL.md .claude/skills/qa-smoke-test/SKILL.md .env.example
```

Expected: the exact same three variable names appear in all three
files — no drift between what `.env.example` defines, what
`qa-blackbox`/`qa-smoke-test` say they read, and what Step 3 above
proved actually works when sourced.

- [ ] **Step 6: Confirm `context/navigation-map.md` no longer asks for what `.env` now owns**

```bash
cd /tmp/qa-team-validate
grep -n "^## " context/navigation-map.md
grep -c "Base URL\|Test Credentials" .claude/skills/qa-project-setup/SKILL.md
```

Expected: `navigation-map.md` shows exactly `## Site Structure` and
`## Known Non-Bug Quirks`; the second grep's count reflects only
Task 3's Constraints-section explanation of what moved to `.env` (if
any match at all — ideally zero, confirm by reading what actually
matched if the count is non-zero, per Task 3's own Step 5 expectation).

- [ ] **Step 6b: Confirm `qa-regression` reads `navigation-map.md` and correctly does NOT read `.env`**

```bash
cd /tmp/qa-team-validate
grep -n "navigation-map.md\|Known Non-Bug Quirks\|Site Structure" .claude/skills/qa-regression/SKILL.md
grep -n "\.env\|BASE_URL\|TEST_USER" .claude/skills/qa-regression/SKILL.md
```

Expected: the first grep finds `qa-regression`'s new Step 1 referencing
`context/navigation-map.md`, `## Site Structure`, and `## Known Non-Bug
Quirks`; the second grep finds nothing (or only the explicit sentence
stating it does *not* read `.env`, per Task 5b's Step 2 content) —
confirms `qa-regression` gained the navigation-map read without also
gaining an `.env` read it was never supposed to have.

- [ ] **Step 7: Confirm `GUIDE.md` and `README.md` cross-reference correctly**

```bash
cd /tmp/qa-team-validate
grep -n "GUIDE.md" README.md
grep -n "README.md" GUIDE.md
```

Expected: `README.md` links to `GUIDE.md` (Task 7); `GUIDE.md` links
back to `README.md` for the technical quickstart (Task 6, section
intro) — both directions present, no dead-end.

- [ ] **Step 8: Clean up the scratch clone**

```bash
rm -rf /tmp/qa-team-validate
```

- [ ] **Step 9: Report results to the user**

Summarize, per `superpowers:verification-before-completion`: which of
Steps 1-7 passed with actual command output (not just "should work"),
and explicitly state what remains unverified by design — a real
Playwright MCP browser session actually navigating to a real
`BASE_URL` and logging in with real `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`
against a live site, and a real `ok init`/`/qa-project-setup` run inside
an interactive Claude Code session (this control session has neither
Playwright MCP nor an interactive terminal to run `/qa-project-setup`
against). Recommend the user run `/qa-project-setup` and a
`qa-blackbox` session against a real project repo created from this
template as the final, live confirmation — same category of
recommendation as the prior two plans in this repo left open.

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers spec Part 1 "Files". Task 2 covers "`context/navigation-map.md`'s template changes". Tasks 3-5 cover "Skill changes" (`qa-project-setup`, `qa-blackbox`, `qa-smoke-test` respectively). Task 5b covers the corrected `qa-regression` scope (see below). Task 6 covers spec Part 2's full `GUIDE.md` section list. Task 7 covers "`README.md` is trimmed... with a prominent link to `GUIDE.md`". Task 8 covers the spec's explicit "Validation goal for this iteration" requirement — walking the chain for real, not just reading files in isolation, including Task 5b's addition (Step 6b).
- **Placeholder scan:** no TBD/TODO; every step has literal file content, literal find/replace blocks, or literal commands with expected output.
- **Type/name consistency:** `BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `API_KEY` are used identically across Task 1 (`.env.example`), Task 3 (`qa-project-setup`'s Step 2 prose), Task 4 (`qa-blackbox`), Task 5 (`qa-smoke-test`), Task 6 (`GUIDE.md`), and Task 8's live validation (Steps 2-5) — verified for drift in Task 8 Step 5 specifically. `qa-regression` is deliberately absent from that list (Task 5b, Task 8 Step 6b) since it doesn't read `.env`.
- **Task 5b added mid-plan, correcting an initial scoping decision:** this plan's first draft explicitly scoped `qa-regression` out entirely (both `navigation-map.md` and `.env`), reasoning that each flow's own steps/test data made a context-read step unnecessary. User feedback caught that this missed the `## Known Non-Bug Quirks` false-positive guard `qa-blackbox` already has, which applies equally to bugs found during a regression run — `qa-regression` finds and reports bugs too, so it needed the same guard. Task 5b was added as a new task rather than editing this plan's original narrative in place, and the Global Constraints bullet and every task's Interfaces section referencing `qa-regression` were updated to match (Task 6, Task 8). The `.env` exclusion was NOT part of what needed correcting — that stays as originally scoped, and Task 5b's own content explicitly says so, so a future reader doesn't wonder whether excluding `.env` from `qa-regression` was an oversight too.
