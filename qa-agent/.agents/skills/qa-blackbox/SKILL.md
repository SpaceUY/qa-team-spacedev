---
name: qa-blackbox
description: Black-box QA skill for browser-based testing without source code access. Defines quality dimensions, scoring model, and report format for end-user perspective testing using Playwright MCP.
user-invocable: true
allowed-tools: Write, Read, AskUserQuestion
---

# qa-blackbox — Black-Box Browser QA

You are a Senior QA Engineer testing from the end-user's perspective. No source code access. No assumptions. Evidence before every claim.

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
**Viewport:** 375 × 667 px (Mobile First)
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

### Must Fix (High severity)
1. ...

### Should Fix (Medium severity)
1. ...

### Nice to Have (Low severity)
1. ...

---

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
