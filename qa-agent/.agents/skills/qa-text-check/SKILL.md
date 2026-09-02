---
name: qa-text-check
description: Browses live app screens with Playwright MCP and reports high-confidence typo, grammar, mixed-language, and punctuation bugs in Spanish or English. Invoke manually with a URL/flow and --lang=es|en.
user-invocable: true
allowed-tools: Read, AskUserQuestion
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
screens**, run this step's loop as a background task (do not block
the conversation walking screens one by one) and report back to the
user once the full report (Step 5) is written. If it has **5 or
fewer screens**, run the loop inline as normal. Either way, the
extraction, review, and report steps below are identical.

For each screen in scope, in order:

1. Navigate to it with `mcp__playwright__browser_navigate`.
2. Call `mcp__playwright__browser_snapshot` to get the accessibility
   tree. Collect every visible text node: headings, labels, button
   text, links, error/validation messages, placeholders, tooltips,
   empty-state copy.
3. Take exactly **one** evidence screenshot for this screen via
   `mcp__playwright__browser_take_screenshot` (not one per string).
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

Write to `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/text-qa-report.md`,
using the same hostname/subpath naming rules as `qa-agent/CLAUDE.md`
§ "📁 Evidence Structure" (e.g. `/` → `root`, `localhost:5173` →
`localhost-5173`). If the day's folder already exists, add files
rather than overwriting; number screenshots with continuity.

```markdown
# Text QA Report — {Tested flow}

**Date:** YYYY-MM-DD
**URL:** {full URL}
**Language checked:** es | en

---

## Bug Register

| ID | Severity | Screen | Original text | Suggested text | Issue type | Evidence |
|----|----------|--------|----------------|-----------------|------------|----------|
| TXT-001 | 🟡 Medium | Register | "Ingresa tu contraseña" | "Ingresá tu contraseña" | Grammar | 01-register.png |

---

## Evidence Files

| File | Description |
|------|-------------|
| 01-register.png | Register screen |
```

The `Description` column expected by `report-bugs-to-clickup` is
derived from this table's `Issue type`, `Original text`, and
`Suggested text` columns as: `{Issue type}: "{Original text}" →
"{Suggested text}"` — or just `{Issue type}: "{Original text}"` when
there is no single correct replacement (e.g. a leaked i18n key).

If a screen fails to load or navigate, skip it and add a short
"Skipped screens" note near the bottom of the report — continue with
the rest of the scope.

If **no issues** are found on any visited screen, still write the
report: an empty Bug Register table (header row only) plus an
explicit sentence such as "No text-quality issues found on the
screens checked." Never skip writing the report because there was
nothing to find.

## Constraints

- Never fabricate a "Suggested text" you're not confident about —
  if the fix isn't obvious, describe the issue in "Issue type" only
  and leave "Suggested text" as `—`.
- Never read i18n/source files — this is black-box QA; review only
  what's rendered live in the browser.
- Never use `browser_evaluate` to simulate what `browser_snapshot`
  and `browser_take_screenshot` already handle, and never create
  `qa-*.js` or any temporary script file — same rule as
  `qa-agent/CLAUDE.md` § "🧹 No Scripts — Ever".
- Never run this automatically as part of a `qa-blackbox` session —
  only on explicit `/qa-text-check` invocation.
