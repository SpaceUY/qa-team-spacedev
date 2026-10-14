---
name: qa-app-regression
description: >-
  The UI black-box protocol: 'audit this section', 'test the whole site', 'run a
  regression on the dashboard', 'exercise this form'. Applies Equivalence
  Partitioning, Boundary Value Analysis and Error Guessing to each section,
  multiplies them across organizations or tenants when the app has them, and
  covers the viewport scope chosen at session start. Browser only (Playwright
  MCP). The API counterpart is qa-api-regression.
user-invocable: false
allowed-tools: Read, Write
---

# QA UI regression protocol

## Prerequisites, inputs, outputs

- **Prerequisites:** Playwright MCP connected (`mcp__playwright__*`). Base URL asked at run time. Test credentials, if the section sits behind a login, read from `.env` as described in CLAUDE.md. `qa-platform-discovery` run first on a whole-site audit.
- **Inputs:** the section or flow to test, `{viewport_scope}` (Desktop / Mobile / Both, from CLAUDE.md Step 0.5), `{project_language}` (from Step 0.4).
- **Outputs:** one section result per section (scenarios with PASS / FAIL / BLOCKED, evidence screenshots), passed to `qa-report-test-execution`.
- **Invocation:** not user-typed. Run by the `qa-ui-tester` agent, and by the `qa-smoke-test` and `qa-regression` skills for the sections they cover.

The browser-side protocol. It assumes `qa-platform-discovery` has already established what exists.

## Three techniques, applied to every section

Do all three before moving on. Skipping one is how a section gets a score it did not earn.

**Equivalence Partitioning.** Divide each input into valid and invalid classes, and test one representative per class. The invalid classes are where the findings are.

**Boundary Value Analysis.** For numeric and length-limited inputs: minimum, maximum, minimum minus one, maximum plus one. For dates: today, the first and last day of a period, an invalid date, and one day before any declared minimum. For paginated lists: empty, single item, at the page limit, over the limit.

**Error Guessing.** Empty states, rapid repeated actions, session expiry mid-flow, special characters (`'`, `"`, `<script>alert(1)</script>`, `' OR 1=1 --`), letters and negatives in numeric fields, zero-byte and malformed uploads, degraded network.

## Per-section sequence

Navigate → initial screenshot → partitioning → boundaries → error guessing → accessibility check → save the section result.

## Organizations and tenants multiply the work (only if the app has them)

If `qa-platform-discovery` found an organization, tenant or workspace switcher, it is **a multiplier on the test matrix, not a cosmetic toggle.** For each one found live, starting with the base one:

1. Select it and confirm the UI updates: branding, data scope.
2. Walk every section that organization exposes.
3. Screenshot any anomaly at the moment of discovery.

Per switch, check: the UI updates, data is scoped to that organization, no other organization's data appears, every section stays reachable, forms submit under that configuration, and the dashboard reflects that organization only.

**Two caveats that prevent false isolation findings:**

- Some views are global by design (for example an administrator dashboard). Do not report cross-organization data there as a leak until the project's known non-bug quirks have been checked.
- With an administrator account, switching organization may change branding without changing data scope. If isolation cannot be tested from that account, **say so as a coverage gap** rather than concluding either way.

## The autocomplete-selection rule

Some controls only enable after a value is chosen from an autocomplete rather than typed. **Before reporting a disabled control or an empty result, attempt the selection correctly**: type at least two characters, wait for the suggestion list, click a suggestion.

Enables afterwards → expected; record `requires autocomplete selection to test`. Stays disabled → a real defect, now with evidence. No data to select at all → `BLOCKED`, not a bug.

## Viewports: follow the session's scope

Test at the viewport(s) named by `{viewport_scope}`, and no others:

- **Desktop** → 1440 × 900 only
- **Mobile** → 375 × 667 only
- **Both** → both, screenshot each, and report responsiveness issues per viewport

Never assume "Both" when the scope was not chosen. The scope question is asked at session start (CLAUDE.md Step 0.5).

## Section-specific error guessing

A starting point, not an exhaustive list. Add to it from the project's `context/navigation-map.md` when the team has recorded section-specific hazards.

| Control type | Try |
|---|---|
| Forms | Every optional field empty; a duplicate of an existing record; special characters; abandon mid-flow and resume |
| File uploads | A zero-byte file; a file of the wrong type; an oversized file |
| Date fields | A date in the past; an end date before a start date; a date at the declared minimum minus one day |
| Numeric fields | A negative value; zero; a value with letters; a value at the maximum |
| Search | An empty query; a very long query; characters that need escaping |
| Lists and tables | Empty dataset; one item; pagination at the limit; filters that hide everything |
| Free-text or chat inputs | An empty message; a very long paste; an injected script |
| Bulk or destructive actions | Inspect the scope and the button state; check what they would reach |

## Actions you do not take

- **Never press a bulk execute control** whose effect reaches outside the system (email, certificates, external recipients). Report its state by inspection.
- **Never approve or deny third-party records.** Denial may be irreversible.
- **Never complete a purchase or payment** unless explicitly asked. **A missing confirmation step is not evidence that a flow is a dry run.** Stop before any final Confirm, Pay, Add or Search when reversibility is unclear.
- **Never create, modify or delete production data.** Read-only exploration of production is fine when the user has explicitly targeted it.

## Related

- `.claude/skills/qa-blackbox/`: dimensions, scoring, severity and report format.
- `.claude/skills/qa-platform-discovery/`: what exists before any section is tested.
- `.claude/skills/qa-evidence-discipline/`: PASS / FAIL / BLOCKED and what a claim requires.
- `.claude/skills/qa-report-test-execution/`: writes the markdown report from this section's results.
