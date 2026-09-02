# Design: `qa-text-check` skill

**Date:** 2026-09-01
**Author:** Julia Disarli (julia.disarli@otonomi.ai)
**Status:** Approved

## Purpose

Detect typos and other text-quality bugs (spelling, grammar/agreement,
mixed-language text, punctuation/capitalization) on live app screens,
in Spanish or English, by browsing the app the same way `qa-blackbox`
does and having Claude review each visible string. Produces a
`text-qa-report.md` that can feed into `report-bugs-to-clickup` the
same way a `qa-blackbox` report does.

## Trigger

Manual, on-demand. A project skill invoked explicitly by the user:

```
/qa-text-check <url-or-flow> --lang=es|en [--pages=<screen list>]
```

- `--lang` is **required**. It fixes the expected language for the
  whole session — the skill does not attempt to auto-detect language
  per screen. If omitted, the skill asks for it before doing anything
  else.
- `--pages` is optional: a list of routes/screen names to visit. If
  omitted, the skill asks the user which screens or flow to cover —
  it does not crawl a site on its own, the same way `qa-blackbox`
  expects a defined flow rather than exploring unprompted.

It is **not** wired into `qa-blackbox`'s automatic flow. Rationale
(same as `report-bugs-to-clickup`'s decoupling from `qa-agent`):
editorial control over which screens get a text pass, and reusability
— this skill can run standalone against any app/flow without a prior
`qa-blackbox` session.

## Location

`qa-team/.claude/skills/qa-text-check/SKILL.md` — a project-level
skill in this repo, alongside `report-bugs-to-clickup` and
`report-improvements-to-clickup`.

## Flow

### 1. Pre-flight

Same pattern as `qa-agent`'s Playwright MCP check: if the Playwright
MCP tools are not available in this session, stop immediately and
tell the user — do not attempt a workaround.

### 2. Resolve inputs

- Require `--lang` (`es` or `en`). Ask if missing.
- Require a target: `<url-or-flow>` plus either `--pages` or an
  explicit answer from the user about which screens to visit. Refuse
  to proceed with no defined scope.

### 3. Visit each screen and extract visible text

For each screen in scope:

1. Navigate to it.
2. Call `browser_snapshot` to get the accessibility tree — more
   reliable than raw DOM scraping — and collect every visible text
   node: headings, labels, button text, links, error/validation
   messages, placeholders, tooltips, empty-state copy.
3. Take one evidence screenshot per **screen** (not per string) via
   `browser_take_screenshot` — matches `qa-blackbox`'s evidence
   convention, keeps volume sane.
4. Discard strings that are pure data (numbers, dates, user-generated
   content, IDs) — the skill reviews UI copy, not arbitrary content
   rendered from the backend.

### 4. Review text (Claude judgment, no external spellchecker)

For each extracted UI string, Claude evaluates it against the
session's `--lang`, reporting only **high-confidence** issues —
no style/preference suggestions:

- **Typos/spelling** — a clearly misspelled word in `--lang`.
- **Grammar/agreement** — clear gender/number agreement errors, wrong
  verb conjugation, obviously broken sentence structure.
- **Mixed/wrong language** — text in the other language on a screen
  that should be entirely `--lang` (e.g. an English button on an
  otherwise Spanish screen), or a raw i18n key leaking into the UI
  (e.g. `home.title`), or placeholder copy (`Lorem ipsum`, `TODO`,
  `test test`).
- **Punctuation/capitalization** — a missing required accent in
  Spanish that changes or breaks the word, inconsistent
  capitalization of the same label across the app, missing/duplicated
  punctuation.

Ambiguous cases (could be intentional brand name, proper noun,
technical term) are skipped, not reported.

### 5. Severity classification

| Level | Icon | Criteria |
|-------|------|----------|
| High | 🔴 | Mixed language on a core/critical flow (auth, checkout), or a raw i18n key visible to the user |
| Medium | 🟡 | Typo or grammar error in normal visible copy |
| Low | 🟢 | Punctuation/capitalization inconsistency |

### 6. Report

Write to `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/text-qa-report.md`:

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

The Bug Register table's columns are a superset of `qa-blackbox`'s
(`ID | Severity | Description | Evidence`) — "Original text",
"Suggested text", and "Issue type" fold into the `Description` column
when consumed downstream, so `report-bugs-to-clickup` can parse this
report's Bug Register without any changes: `Description` becomes
`{Issue type}: "{Original text}" → "{Suggested text}"` (or just
`{Issue type}: "{Original text}"` when there's no single correct
replacement, e.g. a leaked i18n key).

If no issues are found on any visited screen, still write the report
with an empty Bug Register and say so explicitly — do not skip the
report, so a clean run is documented the same as a run with findings.

## Error handling

- Playwright MCP not connected / tools unavailable → stop
  immediately with a clear message, same as `qa-agent`'s pre-flight
  check.
- `--lang` missing → ask for it before visiting any screen.
- No screens/flow specified → ask the user, do not guess or crawl.
- A screen fails to load/navigate → skip that screen, note it in the
  final report under a short "Skipped screens" note, continue with
  the rest.

## Out of scope (for this iteration)

- Reading i18n/source files — this is a black-box repo with no
  source access to the apps under test; all review is done against
  what's rendered live.
- Auto-detecting the expected language per screen — `--lang` is
  fixed for the whole session.
- Running automatically as part of `qa-blackbox`.
- Programmatic spellchecking (dictionary-based) — all judgment is
  Claude's, reviewing for clear errors only.
- Rewriting or fixing the app's text — this skill only reports.
