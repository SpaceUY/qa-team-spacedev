---
name: qa-blackbox
description: Black-box QA skill for browser-based testing without source code access. Defines quality dimensions, scoring model, and report format for end-user perspective testing using Playwright MCP.
user-invocable: true
allowed-tools: Write, Read, AskUserQuestion, Bash
---

# qa-blackbox — Black-Box Browser QA

You are a Senior QA Engineer testing from the end-user's perspective. No source code access. No assumptions. Evidence before every claim.

---

## Viewport Scope

This skill never decides its own viewport scope — `CLAUDE.md`'s Step
0.5 always asks the user (Desktop only / Mobile only / Both) before
this skill is invoked, and passes the answer in as `{viewport_scope}`
via this invocation's `args`. If this skill is somehow invoked without
a `{viewport_scope}` in `args` (e.g. a direct manual invocation outside
the normal CLAUDE.md flow), ask the same question yourself via
`AskUserQuestion` before proceeding — never default silently to
"Both" or to any single viewport.

Every "Dual Viewport" / "375×667 and 1440×900" instruction below
means: run it for whichever viewport(s) `{viewport_scope}` names.
Scenario S11 (Mobile layout) only runs if scope includes Mobile;
S12 (Desktop layout) only runs if scope includes Desktop. The report's
`**Viewport(s):**` line and every screenshot set reflect only the
in-scope viewport(s) — never claim coverage of a viewport that wasn't
actually tested.

---

## Reading Project Context

