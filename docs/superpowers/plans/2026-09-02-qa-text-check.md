# qa-text-check Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `qa-text-check` skill to the `qa-agent` module that browses live app screens with Playwright MCP and reports high-confidence typo/grammar/mixed-language/punctuation bugs in Spanish or English, writing a `text-qa-report.md` whose Bug Register is parseable by `report-bugs-to-clickup`.

**Architecture:** A single `SKILL.md` (instructions-only, no code — same pattern as `qa-blackbox`) living at `qa-agent/.agents/skills/qa-text-check/`, invoked manually with `/qa-text-check`. It reuses the existing Playwright MCP pre-flight pattern and evidence-folder convention already defined in `qa-agent/CLAUDE.md`, runs large scopes as a background task to avoid blocking the session, and is registered as an available-but-not-auto-activated skill in `qa-agent/CLAUDE.md` and `qa-agent/README.md`.

**Tech Stack:** Markdown skill definition (Claude Code skill format), Playwright MCP (`mcp__playwright__*`), no new dependencies or scripts.

## Global Constraints

- `--lang` is **required** (`es` or `en`) — the skill never auto-detects language per screen (spec §Trigger).
- The skill does not crawl a site on its own — it requires an explicit URL/flow and either `--pages` or a user answer naming the screens to visit (spec §Trigger, §Resolve inputs).
- Pre-flight: if Playwright MCP tools are not available, stop immediately and tell the user — never attempt a workaround (spec §Pre-flight, matches `qa-agent/CLAUDE.md` Step 0).
- A full browser (Playwright MCP) is required — a plain HTTP fetch cannot see JS-rendered UI text (spec §3, "Execution mode for large scopes").
- One evidence screenshot per **screen**, not per string (spec §3), saved into the same dated evidence folder the report is written into, using the `NN-{screen-name}.png` numbering convention from `qa-agent/CLAUDE.md` § "📁 Evidence Structure" (e.g. `01-initial-load.png`) — applies whether the run is inline or backgrounded (spec §3).
- **Scope size threshold:** when the resolved scope covers more than 5 screens, the skill runs the entire pipeline — extraction, review, classification, and report-writing — as a single background task and reports back only once the finished report exists; 5 or fewer screens run that same pipeline inline (spec §3).
- Only high-confidence issues are reported — no style/preference suggestions; ambiguous cases (brand names, proper nouns, technical terms) are skipped (spec §4).
- Report path: `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/text-qa-report.md`, following the same hostname/subpath naming rules already defined in `qa-agent/CLAUDE.md` § "📁 Evidence Structure" (e.g. `/` → `root`, `localhost:5173` → `localhost-5173`).
- Report title and Bug Register columns: `# QA Report — {Tested flow}` with columns `ID | Severity | Description | Evidence` — the exact same title and column format `report-bugs-to-clickup` already expects, so it can parse the report unchanged. `Issue type`, `Original text`, and `Suggested text` are folded into the `Description` cell at report-writing time (spec §6).
- Severity: High = mixed language on a core/critical flow or a leaked i18n key; Medium = typo/grammar error in normal copy; Low = punctuation/capitalization inconsistency (spec §5).
- A report is written even when zero issues are found — an empty Bug Register with an explicit "no issues found" note, never a skipped report (spec §6).
- No scripts: all browser interaction goes through `mcp__playwright__*` tools directly, same rule as `qa-agent/CLAUDE.md` § "🧹 No Scripts — Ever".
- This skill is **not** wired into `qa-blackbox`'s automatic trigger — it only runs on explicit `/qa-text-check` invocation (spec §Trigger, §Location).

---

### Task 1: Write the `qa-text-check` SKILL.md

**Files:**
- Create: `qa-agent/.agents/skills/qa-text-check/SKILL.md`

