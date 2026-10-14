---
name: qa-report-test-execution
description: Unified report generation for QA test execution. Takes raw test results and evidence from a QA test skill (regression, api, app, smoke) and writes qa-report.md files in the canonical evidence/{hostname}/{subpath}/{YYYY-MM-DD}/ structure, then hands off to qa-report-render for the HTML version. Internal skill, invoked by the QA test skills; users do not call it directly.
user-invocable: false
allowed-tools: Write, Edit, AskUserQuestion, Bash
---

# qa-report-test-execution — Generate Reports from Test Results

## Prerequisites, inputs, outputs

- **Prerequisites:** none beyond the calling skill having finished running tests. No browser, no network, no `.env`.
- **Invoked by:** `qa-regression`, `qa-smoke-test`, `qa-text-check`, `qa-app-regression`, `qa-api-regression`, and `qa-ad-hoc` when a session report is requested. Also used by the `qa-ui-tester` and `qa-api-tester` agents.
- **Inputs:** the arguments listed under *Inputs from Calling Skill* below.
- **Outputs:**
  - `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/qa-report.md` (the record)
  - `evidence/{hostname}/AUDIT-SUMMARY-{YYYY-MM-DD}.md` when more than one flow, test case or endpoint ran
  - `qa-report.html` beside the markdown, produced by `qa-report-render`
- **Exact invocation:** not user-typed. The calling skill runs `Invoke skill: qa-report-test-execution` with the arguments shown below.

This skill is **invoked by other QA test skills** and does not run tests itself. It keeps test execution and reporting strictly separated.

---

## When This Skill is Called

A test-execution skill has completed running tests and collected:
- Test results (PASS/FAIL per flow/test case)
- Evidence screenshots (with paths and timestamps)
- Bug findings (if any, with severity)
- Session metadata (URL, viewport, date, project language)

The test skill then invokes this skill with:

```
Invoke skill: qa-report-test-execution
With arguments: {
  test_type: "regression" | "api" | "app" | "smoke",
  hostname: "staging-api.example.com",
  subpath: "register",
  date: "2026-09-09",
  project_language: "Spanish" | "English" | "Bilingual",
  viewport_scope: "Desktop" | "Mobile" | "Both",
  results: [ ... test results array ... ],
  bugs_found: [ ... bug objects ... ],
  screenshots: [ { path, description }, ... ]
}
```

---

## Report Structure (Universal)

All reports, regardless of test type, follow the same canonical structure. Report text follows `{project_language}`; section headings may be bilingual when the language is Bilingual.

```markdown
# QA Report — {Test Scope}

**Date:** YYYY-MM-DD  
**URL:** {primary URL tested}  
**Viewports:** {375 × 667 px (Mobile) | 1440 × 900 px (Desktop) | both, as in viewport_scope}  
**Test Type:** Regression | API | App | Smoke  
**Quality Score:** XX/100 (if applicable — regression/app only)

---

## Executive Summary

**Status:** PASS | CONDITIONAL PASS | FAIL  
{1–3 sentence verdict.}

---

## Bug Register

| ID | Severity | Description | Evidence |
|----|----------|-------------|----------|
| BUG-001 | 🔴 High | ... | 01-*.png |
| BUG-002 | 🟡 Medium | ... | 02-*.png |

---

## Test Results

{Structured summary of test outcomes, format varies by test type}

---

## Recommended Actions

### Must Fix
- ...

### Nice to Have
- ...

---

## Evidence Files

| File | Description |
|------|-------------|
| 01-*.png | ... |
```

---

## Inputs from Calling Skill

### `test_type`
- `"regression"` → end-to-end flow tests
- `"api"` → API endpoint tests
- `"app"` → browser UI section tests
- `"smoke"` → smoke tests scoped to one feature

### `hostname`
Derived from the base URL using the CLAUDE.md naming rules (domain + port, `:` and `.` → `-`). Example: `staging-api.example.com` → `staging-api-example-com`.

### `subpath`
First path segment of the primary URL. Example: `/register` → `register`, `/` → `root`.

### `date`
Today's date in YYYY-MM-DD format. Used for the evidence folder and report.

### `project_language`
The value from CLAUDE.md Step 0.4 (Spanish, English or Bilingual). Governs the wording of the report.

### `viewport_scope`
The value from CLAUDE.md Step 0.5. Only the viewport(s) named here appear in the report.
- `"Desktop"` → 1440 × 900 px only
- `"Mobile"` → 375 × 667 px only
- `"Both"` → both viewports tested

### `results`
Array of test outcomes:

```javascript
[
  {
    name: "Flow: Registration → First Purchase",
    status: "PASS" | "FAIL" | "BLOCKED",
    started: "2026-09-09T14:30:00Z",
    duration_ms: 12345,
    error: "Optional error message if FAIL or BLOCKED"
  },
  ...
]
```

### `bugs_found`
Array of bug findings:

```javascript
[
  {
    id: "BUG-123",
    severity: "🔴 High" | "🟡 Medium" | "🟢 Low",
    description: "Button does not respond to clicks",
    evidence_file: "01-button-unresponsive.png",
    test_case: "Flow: Registration",
    environment: "staging"
  },
  ...
]
```

### `screenshots`
Array of evidence:

```javascript
[
  {
    path: "evidence/staging-api-example-com/register/2026-09-09/01-initial-load.png",
    description: "Initial registration page load",
    timestamp: "2026-09-09T14:30:05Z"
  },
  ...
]
```