Before running any scenario, read two sources (relative to the repo
root — use `AskUserQuestion` or state the assumption explicitly if
you're unsure of the repo root from your current working directory):

**`.env`** — read it via `Bash` (e.g. `set -a && source .env && set +a`,
then reference `$BASE_URL`, `$TEST_USER_EMAIL`, `$TEST_USER_PASSWORD`),
never by opening it with `Read` and never by printing its contents into
the conversation or into any report. Sourcing is shell evaluation, not
plain-text parsing — it requires every `.env` value to be single-quoted
(`.env.example` already shows this); an unquoted value with a space is
silently truncated, and one with `$`, backticks, `;`, or `&` executes as
a command instead of being read as a literal credential. If `.env`
doesn't exist, or `BASE_URL` comes out empty, tell the user to copy
`.env.example` to `.env` and fill it in (or run `/qa-project-setup`, which reminds them to
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

---

## Error Guessing Heuristics

Alongside the standard scenario checklist (S1-S12, below), apply
experience-based error guessing: bugs cluster around a known set of
situations more than random chance would predict. Check each of these
against every input, form, and interactive element you encounter,
in addition to (never instead of) running the standard scenarios:

- **Boundary values** — the smallest/largest accepted value, one below
  the minimum, one above the maximum (e.g. a quantity field: 0, -1,
  the max allowed, max+1).
- **Empty and null inputs** — submitting a required field empty, or a
  field that accepts an empty string where a null/undefined might slip
  through instead.
- **Special characters and encoding** — unicode, emoji, SQL-metacharacters
  (`'`, `--`, `;`), HTML/script tags in free-text fields (to check for
  unescaped rendering, not to attempt exploitation — this is black-box
  functional QA, not a penetration test).
- **Double submission** — clicking a submit/pay/confirm button twice in
  quick succession, or submitting a form and immediately navigating back
  and re-submitting.
- **Unexpected navigation** — using the browser back button mid-flow
  (e.g. mid-checkout), refreshing on a confirmation page, or opening a
  flow in two tabs at once.
- **Long input** — a string far longer than the field visually
  accommodates, to check for truncation, overflow, or layout breakage
  rather than a graceful limit.
- **Concurrent/rapid interaction** — rapidly toggling a control, or
  triggering an action before a prior async operation (e.g. a save)
  has finished.
- **Wrong-type input where the UI allows it** — pasting text into a
  numeric-looking field, or a date picker's text fallback with an
  invalid date.

Report anything these heuristics surface using the same Bug Register
format and severity classification as everything else in this skill —
this is a checklist for *where to look*, not a separate report section.

---

## Quality Dimensions & Scoring

Each session scores 0–100 using six weighted dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Functional Correctness | 30% | Features work as expected end-to-end |
| Validation & Error Handling | 20% | Forms, edge cases, error messages |
| Navigation & UX | 15% | Flows complete, no dead ends, back nav works |
| Visual & Design Quality | 15% | Consistency, hierarchy, contrast, layout |
| Accessibility | 10% | Labels, headings, ARIA roles, keyboard |
| Console Health | 10% | No JS errors, no failed network requests |

### Scoring per dimension (0–100)

- **100** — No issues found
- **80** — Minor issues, no user impact
- **60** — Issues that degrade experience but don't block
- **40** — Issues that block a secondary flow
- **0** — Critical blocker: core flow unusable or data loss

### Overall thresholds

| Score | Status |
|-------|--------|
| 85–100 | **PASS** |
| 60–84 | **CONDITIONAL PASS** — ship with known issues |
| 0–59 | **FAIL** — do not ship |

---

## Severity Classification

| Level | Icon | Criteria |
|-------|------|----------|
| High | 🔴 | Blocks a core user flow, data loss, security concern |
| Medium | 🟡 | Degrades UX, confusing behavior, missing feedback |
| Low | 🟢 | Polish, accessibility, cosmetic |

---

## Report Format

Write to `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/qa-report.md`:

```markdown
# QA Report — {Tested flow}

**Date:** YYYY-MM-DD
**URL:** {full URL}
**Viewport(s):** {whichever of 375 × 667 px (Mobile) / 1440 × 900 px (Desktop) `{viewport_scope}` covers}
**Quality Score:** XX/100

---

## Executive Summary

**Status:** PASS | CONDITIONAL PASS | FAIL
{1–3 sentence verdict. State what works, what doesn't, and the highest-risk finding.}

---

## Quality Score Breakdown

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Functional Correctness | 30% | XX | PASS/FAIL |
| Validation & Error Handling | 20% | XX | PASS/FAIL |
| Navigation & UX | 15% | XX | PASS/FAIL |
| Visual & Design Quality | 15% | XX | PASS/FAIL |
| Accessibility | 10% | XX | PASS/FAIL |
| Console Health | 10% | XX | PASS/FAIL |
| **Overall** | **100%** | **XX** | **STATUS** |

---

## Bug Register

| ID | Severity | Description | Evidence |
|----|----------|-------------|----------|
| BUG-001 | 🔴 High | ... | screenshot.png |
| BUG-002 | 🟡 Medium | ... | screenshot.png |
| BUG-003 | 🟢 Low | ... | — |

---

## Scenario Results

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| S1 | ... | ✅ PASS / ❌ FAIL / ⚠️ PARTIAL / N/A | ... |

---

## Accessibility Audit

| Check | Result | Detail |
|-------|--------|--------|
| Interactive elements labeled | ✅/❌ | ... |
| Images have alt text | ✅/❌ | ... |
| Heading hierarchy | ✅/❌ | ... |
| ARIA roles on custom components | ✅/❌ | ... |
| Landmark regions (main, nav) | ✅/❌ | ... |
| Error messages announced | ✅/❌ | ... |

---

## Console Health

| Type | Count | Detail |
|------|-------|--------|
| JS Errors | X | ... |
| Network Errors | X | ... |
| Warnings | X | ... |

---

## Visual & UX Observations

{Free-form notes on design quality, consistency, UX patterns observed.}

---

## Recommended Actions

Write each item under every subsection below as a `-` bullet, never a
numbered list, with no blank markdown divider (`---`) between the
bullets and the next heading. `report-improvements-to-clickup`'s
parser reads the "Nice to Have" subsection's items by scanning lines
that start with `-` until the next heading of any level: a numbered
list never matches, so it's silently skipped (zero items found), and a
stray `---` divider line matches too (it also starts with `-`) and gets
misread as a bogus bullet. If nothing qualifies for a subsection, still
write it with a single bullet stating that, e.g. `- None for this run.`
— never leave a subsection with zero bullet items, since the parser
requires at least one.

### Must Fix (High severity)
- ...

### Should Fix (Medium severity)
- ...

### Nice to Have (Low severity)
- ...

## Evidence Files

| File | Description |
|------|-------------|
| 01-*.png | ... |
```

---

## Accessibility Checks (S10)

Run via `browser_evaluate` at the end of each session:

```javascript
() => {
  const issues = [];
  // Unlabeled interactive elements
  document.querySelectorAll('input, button, select, textarea').forEach(el => {
    const label = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent?.trim();
    if (!label) issues.push(`Unlabeled: <${el.tagName.toLowerCase()}> class="${el.className.substring(0,40)}"`);
  });
  // Images missing alt
  document.querySelectorAll('img').forEach(img => {
    if (!img.getAttribute('alt') && img.getAttribute('role') !== 'presentation')
      issues.push(`Image missing alt: ${img.src.substring(0,60)}`);
  });
  // Tab role check
  const tabs = document.querySelectorAll('[role="tab"]');
  if (tabs.length === 0 && document.querySelector('[role="tablist"]') === null) {
    const tabLike = document.querySelectorAll('[aria-selected]');
    if (tabLike.length === 0) issues.push('Possible tab pattern with no role="tab" — verify manually');
  }
  // Heading hierarchy
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .map(h => ({ level: parseInt(h.tagName[1]), text: h.textContent.trim().substring(0,50) }));
  const hasH1 = headings.some(h => h.level === 1);
  if (!hasH1) issues.push('No <h1> found on page');
  return { issues, headings };
}
```

---

## Scoring Calculation Example

```
Functional (30%):  score=80  → 80 × 0.30 = 24.0
Validation (20%):  score=100 → 100 × 0.20 = 20.0
Navigation (15%):  score=100 → 100 × 0.15 = 15.0
Visual (15%):      score=60  → 60 × 0.15 = 9.0
A11y (10%):        score=40  → 40 × 0.10 = 4.0
Console (10%):     score=40  → 40 × 0.10 = 4.0
                              ──────────────────
Overall:                                   76/100 → CONDITIONAL PASS
```

---

## Rules

- Every bug gets a screenshot at the moment of discovery — no after-the-fact captures
- Diagnose with `browser_snapshot` before reporting a selector failure as a real bug
- False positives must be documented as "FP corrected" in the report
- Console errors must be classified: are they app errors or third-party (e.g. TradingView)?
- Do not report a PASS on any scenario without a screenshot or snapshot as evidence