**Interfaces:**
- Consumes: nothing from other tasks — this is the skill's own definition file.
- Produces: the skill itself, invoked as `/qa-text-check <url-or-flow> --lang=es|en [--pages=<screen list>]`. Task 2 and Task 3 (README/CLAUDE.md updates) reference this skill by name (`qa-text-check`) and by its frontmatter `description`.

This is a documentation/instructions file, not code — there is no unit test to write. "Testing" for this task means a dry-run read-through against the spec's checklist (Step 2) and a live smoke test once the file exists (Task 4).

- [ ] **Step 1: Write the SKILL.md frontmatter and body**

Create `qa-agent/.agents/skills/qa-text-check/SKILL.md` with this exact content:

```markdown
---
name: qa-text-check
description: Browses live app screens with Playwright MCP and reports high-confidence typo, grammar, mixed-language, and punctuation bugs in Spanish or English. Invoke manually with a URL/flow and --lang=es|en.
user-invocable: true
allowed-tools: Write, Read, AskUserQuestion
---

# qa-text-check — Text-Quality QA (typos, grammar, mixed language)

You review the **visible UI text** of live app screens for high-confidence
language bugs — typos, grammar/agreement errors, mixed/wrong-language
text, and punctuation/capitalization inconsistencies — in Spanish or
English. This is a manual, on-demand skill: only run it when the user
explicitly invokes `/qa-text-check <url-or-flow> --lang=es|en
[--pages=<screen list>]`. It is **not** triggered automatically by
`qa-blackbox`'s URL+flow auto-activation.

## Step 0 — Pre-flight: verify Playwright MCP

Before doing anything else, confirm `mcp__playwright__browser_navigate`
is listed among your available tools. A full browser is required here
— a plain HTTP fetch of the HTML cannot see text rendered client-side
by a JS framework, which is most of the UI copy in a modern SPA.

- **Available**: continue to Step 1.
- **Not available**: stop immediately and tell the user, same message
  pattern as `qa-agent/CLAUDE.md` Step 0:

> **Text QA halted — Playwright MCP is not connected.**
>
> The Playwright MCP server (`mcp__playwright__*`) is required and is
> not available in this session. See `qa-agent/README.md`
> Troubleshooting section.

Do not attempt navigation or a workaround without Playwright MCP.

## Step 1 — Resolve inputs

- **`--lang`** (`es` or `en`) is required. If missing, ask the user
  with `AskUserQuestion` before visiting any screen — do not guess
  from the URL or assume a default.
- **Scope**: a URL/flow plus either `--pages` (a list of routes or
  screen names) or an explicit answer from the user naming the
  screens to visit. If neither is given, ask the user which screens
  or flow to cover. Never crawl a site on your own to discover pages
  — that is `qa-blackbox`'s Full Site Audit protocol, not this
  skill's job.

## Step 2 — Visit each screen and extract visible text

**Execution mode:** count the resolved scope. If it has **more than 5
screens**, run the entire pipeline — Steps 2 through 5 (visit/extract,
review, classify, and write the report) — as a single background task,
not just this step's loop, so the conversation is never blocked
walking screens one by one. Report back to the user only once Step 5
has finished writing `text-qa-report.md`, and give the user its path.
If the scope has **5 or fewer screens**, run Steps 2 through 5 inline
as normal. Either way, the extraction, review, classification, and
report steps are identical — only whether they run in the foreground
or as one backgrounded unit changes.

For each screen in scope, in order:

1. Navigate to it with `mcp__playwright__browser_navigate`.
2. Call `mcp__playwright__browser_snapshot` to get the accessibility
   tree. Collect every visible text node: headings, labels, button
   text, links, error/validation messages, placeholders, tooltips,
   empty-state copy.
3. Take exactly **one** evidence screenshot for this screen via
   `mcp__playwright__browser_take_screenshot`, saved into the same
   dated evidence folder Step 5 writes the report into —
   `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/` — using the filename
   convention `NN-{screen-name}.png` (e.g. `01-register.png`,
   `02-dashboard.png`), numbered in visit order with continuity if the
   day's folder already has screenshots. This applies whether the run
   is inline or backgrounded, so the report's `Evidence` column always
   names a file that actually exists in that folder. Take exactly one
   screenshot per screen (not per string).
4. Discard strings that are pure data — numbers, dates,
   user-generated content, IDs. You review UI copy, not arbitrary
   backend-rendered content.

## Step 3 — Review each extracted string

Evaluate every extracted UI string against the session's `--lang`.
Report **only high-confidence issues** — never style or preference
suggestions. Categories:

- **Typo** — a clearly misspelled word in the session's language.
- **Grammar** — clear gender/number agreement errors, wrong verb
  conjugation, obviously broken sentence structure.
- **Mixed language** — text in the other language on a screen that
  should be entirely in `--lang` (e.g. an English button on an
  otherwise Spanish screen), a raw i18n key leaking into the UI
  (e.g. `home.title`), or placeholder copy (`Lorem ipsum`, `TODO`,
  `test test`).
- **Punctuation/Capitalization** — a missing required accent that
  changes or breaks the word, inconsistent capitalization of the
  same label across the app, missing or duplicated punctuation.

Skip, don't report, anything ambiguous — a possible brand name,
proper noun, or technical term you're not certain is wrong.

## Step 4 — Classify severity

| Level | Icon | Criteria |
|-------|------|----------|
| High | 🔴 | Mixed language on a core/critical flow (auth, checkout), or a raw i18n key visible to the user |
| Medium | 🟡 | Typo or grammar error in normal visible copy |
| Low | 🟢 | Punctuation/capitalization inconsistency |

## Step 5 — Write the report

If this pipeline was started as a background task (Step 2, scope > 5
screens), this step still runs as part of that same background task —
do not treat it as a separate foreground step. Only once this step
finishes do you report back to the user.

Write to `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/text-qa-report.md`,
using the same hostname/subpath naming rules as `qa-agent/CLAUDE.md`
§ "📁 Evidence Structure" (e.g. `/` → `root`, `localhost:5173` →
`localhost-5173`). This is the same dated evidence folder the Step 2.3
screenshots were saved into. If the day's folder already exists, add
files rather than overwriting; number screenshots with continuity.

The report uses the same 4-column Bug Register format as
`qa-blackbox`'s `qa-report.md` (`ID | Severity | Description |
Evidence`), so `report-bugs-to-clickup` can parse it without any
changes. When writing the `Description` cell for each bug, combine the
issue type, original text, and suggested text as: `{Issue type}:
"{Original text}" → "{Suggested text}"` — or just `{Issue type}:
"{Original text}"` when there is no single correct replacement (e.g. a
leaked i18n key).

```markdown
# QA Report — {Tested flow}