---

## Step 1 — Prepare Evidence Folder

Create the folder structure if it doesn't exist:

```
evidence/
└── {hostname}/
    └── {subpath}/
        └── {YYYY-MM-DD}/
            ├── qa-report.md (this step writes it)
            ├── 01-*.png
            ├── 02-*.png
            └── ...
```

Use `Bash` with `mkdir -p` to create the full path.

---

## Step 2 — Generate Report Markdown

Build the report content following the Universal Structure above:

1. **Header:** Title, date, URL, viewports, test type
2. **Executive Summary:** Status (PASS/FAIL/CONDITIONAL PASS) + 1–3 sentence verdict
3. **Bug Register:** Table of bugs found (empty table if no bugs)
4. **Test Results:** Structured summary (format by test type — see below)
5. **Recommended Actions:** Must Fix + Nice to Have bullets
6. **Evidence Files:** Table of all screenshots

### Test Results Format by Type

#### Regression Tests
```
### Test Results

| Flow | Viewport | Status | Last Run |
|------|----------|--------|----------|
| Registration → First Purchase | Desktop | ✅ PASS | 2026-09-09 |
| Login with Invalid Email | Mobile | ❌ FAIL | — |
| [Flow Name] | Both | ⚠️ BLOCKED | — |
```

#### API Tests
```
### Test Results

| Endpoint | Method | Status Code | Status | Notes |
|----------|--------|-------------|--------|-------|
| POST /api/users | POST | 201 | ✅ PASS | User created |
| GET /api/users/:id | GET | 404 | ❌ FAIL | Expected 200 |
```

#### App Tests
```
### Test Results

| Section | Viewport | Status | Coverage |
|---------|----------|--------|----------|
| Dashboard | Desktop | ✅ PASS | All controls tested |
| Dashboard | Mobile | ⚠️ CONDITIONAL | Layout overflow detected |
```

#### Smoke Tests
```
### Test Results

**Feature:** {Feature Name from ClickUp Ticket}

| Component | Status | Notes |
|-----------|--------|-------|
| Login flow | ✅ PASS | 2 test cases passed |
| Checkout | ✅ PASS | Payment processing working |
```

---

## Step 3 — Write Report File

Use `Write` to create the report at:

```
evidence/{hostname}/{subpath}/{YYYY-MM-DD}/qa-report.md
```

**Important:** Never overwrite if the file exists — this allows multiple test runs on the same day to accumulate reports. Check first with `Bash`:

```bash
if [ -f "evidence/{hostname}/{subpath}/{YYYY-MM-DD}/qa-report.md" ]; then
  # File exists — append or merge, don't overwrite
  # (Depending on calling skill's intention — usually append to summary)
else
  # First report of the day — write fresh
fi
```

---

## Step 4 — Session Summary (If Multiple Flows/Tests)

If the calling skill ran multiple flows, test cases, or endpoints, also write a session-level summary:

```
evidence/{hostname}/AUDIT-SUMMARY-{YYYY-MM-DD}.md
```

(Same format as the Full Site Audit summary in CLAUDE.md, Phase 3.)

```markdown
# Test Summary — {hostname}

**Date:** YYYY-MM-DD  
**Test Type:** Regression | API | App  
**Overall Score:** XX/100 (if applicable)

| Test/Flow | Score | Status | Critical Bugs |
|-----------|-------|--------|---------------|
| Registration → Purchase | 95/100 | ✅ PASS | 0 |
| Login with Invalid Email | 60/100 | ❌ FAIL | 2 |
| [Test Name] | — | ⚠️ BLOCKED | — |

## Cross-Cutting Issues
{Issues affecting multiple tests}

## Priority Fix List
{Ranked by severity across all tests}
```

---

## Step 5 — Render HTML and Return Results to Calling Skill

Invoke `qa-report-render` on the written `qa-report.md` so that `qa-report.html` sits beside it. The markdown is the record; the HTML is the rendering of it.

Then provide a summary back to the calling skill:

```javascript
{
  success: true,
  report_path: "evidence/staging-api-example-com/register/2026-09-09/qa-report.md",
  html_path: "evidence/staging-api-example-com/register/2026-09-09/qa-report.html",
  summary_path: "evidence/staging-api-example-com/AUDIT-SUMMARY-2026-09-09.md",
  bugs_reported: 3,
  tests_passed: 45,
  tests_failed: 2
}
```

The calling skill can then use this to:
- Inform the user of report location
- Offer to run `/report-bugs-to-clickup <report_path>` next (the user decides; it is never automatic)
- Update test tracking metadata

---

## Rules & Constraints

- **No Test Execution:** This skill only generates reports, never runs tests
- **Never Modify Test Data:** Don't alter results, bugs, or screenshots — only format them
- **Canonical Structure:** All reports follow the same structure regardless of test type
- **Evidence Preservation:** All screenshot paths and descriptions must be preserved exactly
- **Quality Score:** Only for regression and app tests (if viewports cover both, average them); omit for API and smoke tests
- **No Secrets:** Never include API keys, passwords, tokens or credentials in reports, including values a response echoed back
- **No Duplicates:** If a report for this folder/date already exists, merge results (check before overwriting)
- **No raw runner output as the deliverable:** a Playwright HTML report may be linked as backup, never used in place of `qa-report.md`

---

**This skill is internal.** Users run the test skills (`/qa-regression`, `/qa-smoke-test`, `/qa-text-check`, and so on); those skills handle test execution and then call this skill for reporting.
