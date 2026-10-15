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
  pattern as `CLAUDE.md` Step 0:

> **Text QA halted — Playwright MCP is not connected.**
>
> The Playwright MCP server (`mcp__playwright__*`) is required and is
> not available in this session. See `README.md`
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
using the same hostname/subpath naming rules as `CLAUDE.md`
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
  `CLAUDE.md` § "🧹 No Scripts — Ever".
- Never run this automatically as part of a `qa-blackbox` session —
  only on explicit `/qa-text-check` invocation.

---

## Generating HTML Reports (Optional)

This skill writes a markdown report (`qa-report.md`). For a formatted, self-contained HTML version, run the `qa-report-render` skill on that file:

```bash
/qa-report-render evidence/{hostname}/{flow}/{YYYY-MM-DD}/qa-report.md
```

The HTML is written next to the markdown in the same folder, works offline, and can be regenerated at any time without re-running the check. See `.claude/skills/qa-report-render/SKILL.md`.