**Date:** YYYY-MM-DD
**URL:** {full URL}
**Language checked:** es | en

---

## Bug Register

| ID | Severity | Description | Evidence |
|----|----------|--------------|----------|
| TXT-001 | 🟡 Medium | Grammar: "Ingresa tu contraseña" → "Ingresá tu contraseña" | 01-register.png |

---

## Evidence Files

| File | Description |
|------|-------------|
| 01-register.png | Register screen |
```

Note the title line must read exactly `# QA Report — {Tested flow}`
(em dash, matching `report-bugs-to-clickup`'s required header
format) — not `# Text QA Report — …`. The `**Language checked:**` line
stays in the report body for a human reader; it is not read by the
parser.

If a screen fails to load or navigate, skip it and add a short
"Skipped screens" note near the bottom of the report — continue with
the rest of the scope.

If **no issues** are found on any visited screen, still write the
report: an empty Bug Register table (header row only) plus an
explicit sentence such as "No text-quality issues found on the
screens checked." Never skip writing the report because there was
nothing to find.

## Constraints

- Never fabricate a suggested replacement you're not confident about
  — if the fix isn't obvious, the `Description` cell should state the
  issue type and quote the original text only, without a "→
  suggestion" arrow.
- Never read i18n/source files — this is black-box QA; review only
  what's rendered live in the browser.
