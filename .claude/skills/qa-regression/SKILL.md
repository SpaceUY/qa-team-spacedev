---
name: qa-regression
description: Executes every flow documented in context/regression-flows.md end-to-end, and updates each flow's last-successful-run date. Invoke manually to run a full regression pass.
user-invocable: true
allowed-tools: Read, Write, Edit, AskUserQuestion
---

# qa-regression — Core Flow Regression Testing

You execute every flow documented in `context/regression-flows.md`,
end-to-end, using each flow's own steps and test data. This is manual,
on-demand: only run it when the user explicitly invokes `/qa-regression`.

## Step 0 — Pre-flight: verify Playwright MCP

Same check as `qa-blackbox`, `qa-text-check`, and `qa-smoke-test`:
confirm `mcp__playwright__browser_navigate` is available before doing
anything else. If not, stop immediately with the same halted-session
message pattern as the other skills' Step 0 ("**Regression run halted —
Playwright MCP is not connected.**").

## Step 0.5 — Scope Selection: Desktop, Mobile, or Both

Ask the user via `AskUserQuestion`, before reading any context or
touching the browser:

> "What's the scope for this regression run?"
> 1. **Desktop only** (1440×900)
> 2. **Mobile only** (375×667)
> 3. **Both** (Desktop + Mobile) — recommended default

Ask this **once for the whole run** — every flow selected in Step 2
uses the same `{viewport_scope}`, not a per-flow choice. Never assume
"Both" and skip the question. Carry `{viewport_scope}` into Step 3
(evidence screenshots and checks happen only at the in-scope
viewport(s)) and into each flow's report in Step 5 (state the actual
viewport(s) tested, never claim coverage of one that wasn't).

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

Read `context/regression-flows.md`. If it has no `## Flow:` entries yet
(just the empty-state placeholder), tell the user to run
`/qa-project-setup` first to add core flows, and stop — there is nothing
to regress against.

If it has flows, list them to the user before starting (name and last
successful run date for each), and ask whether to run all of them or a
subset (`AskUserQuestion`, multi-select from the flow names found).

## Step 3 — Execute each selected flow

For each flow, in order:

