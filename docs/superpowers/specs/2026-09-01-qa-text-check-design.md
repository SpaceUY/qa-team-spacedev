# Design: `qa-text-check` skill

**Date:** 2026-09-01
**Author:** Julia Disarli (julia.disarli@otonomi.ai)
**Status:** Approved

## Purpose

Detect typos and other text-quality bugs (spelling, grammar/agreement,
mixed-language text, punctuation/capitalization) on live app screens,
in Spanish or English, by browsing the app the same way `qa-blackbox`
does and having Claude review each visible string. Produces a
`text-qa-report.md` whose Bug Register uses the exact same 4-column
format and title convention as a `qa-blackbox` `qa-report.md`, so
`report-bugs-to-clickup` can parse it with zero changes.

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

It is **not** wired into `qa-blackbox`'s automatic flow, even though
both skills live in the same `qa-agent` module (see Location below).
Rationale: editorial control over which screens get a text pass, and
reusability — this skill can run standalone against any app/flow
without a prior `qa-blackbox` session.

## Location

`qa-team/qa-agent/.agents/skills/qa-text-check/SKILL.md` — alongside
`qa-blackbox`, `frontend-design`, and `verification-before-completion`.
It belongs to the `qa-agent` module (Playwright MCP, no ClickUp), not
to the root `.claude/skills/` directory: `report-bugs-to-clickup` and
`report-improvements-to-clickup` live there instead because they never
touch a browser — they only parse an already-generated `qa-report.md`
and talk to the ClickUp MCP. `qa-text-check` navigates the live app,
so it belongs with `qa-blackbox`, not with them.

It is **not** a subagent. Like `qa-blackbox`, it's a skill that runs
in `qa-agent`'s main session, invoked manually with `/qa-text-check`
— no isolated context or parallel execution is needed, since it's one
more sequential pass over the same screens a `qa-blackbox` session
would visit.

This also means two follow-up doc updates in `qa-agent`, done as part
of implementing this skill (not optional polish):

- `qa-agent/README.md` — add `qa-text-check` to the "What Each Piece
  Does" table and to the list of skills expected in the session-start
  banner.
- `qa-agent/CLAUDE.md` — list `qa-text-check` as an available skill,
  explicitly marked as **not** auto-activated (unlike `qa-blackbox`,
  which triggers automatically on a URL+flow message) — it only runs
  when the user explicitly invokes `/qa-text-check`, so the existing
  automatic trigger is unaffected.

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
   `browser_take_screenshot`, saved into the same dated evidence
   folder (`evidence/{hostname}/{subpath}/{YYYY-MM-DD}/`) that the
   report (§6) is written into, using the same `NN-{screen-name}.png`
   numbering convention already established for `qa-blackbox`
   evidence (see `qa-agent/CLAUDE.md` § "📁 Evidence Structure", e.g.
   `01-initial-load.png`) — so the report's `Evidence` column always
   names a file that exists in that folder. This holds whether the
   run is inline or backgrounded.
4. Discard strings that are pure data (numbers, dates, user-generated
   content, IDs) — the skill reviews UI copy, not arbitrary content
   rendered from the backend.

**Execution mode for large scopes:** a full browser (Playwright MCP)
is required — a plain HTTP fetch of the HTML cannot see text rendered
client-side by a JS framework, which is most of the UI copy in a
modern SPA. To keep this fast without blocking the user's session,
when the resolved scope (`--pages` or the user's answer) covers more
than **5 screens**, the skill runs the *entire pipeline* — extraction
(this section), review, severity classification, and report-writing
(§6) — as a single background task, and reports back to the user only
once the finished `text-qa-report.md` exists at its final path. For 5
or fewer screens, that same pipeline runs inline as normal. This does
not change any other part of the flow — extraction, review, and
report format are identical either way; only whether the whole
pipeline runs in the foreground or as one backgrounded unit changes.

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

The Bug Register table uses `qa-blackbox`'s exact 4-column format
(`ID | Severity | Description | Evidence`), and the title line uses
`qa-blackbox`'s exact title format (`# QA Report — {Tested flow}`,
matching `report-bugs-to-clickup`'s required header regex) — so
`report-bugs-to-clickup` can parse this report's Bug Register without
any changes. The folding of issue type, original text, and suggested
text into the `Description` cell happens at report-writing time, as
part of this skill's own report step, not as a downstream
transformation: `Description` is written as `{Issue type}: "{Original
text}" → "{Suggested text}"` (or just `{Issue type}: "{Original
text}"` when there's no single correct replacement, e.g. a leaked
i18n key). The `**Language checked:**` line stays in the report body
for a human reader; `report-bugs-to-clickup`'s parser does not read
it.

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