- Never use `browser_evaluate` to simulate what `browser_snapshot`
  and `browser_take_screenshot` already handle, and never create
  `qa-*.js` or any temporary script file — same rule as
  `qa-agent/CLAUDE.md` § "🧹 No Scripts — Ever".
- Never run this automatically as part of a `qa-blackbox` session —
  only on explicit `/qa-text-check` invocation.
```

- [ ] **Step 2: Verify against the spec's checklist**

Read back `qa-agent/.agents/skills/qa-text-check/SKILL.md` and confirm every item below is present. Check each one off mentally — do not proceed to Step 3 until all are true:

- [ ] Frontmatter has `name: qa-text-check`, `user-invocable: true`, and `allowed-tools` includes `Write`, `Read`, and `AskUserQuestion` (Write is needed for Step 5's report file; Playwright tools are consumed via `mcp__playwright__*`, granted at the `qa-agent` session level, not per-skill).
- [ ] Step 0 pre-flight matches `qa-agent/CLAUDE.md` Step 0's message pattern.
- [ ] Step 1 makes `--lang` required and refuses to guess scope.
- [ ] Step 2 states that the 5-screen threshold backgrounds the entire Steps 2-5 pipeline (not just extraction), takes exactly one screenshot per screen, and saves each screenshot into the report's evidence folder using the `NN-{screen-name}.png` convention.
- [ ] Step 3 lists all four issue categories from the spec (typo, grammar, mixed language, punctuation/capitalization) and says to skip ambiguous cases.
- [ ] Step 4's severity table matches the spec exactly (High/Medium/Low criteria).
- [ ] Step 5's report title (`# QA Report — {Tested flow}`) and Bug Register columns (`ID | Severity | Description | Evidence`) match `report-bugs-to-clickup`'s expected format exactly, and Step 5 covers both the "skipped screen" and "zero issues found" cases.
- [ ] Constraints section forbids fabricated suggestions, i18n/source file reads, scripts, and automatic triggering.

- [ ] **Step 3: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add qa-agent/.agents/skills/qa-text-check/SKILL.md
git commit -m "feat: add qa-text-check skill definition"
```

---

### Task 2: Register the skill in `qa-agent/CLAUDE.md`

**Files:**
- Modify: `qa-agent/CLAUDE.md`

**Interfaces:**
- Consumes: the skill name `qa-text-check` and its one-line purpose from Task 1's frontmatter `description`.
- Produces: nothing consumed by later tasks — this is a documentation update.

- [ ] **Step 1: Replace the "🛠 Skills & Tools — Always Active" section**

Find this block in `qa-agent/CLAUDE.md`:

```markdown
## 🛠 Skills & Tools — Always Active

| Tool | Purpose |
|------|---------|
| `qa-blackbox` | Quality dimensions, scoring model, report format |
| `frontend-design:frontend-design` | Visual audit: typography, contrast, layout, UX |
| `superpowers:verification-before-completion` | Verify real evidence before claiming work complete |
| Playwright MCP (`mcp__playwright__*`) | Navigation, interaction, screenshots, DOM inspection |

> **Required:** Playwright MCP must be connected before any QA session starts. See Step 0 above.
```

Replace the whole block with (renamed heading, added `Activation` column and new row):

```markdown
## 🛠 Skills & Tools