1. Follow its `**Steps:**` exactly, using its `**Test data:**` values.
   Take an evidence screenshot at the happy-path completion of the flow,
   and at the moment any step fails, following the same
   `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/` convention as the other
   skills (`CLAUDE.md` § "📁 Evidence Structure"). Derive `{subpath}` and
   `{hostname}` the same way `qa-blackbox`/`qa-smoke-test` do — from a
   URL, not the flow's display name: find the first route or URL named
   in the flow's own `**Steps:**` (the page the flow starts on — if the
   flow spans multiple pages, use the first one its steps visit, since
   that's how the flow "starts"), then apply `CLAUDE.md`'s naming rules
   to it exactly (`{subpath}` = that URL's first path segment, no `/`,
   e.g. `/register` → `register`, or `root` if it's `/`; `{hostname}` =
   that URL's domain + port with `:`/`.` → `-`). Never slugify the
   flow's name — a flow called "Registration → First Purchase" is not a
   valid `{subpath}`/`{hostname}` source, only its steps' actual route
   is.
2. If a step fails, record it as a bug (same severity vocabulary as
   `qa-blackbox`: 🔴 High / 🟡 Medium / 🟢 Low) and continue to the next
   flow — one flow's failure does not abort the rest of the regression
   run.
3. If a step's test data looks stale or invalid in a way that looks like
   a data problem rather than an app bug (e.g. a test card number that's
   now expired), flag this distinctly from a real bug — note it as
   "test data may need updating" in the final report, not as a product
   defect.

## Step 4 — Update last-run history

For every flow that was run (whether it passed or failed), use `Edit` to
update that flow's `**Last successful run:**` line in
`context/regression-flows.md`:

- If the flow passed end-to-end: set it to today's date.
- If the flow failed at any step: leave the previous
  `**Last successful run:**` value unchanged (a failed run is not a
  successful run) — but mention the failure and today's date in the
  final report to the user instead.

Only edit the specific flow entries that were actually run in this
session — never touch a flow's entry that wasn't part of this run's
selection.

## Step 5 — Write reports

A regression run covers multiple flows in one session, so follow the
same "one session, multiple things tested, one summary" pattern
`qa-blackbox`'s Full Site Audit protocol uses for multiple paths
(`CLAUDE.md` § "🌐 Full Site Audit Protocol", Phase 2/Phase 3): write
one `qa-report.md` per flow, plus one session-level summary.

For each flow that was run, write
`evidence/{hostname}/{subpath}/{YYYY-MM-DD}/qa-report.md` — using the
same `{hostname}`/`{subpath}` derivation as Step 3 (from the flow's
first-visited route, per `CLAUDE.md`'s naming rules, never the flow's
display name slugified) — the same folder Step 3's screenshots were
saved into — in the same 4-column Bug Register format as `qa-blackbox`
(`ID | Severity | Description | Evidence`), so `report-bugs-to-clickup`
can parse each one without any changes:

```markdown
# QA Report — {Flow name}

**Date:** YYYY-MM-DD
**URL:** {flow's URL, from its first Steps entry that names one}
**Viewport(s):** {whichever of 375 × 667 px (Mobile) / 1440 × 900 px (Desktop) `{viewport_scope}` covers}

---

## Executive Summary

**Status:** PASS | FAIL
{1–3 sentence verdict for this flow.}

---

## Bug Register

| ID | Severity | Description | Evidence |
|----|----------|-------------|----------|
| BUG-001 | 🔴 High | ... | 01-*.png |

---

## Recommended Actions

### Must Fix
- ...

### Nice to Have
- ...

## Evidence Files

| File | Description |
|------|-------------|
| 01-*.png | ... |
```

The title line must read exactly `# QA Report — {Tested flow}` (em
dash). If a flow found no bugs, still write its report: an empty Bug
Register table (header row only) plus an explicit sentence such as "No
issues found for this flow." — never skip writing a flow's report
because there was nothing to find.

Always include the `## Recommended Actions` section with its
`### Must Fix` and `### Nice to Have` subsections, matching
`qa-blackbox`'s report template's heading structure. Write each item
under both subsections as a `-` bullet (not a numbered list) with no
blank markdown divider (`---`) directly between the bullets and the
next heading — `/report-improvements-to-clickup`'s parser reads
`### Nice to Have`'s bullets by scanning lines that start with `-` until
the next heading, and a stray `---` divider line also starts with `-`
and would be misread as a bogus bullet. If a flow surfaced nothing
worth suggesting as a low-priority improvement, still write
`### Nice to Have` with a single bullet stating that, e.g.
`- None for this run.` — never leave it with zero bullet items, since
the parser requires at least one.

After every run flow has its own report, write a session-level summary
at the hostname root — using the same `{hostname}` derivation as Step 3
(from the first run flow's URL, per `CLAUDE.md`'s naming rules, since a
regression session as a whole has no single URL of its own) — following
the same `AUDIT-SUMMARY-{YYYY-MM-DD}.md` format `qa-blackbox`'s Full
Site Audit uses: `evidence/{hostname}/AUDIT-SUMMARY-{YYYY-MM-DD}.md`,
listing each run flow with its status (PASS/FAIL, matching each flow's own `qa-report.md`
— `qa-regression` doesn't compute a numeric quality score, only
`qa-blackbox` does) and critical bug count, any cross-cutting issues
observed across flows, and a priority fix list ranked by severity
across all flows. If the summary file for today already
exists (e.g. a Full Site Audit already ran today), add this run's
flows to it rather than overwriting.

## Step 6 — Final report

Summarize per flow: PASS/FAIL, any bugs found (with evidence), and any
"test data may need updating" flags. Call out any flow whose last
successful run (before this session) was more than 30 days ago, so a
long-neglected flow is visible even if this run didn't cover it. Point
the user to the report file(s) and summary written in Step 5.

## Constraints

- Never skip a flow's documented steps or improvise a shortcut through
  it — the flow's whole value is that it's the same steps every time.
- Never mark a flow's last-successful-run date as updated unless it
  actually passed end-to-end in this session.
- Never modify a flow's `**Steps:**` or `**Test data:**` content — that's
  `qa-project-setup`'s and `qa-smoke-test`'s job, not this skill's. This
  skill only reads steps/test-data and writes the last-run date.
- Never fabricate a bug not actually observed during a flow's
  execution — each flow's report (Step 5) reflects only what was
  actually checked.
- Never skip writing a flow's report (Step 5), even if the flow passed
  with no bugs found.

---

## Generating HTML Reports (Optional)

This skill writes markdown reports (`qa-report.md` per flow and `AUDIT-SUMMARY-*.md`). For formatted HTML versions, run the `qa-report-test-execution` skill on each report:

```bash
# Single report
/qa-report-test-execution evidence/{hostname}/{flow}/{YYYY-MM-DD}/qa-report.md

# All reports for a host
for report in evidence/{hostname}/*/*/qa-report.md; do
  /qa-report-test-execution "$report"
done
```

The HTML is written next to each markdown report and works offline. Rendering is separate from testing, so you can regenerate HTML without re-running the tests. See `.claude/skills/qa-report-test-execution/README.md`.