| Tool | Purpose | Activation |
|------|---------|------------|
| `qa-blackbox` | Quality dimensions, scoring model, report format | Automatic — triggers on a URL+flow message (see above) |
| `frontend-design:frontend-design` | Visual audit: typography, contrast, layout, UX | Automatic — part of the standard protocol |
| `superpowers:verification-before-completion` | Verify real evidence before claiming work complete | Automatic — part of the standard protocol |
| `qa-text-check` | Typo, grammar, mixed-language, and punctuation bugs in Spanish or English | **Manual only** — invoke explicitly with `/qa-text-check <url-or-flow> --lang=es\|en` |
| Playwright MCP (`mcp__playwright__*`) | Navigation, interaction, screenshots, DOM inspection | Required for all of the above |

> **Required:** Playwright MCP must be connected before any QA session starts. See Step 0 above.
> **Note:** `qa-text-check` is never triggered automatically by the URL+flow auto-activation described above — it only runs when the user explicitly types `/qa-text-check`.
```

Use `Edit` to replace the old block with the new one in `qa-agent/CLAUDE.md`.

- [ ] **Step 2: Verify the edit**

Run:

```bash
grep -n "qa-text-check" /Users/juliadisarli/Documents/GitHub/qa-team/qa-agent/CLAUDE.md
```

Expected: at least 2 matches (the table row and the note), no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add qa-agent/CLAUDE.md
git commit -m "docs: register qa-text-check as a manual-only skill in qa-agent CLAUDE.md"
```

---

### Task 3: Register the skill in `qa-agent/README.md`

**Files:**
- Modify: `qa-agent/README.md`

**Interfaces:**
- Consumes: the skill name and location from Task 1.
- Produces: nothing consumed by later tasks — this is a documentation update.

- [ ] **Step 1: Add a row to the "What Each Piece Does" table**

Find this block in `qa-agent/README.md`:

```markdown
## What Each Piece Does

| Component | Location | Purpose |
|-----------|----------|---------|
| `qa-blackbox` skill | `.agents/skills/qa-blackbox/` | Quality dimensions, scoring model, report format |
| `frontend-design` skill | `.agents/skills/frontend-design/` | Visual/UX audit: typography, contrast, layout, accessibility |
| `verification-before-completion` skill | `.agents/skills/verification-before-completion/` | Requires real evidence before claiming work complete |
| Playwright MCP | `npx @playwright/mcp@latest` (auto-fetched) | Browser navigation, screenshots, accessibility tree inspection |
```

Replace it with (new row added before the Playwright MCP row):

```markdown
## What Each Piece Does

| Component | Location | Purpose |
|-----------|----------|---------|
| `qa-blackbox` skill | `.agents/skills/qa-blackbox/` | Quality dimensions, scoring model, report format |
| `frontend-design` skill | `.agents/skills/frontend-design/` | Visual/UX audit: typography, contrast, layout, accessibility |
| `verification-before-completion` skill | `.agents/skills/verification-before-completion/` | Requires real evidence before claiming work complete |
| `qa-text-check` skill | `.agents/skills/qa-text-check/` | Manual-only: typo, grammar, mixed-language, and punctuation bugs (es/en) |
| Playwright MCP | `npx @playwright/mcp@latest` (auto-fetched) | Browser navigation, screenshots, accessibility tree inspection |
```

- [ ] **Step 2: Add a "Running a Text QA Check" section after "Running a QA Session"**

Find this block:

```markdown
## Running a QA Session

Just tell Claude:

> Navigate to `<URL>` and test the `<flow>` flow.

Claude will automatically:
1. Verify Playwright MCP is connected
2. Create the evidence folder structure
3. Run all test scenarios
4. Save the report and screenshots

See [`CLAUDE.md`](./CLAUDE.md) for the full protocol (auto-activation
triggers, full-site audit mode, evidence folder naming rules, standard
scenario checklist, report format).
```

Insert a new section immediately after it (before "## Project Structure"):

```markdown
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

See [`.agents/skills/qa-text-check/SKILL.md`](./.agents/skills/qa-text-check/SKILL.md)
for the full protocol.
```

- [ ] **Step 3: Update the "Project Structure" tree**

Find this block:

```markdown
```
qa-agent/
├── .agents/
│   └── skills/
│       ├── qa-blackbox/SKILL.md
│       ├── frontend-design/SKILL.md
│       └── verification-before-completion/SKILL.md
├── .claude/
│   ├── settings.local.json.example   # copy to settings.local.json
│   └── settings.local.json           # gitignored, created locally
├── evidence/                          # gitignored — screenshots and reports
├── skills-lock.json
├── CLAUDE.md
└── README.md
```
```

Replace it with:

```markdown
```
qa-agent/
├── .agents/
│   └── skills/
│       ├── qa-blackbox/SKILL.md
│       ├── frontend-design/SKILL.md
│       ├── verification-before-completion/SKILL.md
│       └── qa-text-check/SKILL.md
├── .claude/
│   ├── settings.local.json.example   # copy to settings.local.json
│   └── settings.local.json           # gitignored, created locally
├── evidence/                          # gitignored — screenshots and reports
├── skills-lock.json
├── CLAUDE.md
└── README.md
```
```

- [ ] **Step 4: Update the session-start skills banner mention**

Find this block:

```markdown
At session start, the following skills must appear in the available
skills banner:

- `qa-blackbox`
- `frontend-design`
- `verification-before-completion`

These skills live locally in `.agents/skills/` — no plugin installation
needed. The Playwright MCP (`mcp__playwright__*`) loads automatically from
`.claude/settings.local.json`.
```

Replace it with:

```markdown
At session start, the following skills must appear in the available
skills banner:

- `qa-blackbox`
- `frontend-design`
- `verification-before-completion`
- `qa-text-check`

These skills live locally in `.agents/skills/` — no plugin installation
needed. The Playwright MCP (`mcp__playwright__*`) loads automatically from
`.claude/settings.local.json`. Unlike the other three, `qa-text-check`
only runs when explicitly invoked with `/qa-text-check` — it does not
trigger automatically.
```

- [ ] **Step 5: Verify the edits**

Run:

```bash
grep -n "qa-text-check" /Users/juliadisarli/Documents/GitHub/qa-team/qa-agent/README.md
```

Expected: at least 5 matches (table row, section heading, tree entry, banner list entry, and the trailing note), no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add qa-agent/README.md
git commit -m "docs: document qa-text-check in qa-agent README"
```

---

### Task 4: Live smoke test of the skill

**Files:**
- None created or modified — this task exercises Task 1–3's output against a real app.

**Interfaces:**
- Consumes: the finished `qa-text-check` SKILL.md (Task 1) and the updated `qa-agent/CLAUDE.md`/`README.md` (Task 2, 3).
- Produces: two real `text-qa-report.md` files under `qa-agent/evidence/` (one inline run, one background run) proving the skill works end-to-end in both execution modes — this is the deliverable that makes Task 1–3 "done", per this plan's Task Right-Sizing (an instructions-only skill has no unit test; its test is a real run).

There is no automated test harness for a Playwright-MCP-driven skill — verification is a real, observed run, following `superpowers:verification-before-completion`.

- [ ] **Step 1: Start a `qa-agent` session and confirm the skill loads**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team/qa-agent
claude
```

At the skills banner, confirm `qa-text-check` is listed alongside `qa-blackbox`, `frontend-design`, and `verification-before-completion`. If it's missing, stop — recheck Task 1's file path (`qa-agent/.agents/skills/qa-text-check/SKILL.md`) before continuing.

- [ ] **Step 2: Run the skill inline against 1–5 screens**

Pick any screen(s) already used in an existing `qa-agent` evidence run (check `qa-agent/evidence/` for a prior hostname/subpath, or use a locally running app under test) — no more than 5. Invoke:

```
/qa-text-check <that URL> --lang=es --pages=<1-5 screen paths>
```

Confirm in the transcript:
- The pre-flight check runs (Step 0 of the skill) and passes.
- The skill runs inline (no background task started) since scope ≤ 5 screens.
- Exactly one screenshot is taken per screen.
- The response either reports specific high-confidence issues (quoting the exact original text) or explicitly states none were found — never a vague "looks fine" with no report file mentioned.

- [ ] **Step 3: Verify the inline report file was written correctly**

```bash
find /Users/juliadisarli/Documents/GitHub/qa-team/qa-agent/evidence -name "text-qa-report.md" -newer /Users/juliadisarli/Documents/GitHub/qa-team/docs/superpowers/plans/2026-09-02-qa-text-check.md
```

Expected: one path printed. Read that file and confirm:
- It has the `# QA Report — {flow}` header with `**Language checked:** es`.
- Its Bug Register table has the exact columns `ID | Severity | Description | Evidence`, matching `report-bugs-to-clickup`'s expected format.
- Every row's `Evidence` column names a screenshot file that actually exists in the same folder, following the `NN-{screen-name}.png` convention.

- [ ] **Step 4: Run the skill against more than 5 screens to exercise the background path**

Invoke with a scope of 6+ screens (add extra known routes with `--pages` if the app under test doesn't naturally have that many):

```
/qa-text-check <that URL> --lang=es --pages=<6+ screen paths>
```

Confirm in the transcript that the skill announces running the entire Steps 2-5 pipeline (visit/extract, review, classify, report-writing) as a background task (per Step 2 of the SKILL.md) rather than walking screens one by one inline, and that it reports back only once the report is written.

- [ ] **Step 5: Verify the background-run report file**

Repeat the `find` command from Step 3 (adjust the `-newer` reference file if needed) and confirm the newly produced `text-qa-report.md` covers all 6+ screens requested in Step 4, with the same column structure verified in Step 3.

- [ ] **Step 6: Verify the "no issues found" path**

Re-run `/qa-text-check` (inline, ≤5 screens) against a screen you're confident has no text issues (or a trivial static screen). Confirm the resulting `text-qa-report.md` has an empty Bug Register (header row only) plus the explicit "No text-quality issues found on the screens checked." sentence — not a missing or skipped report.

- [ ] **Step 7: Verify Playwright MCP pre-flight failure path**

If you can temporarily disconnect the Playwright MCP (e.g. comment out the `mcpServers.playwright` entry in `qa-agent/.claude/settings.local.json` and restart the session), invoke `/qa-text-check` again and confirm it halts immediately with the "Text QA halted — Playwright MCP is not connected." message, without attempting any navigation. Restore the MCP config afterward.

If disconnecting the MCP isn't practical in your environment, skip this step and note in your final report to the user that this path was not exercised live — do not claim it was verified if it wasn't.

- [ ] **Step 8: Report results to the user**

Summarize, per `superpowers:verification-before-completion`: which steps above were run, the actual report file paths produced (inline and background runs), and whether Step 7 was exercised or skipped. Do not claim the skill "works" without pointing to the real report files from Step 3 and Step 5.

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers spec §Pre-flight, §Trigger/Resolve inputs, §3 (extraction + one screenshot per screen + the 5-screen background-execution threshold covering the full pipeline), §4 (review categories + skip-ambiguous rule), §5 (severity table), §6 (report format matching `report-bugs-to-clickup`'s exact 4-column Bug Register and title, empty-report case), and §Error handling (skipped screens). Task 2/3 cover spec §Location's required doc updates. Task 4 covers verification of both execution modes (inline and background), required by `superpowers:verification-before-completion` before any completion claim.
- **Placeholder scan:** no TBD/TODO; every step has literal file content or literal commands with expected output.
- **Type/name consistency:** the skill name `qa-text-check`, its file path, its Bug Register columns, its report filename (`text-qa-report.md`), and the 5-screen threshold are identical across Task 1's SKILL.md body, Task 2's CLAUDE.md table, Task 3's README.md updates, and Task 4's verification steps.
