# Report Improvements to ClickUp + Sprint-Association Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Fix `report-bugs-to-clickup` so tickets are created in a fixed project List and separately associated to the active sprint via ClickUp's multi-list mechanism, instead of being created directly inside the sprint List. (2) Build a sibling skill, `report-improvements-to-clickup`, that turns a `qa-report.md`'s "Nice to Have" bullets into ClickUp Improvement tickets, following the same manual/confirm-before-write pattern.

**Architecture:** Same two-layer split as the bugs skill: a pure-logic, unit-tested `.mjs` module per skill (parsing, inference, ticket-building) plus a `SKILL.md` that orchestrates the module's CLI output and ClickUp MCP tool calls. The improvements module is a **separate, self-contained file** — it duplicates the small stable functions it shares with the bugs module (header parsing, platform/environment/page inference) rather than importing from it, so each skill stays independently invocable and testable per the original design's isolation principle.

**Tech Stack:** Node.js (`node --test`, no new dependencies), Claude Code skill frontmatter, ClickUp MCP tools — adds `mcp__claude_ai_ClickUp__clickup_add_task_to_list` to both skills' `allowed-tools`.

## Global Constraints

- Both skills are manual/on-demand only: `/report-bugs-to-clickup <path>` and `/report-improvements-to-clickup <path>`. No auto-triggering from `qa-agent`.
- Ticket destination model (corrected): every ticket is created in a **fixed project List** the user names (e.g. "Otonomi Bugs" / "Otonomi Improvements") via `clickup_create_task`'s `list_id`. Separately, the active Sprint List (found by date range, same `findActiveSprint` logic as before) is associated to the created ticket via `clickup_add_task_to_list` — this is additive, not a "move." A failure to associate the sprint does not fail or roll back the ticket.
- Improvement title format: `[Improvement] {Platform} | {Environment} | {Page} | {Short description}` — same 4-part shape as bugs, `[Improvement]` tag instead of `[BUG]`.
- Improvement description is a fixed template:
  ```
  In Scope:
  {bullet text verbatim}

  Additional information:
  Reported by: {QA display name}
  Priority: {value from confirmation table}
  Severity: {value from confirmation table}
  ```
  `In Scope` must never be fabricated or reworded — it is the "Nice to Have" bullet's own text, unchanged.
- Improvement source: bullets under `### Nice to Have` inside the report's `## Recommended Actions` section. `### Must Fix` bullets are out of scope for this skill.
- Priority and Severity for improvements default to `Low` and are shown as editable columns in the Step-confirmation table before any ClickUp write — never silently invented beyond that shown default.
- Improvement evidence: attach the report's shared happy-path screenshot (the lowest-numbered screenshot file in the report's own evidence folder) to every improvement ticket from that report — not a per-bullet Evidence column (none exists).
- Both skills must show a confirmation table and wait for explicit user approval before any ClickUp write call.
- Individual ticket failures (create/attach/sprint-association) must not abort the batch; failures are surfaced in the final summary.
- If ClickUp MCP tools are unavailable, stop immediately with a clear message (same pattern as `qa-agent`'s Playwright MCP pre-flight check).

---

## File Structure

```
qa-team/
└── .claude/
    └── skills/
        ├── report-bugs-to-clickup/
        │   ├── SKILL.md                     # MODIFIED: fixed List + sprint association
        │   ├── parse-report.mjs             # MODIFIED: buildTickets no longer treats sprint as destination
        │   └── parse-report.test.mjs        # MODIFIED: tests updated for the above
        └── report-improvements-to-clickup/  # NEW
            ├── SKILL.md
            ├── parse-improvements.mjs
            └── parse-improvements.test.mjs
```

---

### Task 1: Fix `report-bugs-to-clickup`'s destination-List / sprint-association model

**Files:**
- Modify: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`
- Modify: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
- Modify: `qa-team/.claude/skills/report-bugs-to-clickup/SKILL.md`

**Interfaces:**
- Consumes: existing `parseBugRegister`, `parseReportHeader`, `inferPlatform`, `inferEnvironment`, `inferPage`, `buildTicketTitle`, `buildTicketDescription`, `findActiveSprint` (all unchanged).
- Produces: `buildTickets(...)` now returns `{ tickets, sprintListId, sprintListName, warnings }` where `sprintListId`/`sprintListName` describe the **active sprint** (for association, not creation) — this was already the shape; the actual behavior change is entirely in `SKILL.md`, which currently uses `result.sprintListId` as `clickup_create_task`'s `list_id`. This task changes SKILL.md to use a separately-asked "fixed destination List" as `list_id`, and use `result.sprintListId` only for the new `clickup_add_task_to_list` call.

Note: `parse-report.mjs`'s `buildTickets` function itself does **not** need a signature change — it already separates "sprint info" from "ticket content" in its return shape. The bug was entirely in how `SKILL.md` consumed that shape (treating `sprintListId` as the creation target). This task is therefore SKILL.md-only for the behavioral fix, plus one test-file update to correct a stale comment/expectation if any exists (see Step 1).

- [ ] **Step 1: Verify no code fix is needed in `parse-report.mjs`, then update the two-column table test if needed**

Run the existing suite first to confirm the starting state:

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-bugs-to-clickup/parse-report.test.mjs
```

Expected: 24 passing (current state before this task).

Read `.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`'s test named `'buildTickets combines parsing, inference, and building end-to-end'`. Confirm it asserts `sprintListId: '9'` and `sprintListName: 'Sprint 14'` as top-level fields on the `buildTickets` return value (this is describing the *active sprint*, which remains correct — no change needed here, since `buildTickets` was never wrong; only `SKILL.md`'s interpretation of it was). No code or test change is required in this step — it exists to make the "no change needed" determination explicit and verified, not assumed.

- [ ] **Step 2: Rewrite SKILL.md's Step 1 to ask for both the fixed destination List and the Sprints Folder**

Read the current `qa-team/.claude/skills/report-bugs-to-clickup/SKILL.md` Step 1 (lines 16-20). Replace it with:

```markdown
## Step 1 — Ask which destination List and Sprints Folder to use

Ask the user two things:

1. **The project's fixed Bugs List** — every ticket created by this skill goes into this one List (e.g. "Otonomi Bugs"), regardless of the current sprint. Use `mcp__claude_ai_ClickUp__clickup_get_list` with the name the user gives you to resolve its ID; if ambiguous, use `mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy` to show the Space/Folder/List tree and let them pick. This becomes `destinationListId`.
2. **The project's Sprints Folder** (e.g. "Otonomi > Sprints") — separate from the fixed List above. Call `mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy` with `max_depth: "2"` to list Spaces → Folders → Lists, and locate the Folder the user named. Collect every List inside it as `{id, name, startDate, endDate}` — ClickUp lists expose `start_date`/`due_date` (or the Folder's Sprint configuration) as millisecond timestamps; convert each to `YYYY-MM-DD` before using them.

If the user isn't sure which Folder or List, show them the Space/Folder/List names returned by the hierarchy call and let them pick.
```

- [ ] **Step 3: Update SKILL.md's Step 4 confirmation table to show both the fixed List and the Sprint**

Read the current Step 4 (lines 42-63). Replace the table description:

```markdown
Show the user a table, one row per ticket in `result.tickets`:

| Title | Severity | Destination List | Sprint | Tag | Assignee |
|---|---|---|---|---|---|

- Destination List: `destinationListId`'s name (the fixed Bugs List from Step 1), same for every row.
- Sprint: `result.sprintListName` (the active sprint this ticket will additionally be associated with), same for every row.
- Tag: the ticket's `environment` field, lowercased (`staging`, `production`, `dev`).
- Assignee: the display name from Step 2.
```

(Keep the rest of Step 4 — the warnings block above the table, and the confirmation-gate language — unchanged.)

- [ ] **Step 4: Update SKILL.md's Step 5 to create in the fixed List, then associate to the sprint**

Read the current Step 5 (lines 65-85). Replace the `clickup_create_task` bullet list and add a new sub-step immediately after it, before the existing "Attach the evidence screenshot" sub-step:

```markdown
## Step 5 — Create the tickets

For each confirmed ticket, call `mcp__claude_ai_ClickUp__clickup_create_task`:

- `name`: the ticket's `title`
- `list_id`: `destinationListId` (the fixed Bugs List from Step 1 — **not** `result.sprintListId`)
- `markdown_description`: the ticket's `description`
- `assignees`: `[<user ID from Step 2>]`
- `tags`: `[<environment tag, lowercased>]`

If a `clickup_create_task` call fails (e.g. the tag doesn't exist yet in the Space), record the failure with the ticket's title and continue to the next ticket — do not stop the batch.

### Associate the ticket to the active sprint

After a ticket is created successfully, call `mcp__claude_ai_ClickUp__clickup_add_task_to_list` with the created task's ID and `result.sprintListId` (from Step 3's parser output). This adds the ticket to the active Sprint List in addition to its home List — it does not move or remove it from the fixed Bugs List.

This call requires the "Tasks in Multiple Lists" ClickApp to be enabled on the workspace. If the call fails for any reason, do **not** fail or roll back the ticket — it already exists correctly in the fixed Bugs List. Record the outcome ("associated with sprint" / "sprint association failed: <reason>") against this ticket's record so Step 6 can report it.

### Attach the evidence screenshot, if present
```

(The existing "Attach the evidence screenshot, if present" content that follows stays exactly as-is — this step only inserts the new sub-step before it.)

- [ ] **Step 5: Update SKILL.md's Step 6 final summary to include the sprint-association outcome**

Read the current Step 6 (line 89). Replace it with:

```markdown
## Step 6 — Final summary

Print a table to the user: for every ticket, either the created ClickUp task URL (returned by `clickup_create_task`) or the failure reason, plus the evidence-attachment outcome (attached / no evidence file found / upload failed / not applicable), plus the sprint-association outcome (associated / association failed / not applicable). Never claim success for a ticket that failed, and never claim a screenshot was attached or a sprint was associated when it wasn't.
```

- [ ] **Step 6: Re-read the full SKILL.md end-to-end for internal consistency**

There is no automated test for SKILL.md. Verify by reading the complete file top to bottom and confirming: Step numbering is coherent, `destinationListId` is introduced in Step 1 and consistently referenced afterward, `result.sprintListId`/`result.sprintListName` are now used only for the sprint-association purpose (never as the creation `list_id`), and `allowed-tools` in the frontmatter includes `mcp__claude_ai_ClickUp__clickup_get_list` and `mcp__claude_ai_ClickUp__clickup_add_task_to_list` (add both if missing — check the current frontmatter line first).

- [ ] **Step 7: Run the existing test suite to confirm no regressions**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-bugs-to-clickup/parse-report.test.mjs
```

Expected: 24 passing (unchanged — this task only touched SKILL.md, not the `.mjs` files, so the count should not change; if a test fails, the `.mjs` files were touched by mistake — revert any accidental change).

- [ ] **Step 8: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add .claude/skills/report-bugs-to-clickup/SKILL.md
git commit -m "fix: create bug tickets in a fixed project List, associate to sprint separately

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Improvements parser — header, platform/environment/page inference (duplicated from bugs module)

**Files:**
- Create: `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.mjs`
- Test: `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs`

**Interfaces:**
- Produces: `parseReportHeader(markdownText: string): { flowName: string, url: string, date: string } | { error: string }`
- Produces: `inferPlatform(header: {flowName: string}, reportPath: string): 'Web' | 'Mobile'`
- Produces: `inferEnvironment(url: string): 'Staging' | 'Production' | 'Dev'`
- Produces: `inferPage(reportPath: string): string`

These four functions are intentionally identical in behavior to their `report-bugs-to-clickup/parse-report.mjs` counterparts (per the design's isolation rationale — duplicated, not imported). Copy their implementations verbatim.

- [ ] **Step 1: Write the failing tests**

Create `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReportHeader, inferPlatform, inferEnvironment, inferPage } from './parse-improvements.mjs';

test('parseReportHeader extracts flow name, url, and date', () => {
  const md = `
# QA Report — Register Flow

**Date:** 2026-03-26
**URL:** https://staging.otonomi.ai/register
**Viewports:** 375 × 667 px (Mobile) · 1440 × 900 px (Desktop)
`;
  const result = parseReportHeader(md);
  assert.deepEqual(result, {
    flowName: 'Register Flow',
    url: 'https://staging.otonomi.ai/register',
    date: '2026-03-26',
  });
});

test('parseReportHeader returns an error when header fields are missing', () => {
  const md = '# QA Report — Login Flow\n\nNo date or URL here.\n';
  const result = parseReportHeader(md);
  assert.deepEqual(result, { error: 'Report header is missing Title, Date, or URL.' });
});

test('inferPlatform defaults to Web', () => {
  assert.equal(inferPlatform({ flowName: 'Register Flow' }, 'evidence/staging-otonomi-ai/register/2026-03-26/qa-report.md'), 'Web');
});

test('inferPlatform detects Mobile from flow name', () => {
  assert.equal(inferPlatform({ flowName: 'Mobile App Login Flow' }, 'evidence/x/login/2026-03-26/qa-report.md'), 'Mobile');
});

test('inferEnvironment detects Staging from hostname', () => {
  assert.equal(inferEnvironment('https://staging.otonomi.ai/register'), 'Staging');
});

test('inferEnvironment does not misclassify a production hostname that merely contains "staging" as a substring', () => {
  assert.equal(inferEnvironment('https://staging-solutions.com/checkout'), 'Production');
});

test('inferEnvironment detects Dev from localhost', () => {
  assert.equal(inferEnvironment('http://localhost:5173/login'), 'Dev');
});

test('inferEnvironment defaults to Production for other domains', () => {
  assert.equal(inferEnvironment('https://otonomi.ai/dashboard'), 'Production');
});

test('inferPage maps the root subpath to Home', () => {
  assert.equal(inferPage('evidence/localhost-5173/root/2026-03-26/qa-report.md'), 'Home');
});

test('inferPage title-cases a simple subpath', () => {
  assert.equal(inferPage('evidence/localhost-5173/register/2026-03-26/qa-report.md'), 'Register');
});

test('inferPage title-cases and splits a hyphenated nested subpath', () => {
  assert.equal(inferPage('evidence/localhost-5173/users-profile/2026-03-26/qa-report.md'), 'Users Profile');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
```

Expected: FAIL — `Cannot find module './parse-improvements.mjs'`

- [ ] **Step 3: Write the implementation**

Create `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.mjs`:

```javascript
import path from 'node:path';
import fs from 'node:fs';

export function parseReportHeader(markdownText) {
  const titleMatch = markdownText.match(/^#\s+QA Report\s+—\s+(.+)$/m);
  const dateMatch = markdownText.match(/\*\*Date:\*\*\s*(.+)$/m);
  const urlMatch = markdownText.match(/\*\*URL:\*\*\s*(.+)$/m);

  if (!titleMatch || !dateMatch || !urlMatch) {
    return { error: 'Report header is missing Title, Date, or URL.' };
  }

  return {
    flowName: titleMatch[1].trim(),
    url: urlMatch[1].trim(),
    date: dateMatch[1].trim(),
  };
}

export function inferPlatform(header, reportPath) {
  const haystack = `${header.flowName} ${reportPath}`.toLowerCase();
  if (haystack.includes('mobile')) return 'Mobile';
  return 'Web';
}

export function inferEnvironment(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'Dev';
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'Dev';
  if (/(^|\.)staging(\.|$)/.test(hostname)) return 'Staging';
  if (/(^|\.)dev(\.|$)/.test(hostname)) return 'Dev';
  return 'Production';
}

export function inferPage(reportPath) {
  const normalized = reportPath.split(path.sep).join('/');
  const parts = normalized.split('/');
  const evidenceIdx = parts.indexOf('evidence');
  if (evidenceIdx === -1 || parts.length < evidenceIdx + 3) {
    return 'Unknown';
  }
  const subpath = parts[evidenceIdx + 2];
  if (subpath === 'root') return 'Home';
  return subpath
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

(The `fs` import is unused so far — it will be used starting in Task 3. Keep it; do not remove it.)

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
```

Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add .claude/skills/report-improvements-to-clickup/parse-improvements.mjs .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
git commit -m "feat: add header parsing and platform/environment/page inference to report-improvements-to-clickup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Parse "Nice to Have" bullets and find the report's shared evidence screenshot

**Files:**
- Modify: `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.mjs`
- Modify: `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 2 directly (independent function), but is called alongside it.
- Produces: `parseNiceToHave(markdownText: string): { improvements: Array<{description: string}>, warnings: string[] } | { error: string }`
- Produces: `findSharedEvidenceFile(reportDir: string): string | null` — returns the filename (not full path) of the lowest-numbered `NN-*.png`/`.jpg`/`.jpeg` file in the directory, or `null` if none found. `reportDir` is a real filesystem directory to scan with `fs.readdirSync`.

- [ ] **Step 1: Write the failing tests**

Append to `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs`:

```javascript
import { parseNiceToHave, findSharedEvidenceFile } from './parse-improvements.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('parseNiceToHave extracts bullets under ### Nice to Have', () => {
  const md = `
## Recommended Actions
### Must Fix
- Fix broken submit button on mobile

### Nice to Have
- Add eye icon on login, password field
- Increase contrast on placeholder text

## Evidence Files
`;
  const result = parseNiceToHave(md);
  assert.deepEqual(result, {
    improvements: [
      { description: 'Add eye icon on login, password field' },
      { description: 'Increase contrast on placeholder text' },
    ],
    warnings: [],
  });
});

test('parseNiceToHave returns an error when Recommended Actions is missing', () => {
  const md = '# QA Report — Login Flow\n\nNo recommended actions section.\n';
  const result = parseNiceToHave(md);
  assert.deepEqual(result, { error: 'No "Nice to Have" subsection found under Recommended Actions.' });
});

test('parseNiceToHave returns an error when Nice to Have has no bullets', () => {
  const md = `
## Recommended Actions
### Must Fix
- Fix broken submit button

### Nice to Have

## Evidence Files
`;
  const result = parseNiceToHave(md);
  assert.deepEqual(result, { error: '"Nice to Have" subsection has no bullet items.' });
});

test('parseNiceToHave warns about and skips a blank bullet line', () => {
  const md = `
### Nice to Have
- Add eye icon on login field
-
- Increase contrast on placeholder text
`;
  const result = parseNiceToHave(md);
  assert.deepEqual(result, {
    improvements: [
      { description: 'Add eye icon on login field' },
      { description: 'Increase contrast on placeholder text' },
    ],
    warnings: ['Skipped empty bullet under "Nice to Have"'],
  });
});

test('findSharedEvidenceFile returns the lowest-numbered image file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qa-evidence-'));
  writeFileSync(join(dir, '03-final-state.png'), '');
  writeFileSync(join(dir, '01-initial-load.png'), '');
  writeFileSync(join(dir, '02-form-filled.png'), '');
  writeFileSync(join(dir, 'qa-report.md'), '');
  const result = findSharedEvidenceFile(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(result, '01-initial-load.png');
});

test('findSharedEvidenceFile returns null when no image files exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qa-evidence-'));
  writeFileSync(join(dir, 'qa-report.md'), '');
  const result = findSharedEvidenceFile(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
```

Expected: FAIL — `parseNiceToHave is not a function`

- [ ] **Step 3: Write the implementation**

Append to `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.mjs`:

```javascript
export function parseNiceToHave(markdownText) {
  const lines = markdownText.split('\n');
  const sectionIdx = lines.findIndex((line) => /^###\s+Nice to Have/.test(line.trim()));
  if (sectionIdx === -1) {
    return { error: 'No "Nice to Have" subsection found under Recommended Actions.' };
  }

  const improvements = [];
  const warnings = [];
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^#{1,6}\s+/.test(line)) break; // next heading of any level ends the subsection
    if (!line.startsWith('-')) continue; // skip blank lines between bullets
    const description = line.replace(/^-\s*/, '').trim();
    if (description === '') {
      warnings.push('Skipped empty bullet under "Nice to Have"');
      continue;
    }
    improvements.push({ description });
  }

  if (improvements.length === 0) {
    return { error: '"Nice to Have" subsection has no bullet items.' };
  }

  return { improvements, warnings };
}

const IMAGE_EXT_RE = /\.(png|jpe?g)$/i;
const LEADING_NUMBER_RE = /^(\d+)-/;

export function findSharedEvidenceFile(reportDir) {
  let entries;
  try {
    entries = fs.readdirSync(reportDir);
  } catch {
    return null;
  }
  const imageFiles = entries.filter((name) => IMAGE_EXT_RE.test(name));
  if (imageFiles.length === 0) return null;

  imageFiles.sort((a, b) => {
    const numA = parseInt(a.match(LEADING_NUMBER_RE)?.[1] ?? 'Infinity', 10);
    const numB = parseInt(b.match(LEADING_NUMBER_RE)?.[1] ?? 'Infinity', 10);
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });

  return imageFiles[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
```

Expected: PASS (17 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add .claude/skills/report-improvements-to-clickup/parse-improvements.mjs .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
git commit -m "feat: parse Nice to Have bullets and find shared evidence screenshot

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Ticket title and description builders

**Files:**
- Modify: `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.mjs`
- Modify: `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs`

**Interfaces:**
- Consumes: `improvement: {description}` (Task 3), `platform, environment, page: string` (Task 2), `reporterName, priority, severity: string`
- Produces: `buildImprovementTitle(improvement, platform, environment, page): string`
- Produces: `buildImprovementDescription(improvement, reporterName, priority, severity): string`

- [ ] **Step 1: Write the failing tests**

Append to `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs`:

```javascript
import { buildImprovementTitle, buildImprovementDescription } from './parse-improvements.mjs';

test('buildImprovementTitle assembles the pipe-separated [Improvement] format', () => {
  const improvement = { description: 'Add eye icon on login, password field' };
  assert.equal(
    buildImprovementTitle(improvement, 'Web', 'Staging', 'Login'),
    '[Improvement] Web | Staging | Login | Add eye icon on login, password field'
  );
});

test('buildImprovementDescription fills the fixed In Scope template', () => {
  const improvement = { description: 'Add eye icon on login, password field' };
  const description = buildImprovementDescription(improvement, 'Julia Disarli', 'Low', 'Low');

  assert.equal(description, [
    'In Scope:',
    'Add eye icon on login, password field',
    '',
    'Additional information:',
    'Reported by: Julia Disarli',
    'Priority: Low',
    'Severity: Low',
  ].join('\n'));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
```

Expected: FAIL — `buildImprovementTitle is not a function`

- [ ] **Step 3: Write the implementation**

Append to `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.mjs`:

```javascript
export function buildImprovementTitle(improvement, platform, environment, page) {
  return `[Improvement] ${platform} | ${environment} | ${page} | ${improvement.description}`;
}

export function buildImprovementDescription(improvement, reporterName, priority, severity) {
  return [
    'In Scope:',
    improvement.description,
    '',
    'Additional information:',
    `Reported by: ${reporterName}`,
    `Priority: ${priority}`,
    `Severity: ${severity}`,
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
```

Expected: PASS (19 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add .claude/skills/report-improvements-to-clickup/parse-improvements.mjs .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
git commit -m "feat: add improvement ticket title/description builders

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Active sprint detection (duplicated from bugs module)

**Files:**
- Modify: `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.mjs`
- Modify: `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs`

**Interfaces:**
- Consumes: `sprintLists: Array<{id, name, startDate, endDate}>` (dates `YYYY-MM-DD`), `today: string` (`YYYY-MM-DD`)
- Produces: `findActiveSprint(sprintLists, today): {id: string, name: string} | { error: string }`

This is intentionally identical to `report-bugs-to-clickup/parse-report.mjs`'s `findActiveSprint` (including its malformed-date filtering, added in that skill's final review fix). Copy verbatim.

- [ ] **Step 1: Write the failing tests**

Append to `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs`:

```javascript
import { findActiveSprint } from './parse-improvements.mjs';

test('findActiveSprint picks the list whose date range covers today', () => {
  const sprints = [
    { id: '1', name: 'Sprint 12', startDate: '2026-08-01', endDate: '2026-08-14' },
    { id: '2', name: 'Sprint 13', startDate: '2026-08-15', endDate: '2026-08-28' },
    { id: '3', name: 'Sprint 14', startDate: '2026-08-29', endDate: '2026-09-11' },
  ];
  assert.deepEqual(findActiveSprint(sprints, '2026-09-01'), { id: '3', name: 'Sprint 14' });
});

test('findActiveSprint returns an error when no sprint covers today', () => {
  const sprints = [
    { id: '1', name: 'Sprint 12', startDate: '2026-08-01', endDate: '2026-08-14' },
  ];
  assert.deepEqual(findActiveSprint(sprints, '2026-09-01'), {
    error: 'No sprint list covers today\'s date (2026-09-01). Ask the user to pick a destination list manually.',
  });
});

test('findActiveSprint returns an error for an empty list', () => {
  assert.deepEqual(findActiveSprint([], '2026-09-01'), {
    error: 'No sprint list covers today\'s date (2026-09-01). Ask the user to pick a destination list manually.',
  });
});

test('findActiveSprint ignores an entry with malformed dates and still finds the valid match', () => {
  const sprints = [
    { id: '1', name: 'Bad Sprint', startDate: null, endDate: undefined },
    { id: '2', name: 'Sprint 14', startDate: '2026-08-29', endDate: '2026-09-11' },
  ];
  assert.deepEqual(findActiveSprint(sprints, '2026-09-01'), { id: '2', name: 'Sprint 14' });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
```

Expected: FAIL — `findActiveSprint is not a function`

- [ ] **Step 3: Write the implementation**

Append to `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.mjs`:

```javascript
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function findActiveSprint(sprintLists, today) {
  const validSprints = sprintLists.filter(
    (sprint) => ISO_DATE_RE.test(sprint.startDate) && ISO_DATE_RE.test(sprint.endDate)
  );
  const match = validSprints.find((sprint) => sprint.startDate <= today && today <= sprint.endDate);
  if (!match) {
    return { error: `No sprint list covers today's date (${today}). Ask the user to pick a destination list manually.` };
  }
  return { id: match.id, name: match.name };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
```

Expected: PASS (23 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add .claude/skills/report-improvements-to-clickup/parse-improvements.mjs .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
git commit -m "feat: add active sprint detection to report-improvements-to-clickup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: CLI entry point wiring it all together

**Files:**
- Modify: `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.mjs`
- Modify: `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs`

**Interfaces:**
- Consumes: all functions from Tasks 2–5.
- Produces: a CLI mode — `node parse-improvements.mjs <report-path> --sprints=<json> --today=<YYYY-MM-DD> --reporter="<name>" --priority=<value> --severity=<value>` — printing one JSON object to stdout:
  `{ tickets: Array<{title, description}>, sprintListId, sprintListName, evidenceFile: string | null, warnings: string[] } | { error: string }`

`--priority` and `--severity` default to `Low` when omitted (per the Global Constraints default), since at CLI-invocation time the SKILL.md may not yet have collected user overrides — the SKILL.md applies any per-ticket edits from the confirmation table after this call, directly on the in-memory ticket list, not by re-invoking the CLI.

- [ ] **Step 1: Write the failing test for the combined `buildImprovementTickets` function**

Append to `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs`:

```javascript
import { buildImprovementTickets } from './parse-improvements.mjs';

test('buildImprovementTickets combines parsing, inference, and building end-to-end', () => {
  const md = `
# QA Report — Register Flow

**Date:** 2026-03-26
**URL:** https://staging.otonomi.ai/register

## Recommended Actions
### Nice to Have
- Add eye icon on login, password field
`;
  const sprintLists = [{ id: '9', name: 'Sprint 14', startDate: '2026-08-29', endDate: '2026-09-11' }];
  const result = buildImprovementTickets({
    markdownText: md,
    reportPath: 'evidence/staging-otonomi-ai/register/2026-03-26/qa-report.md',
    sprintLists,
    today: '2026-09-01',
    reporterName: 'Julia Disarli',
    priority: 'Low',
    severity: 'Low',
    evidenceFile: '01-initial-load.png',
  });

  assert.deepEqual(result, {
    sprintListId: '9',
    sprintListName: 'Sprint 14',
    evidenceFile: '01-initial-load.png',
    warnings: [],
    tickets: [
      {
        title: '[Improvement] Web | Staging | Register | Add eye icon on login, password field',
        description: [
          'In Scope:',
          'Add eye icon on login, password field',
          '',
          'Additional information:',
          'Reported by: Julia Disarli',
          'Priority: Low',
          'Severity: Low',
        ].join('\n'),
      },
    ],
  });
});

test('buildImprovementTickets surfaces a parse error without throwing', () => {
  const result = buildImprovementTickets({
    markdownText: '# QA Report — Empty\n\n**Date:** 2026-03-26\n**URL:** https://x.com\n',
    reportPath: 'evidence/x/root/2026-03-26/qa-report.md',
    sprintLists: [],
    today: '2026-09-01',
    reporterName: 'Julia Disarli',
    priority: 'Low',
    severity: 'Low',
    evidenceFile: null,
  });
  assert.deepEqual(result, { error: 'No "Nice to Have" subsection found under Recommended Actions.' });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
```

Expected: FAIL — `buildImprovementTickets is not a function`

- [ ] **Step 3: Write the implementation**

Append to `qa-team/.claude/skills/report-improvements-to-clickup/parse-improvements.mjs`:

```javascript
export function buildImprovementTickets({ markdownText, reportPath, sprintLists, today, reporterName, priority, severity, evidenceFile }) {
  const headerResult = parseReportHeader(markdownText);
  if (headerResult.error) return headerResult;

  const niceToHaveResult = parseNiceToHave(markdownText);
  if (niceToHaveResult.error) return niceToHaveResult;

  const sprintResult = findActiveSprint(sprintLists, today);
  if (sprintResult.error) return sprintResult;

  const platform = inferPlatform(headerResult, reportPath);
  const environment = inferEnvironment(headerResult.url);
  const page = inferPage(reportPath);

  const tickets = niceToHaveResult.improvements.map((improvement) => ({
    title: buildImprovementTitle(improvement, platform, environment, page),
    description: buildImprovementDescription(improvement, reporterName, priority, severity),
  }));

  return {
    sprintListId: sprintResult.id,
    sprintListName: sprintResult.name,
    evidenceFile: evidenceFile ?? null,
    tickets,
    warnings: niceToHaveResult.warnings || [],
  };
}
```

Now add the CLI entry point at the very bottom of the file (after all exports):

```javascript
function runCli() {
  const [, , reportPathArg, ...rest] = process.argv;
  const flags = Object.fromEntries(
    rest
      .filter((arg) => arg.startsWith('--'))
      .map((arg) => {
        const [key, ...valueParts] = arg.slice(2).split('=');
        return [key, valueParts.join('=')];
      })
  );

  if (!reportPathArg) {
    console.log(JSON.stringify({ error: 'Usage: node parse-improvements.mjs <report-path> --sprints=<json> --today=<YYYY-MM-DD> --reporter="<name>" [--priority=<value>] [--severity=<value>]' }));
    process.exitCode = 1;
    return;
  }

  let markdownText;
  try {
    markdownText = fs.readFileSync(reportPathArg, 'utf8');
  } catch (err) {
    console.log(JSON.stringify({ error: `Could not read report file: ${err.message}` }));
    process.exitCode = 1;
    return;
  }

  let sprintLists = [];
  try {
    sprintLists = flags.sprints ? JSON.parse(flags.sprints) : [];
  } catch (err) {
    console.log(JSON.stringify({ error: `Invalid --sprints JSON: ${err.message}` }));
    process.exitCode = 1;
    return;
  }

  const today = flags.today || new Date().toISOString().slice(0, 10);
  const reporterName = flags.reporter || 'Unknown QA';
  const priority = flags.priority || 'Low';
  const severity = flags.severity || 'Low';
  const evidenceFile = findSharedEvidenceFile(path.dirname(reportPathArg));

  const result = buildImprovementTickets({ markdownText, reportPath: reportPathArg, sprintLists, today, reporterName, priority, severity, evidenceFile });
  console.log(JSON.stringify(result));
  if (result.error) process.exitCode = 1;
}

// Only run the CLI when this file is executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
node --test .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
```

Expected: PASS (25 tests)

- [ ] **Step 5: Manually verify the CLI mode end-to-end**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
mkdir -p /tmp/qa-improvement-fixture/evidence/staging-otonomi-ai/register/2026-03-26
touch /tmp/qa-improvement-fixture/evidence/staging-otonomi-ai/register/2026-03-26/01-initial-load.png
cat > /tmp/qa-improvement-fixture/evidence/staging-otonomi-ai/register/2026-03-26/qa-report.md << 'EOF'
# QA Report — Register Flow

**Date:** 2026-03-26
**URL:** https://staging.otonomi.ai/register

## Recommended Actions
### Nice to Have
- Add eye icon on login, password field
EOF
node .claude/skills/report-improvements-to-clickup/parse-improvements.mjs \
  /tmp/qa-improvement-fixture/evidence/staging-otonomi-ai/register/2026-03-26/qa-report.md \
  --sprints='[{"id":"9","name":"Sprint 14","startDate":"2026-08-29","endDate":"2026-09-11"}]' \
  --today=2026-09-01 \
  --reporter="Julia Disarli"
```

Expected: one line of JSON with `sprintListId: "9"`, `evidenceFile: "01-initial-load.png"`, and one ticket whose `title` is `[Improvement] Web | Staging | Register | Add eye icon on login, password field`.

- [ ] **Step 6: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add .claude/skills/report-improvements-to-clickup/parse-improvements.mjs .claude/skills/report-improvements-to-clickup/parse-improvements.test.mjs
git commit -m "feat: wire report-improvements-to-clickup parser into a CLI entry point

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: SKILL.md orchestration for improvements

**Files:**
- Create: `qa-team/.claude/skills/report-improvements-to-clickup/SKILL.md`

**Interfaces:**
- Consumes: the CLI contract from Task 6.
- Consumes ClickUp MCP tools: `mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy`, `mcp__claude_ai_ClickUp__clickup_get_list`, `mcp__claude_ai_ClickUp__clickup_create_task`, `mcp__claude_ai_ClickUp__clickup_resolve_assignees`, `mcp__claude_ai_ClickUp__clickup_add_task_to_list`, `mcp__claude_ai_ClickUp__clickup_request_attachment_upload`.
- Produces: the `/report-improvements-to-clickup` user-invocable skill.

No automated test for SKILL.md — verification is a manual dry run in Step 2, mirroring Task 6 of the original bugs plan.

- [ ] **Step 1: Write `SKILL.md`**

Create `qa-team/.claude/skills/report-improvements-to-clickup/SKILL.md`:

```markdown
---
name: report-improvements-to-clickup
description: Reads a qa-report.md's "Nice to Have" recommendations and creates one ClickUp Improvement ticket per bullet, in the project's fixed Improvements List, associated to the current sprint, assigned to the logged-in QA. Invoke manually with the path to a qa-report.md.
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion, mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy, mcp__claude_ai_ClickUp__clickup_get_list, mcp__claude_ai_ClickUp__clickup_create_task, mcp__claude_ai_ClickUp__clickup_resolve_assignees, mcp__claude_ai_ClickUp__clickup_add_task_to_list, mcp__claude_ai_ClickUp__clickup_request_attachment_upload
---

# report-improvements-to-clickup — Create ClickUp Improvement tickets from a QA report

You turn a `qa-report.md`'s **"Nice to Have"** recommendations into ClickUp Improvement tickets, one ticket per bullet, in the project's fixed Improvements List, associated to the active sprint. This is a manual, on-demand skill — only run it when the user explicitly invokes `/report-improvements-to-clickup <path>`.

## Step 0 — Resolve the report path

The user's argument is the path to a `qa-report.md`. If no path was given, ask for one before continuing. Verify the file exists with `Read`; if it doesn't, tell the user and stop.

## Step 1 — Ask which destination List and Sprints Folder to use

Ask the user two things:

1. **The project's fixed Improvements List** (e.g. "Otonomi Improvements") — every ticket created by this skill goes here, regardless of sprint. Use `mcp__claude_ai_ClickUp__clickup_get_list` to resolve its ID from the name; if ambiguous, use `mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy` to show the tree and let them pick. This becomes `destinationListId`.
2. **The project's Sprints Folder** — call `mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy` with `max_depth: "2"`, locate the Folder, and collect every List inside it as `{id, name, startDate, endDate}` (converting millisecond timestamps to `YYYY-MM-DD`).

## Step 2 — Identify the reporting QA

Call `mcp__claude_ai_ClickUp__clickup_resolve_assignees` with `assignees: ["me"]` to get the current user's ID and display name.

## Step 3 — Run the parser

Shell out via `Bash`:

```bash
node .claude/skills/report-improvements-to-clickup/parse-improvements.mjs "<report-path>" \
  --sprints='<JSON array of {id,name,startDate,endDate} from Step 1>' \
  --today=<today's date, YYYY-MM-DD> \
  --reporter="<display name from Step 2>"
```

Parse the single line of JSON printed to stdout.

- If it has an `error` field, show it to the user verbatim and stop. If the error mentions no sprint covering today's date, ask the user to pick a Sprint List manually from the ones listed in Step 1, then re-run the parser with a synthetic single-entry `--sprints` array covering today, same fallback pattern as `report-bugs-to-clickup`.
- Otherwise, continue to Step 4 with `result.tickets`, `result.sprintListId`, `result.sprintListName`, and `result.evidenceFile`.

## Step 4 — Confirm before creating anything

If `result.warnings` is non-empty, display those warnings prominently ABOVE the confirmation table, same pattern as `report-bugs-to-clickup`.

Show the user a table, one row per ticket in `result.tickets`, with **editable** Priority and Severity columns defaulting to `Low`:

| Title | Priority | Severity | Destination List | Sprint | Assignee |
|---|---|---|---|---|---|

- Priority / Severity: default `Low` for every row; let the user edit any row's value before confirming — if they change one, update that ticket's `description` text to match (re-run `buildImprovementDescription`'s template substitution manually in the ticket's description string, replacing the `Priority:`/`Severity:` lines).
- Destination List: the fixed Improvements List name from Step 1, same for every row.
- Sprint: `result.sprintListName`, same for every row.
- Assignee: the display name from Step 2.

Ask the user to confirm. If they ask for changes (drop an improvement, edit a title, change Priority/Severity), apply them and re-show the table. Do not proceed to Step 5 without explicit confirmation.

## Step 5 — Create the tickets

For each confirmed ticket, call `mcp__claude_ai_ClickUp__clickup_create_task`:

- `name`: the ticket's `title`
- `list_id`: `destinationListId` (the fixed Improvements List from Step 1)
- `markdown_description`: the ticket's `description`
- `assignees`: `[<user ID from Step 2>]`

If creation fails, record the failure and continue to the next ticket — do not stop the batch.

### Associate the ticket to the active sprint

After a ticket is created successfully, call `mcp__claude_ai_ClickUp__clickup_add_task_to_list` with the created task's ID and `result.sprintListId`. This requires the "Tasks in Multiple Lists" ClickApp. If it fails, do not fail or roll back the ticket — record the outcome for Step 6.

### Attach the shared evidence screenshot, if present

All improvements from this report share one screenshot: `result.evidenceFile`. If it is non-null:

1. Resolve its full path: it is a filename in the same directory as the report itself (`<directory of report-path>/<evidenceFile>`).
2. Check with `Bash` whether the file exists on disk. If not, skip attachment for all tickets from this run silently — note "no evidence file found" in each ticket's record.
3. If it exists, for **each** created ticket, call `mcp__claude_ai_ClickUp__clickup_request_attachment_upload` with that ticket's task ID, then follow the returned upload instructions with `curl -f` (or explicit HTTP-status checking — plain `curl` can exit `0` on a 4xx/5xx response) via `Bash`. Record success/failure per ticket; a failure on one ticket's attachment does not stop the batch or affect other tickets.

## Step 6 — Final summary

Print a table: for every ticket, the created ClickUp task URL or failure reason, the evidence-attachment outcome, and the sprint-association outcome. Never claim success for something that failed.

## Constraints

- Never fabricate the "In Scope" text — it is always the "Nice to Have" bullet's own wording, unchanged.
- Never skip Step 4's confirmation, even if the user seems in a hurry.
- Every "Nice to Have" bullet gets a ticket — do not filter or prioritize which ones to create.
- If the ClickUp MCP tools are not available in this session, stop immediately and tell the user, the same way `qa-agent`'s Playwright MCP pre-flight check does — do not attempt a workaround.
```

- [ ] **Step 2: Manually dry-run the skill**

Re-read the full SKILL.md against the design spec (`docs/superpowers/specs/2026-09-01-report-improvements-to-clickup-design.md`) and confirm every numbered flow step (1–12) maps to a SKILL.md step. Then, in a live Claude Code session with the ClickUp MCP connected, run:

```
/report-improvements-to-clickup /tmp/qa-improvement-fixture/evidence/staging-otonomi-ai/register/2026-03-26/qa-report.md
```

using the fixture from Task 6 Step 5, pointed at a real (test) ClickUp Space/Folder/List, and confirm:
- The confirmation table appears before any ClickUp write, with editable Priority/Severity.
- Declining creates no tickets.
- Confirming creates exactly one ticket, in the expected fixed List, additionally associated with the expected sprint.

- [ ] **Step 3: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add .claude/skills/report-improvements-to-clickup/SKILL.md
git commit -m "feat: add report-improvements-to-clickup SKILL.md orchestration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: README documentation

**Files:**
- Modify: `qa-team/README.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Add a section documenting the new skill and the sprint-association fix**

Read the current `qa-team/README.md`'s "Reporting bugs to ClickUp" section (added by the previous plan). Update it and add a new section right after it:

```markdown
## Reporting bugs to ClickUp

The `report-bugs-to-clickup` skill (`.claude/skills/report-bugs-to-clickup/`)
reads any `qa-report.md`'s Bug Register table and creates one ClickUp bug
ticket per row, in the project's fixed Bugs List, additionally associated
with the active sprint, tagged by environment and assigned to the
logged-in ClickUp user.

This is a manual, on-demand skill — it does not run automatically at the
end of a `qa-agent` session. Run it explicitly when you're ready to file
tickets:

```bash
/report-bugs-to-clickup path/to/qa-report.md
```

See `docs/superpowers/specs/2026-09-01-report-bugs-to-clickup-design.md`
for the full design.

## Reporting improvements to ClickUp

The `report-improvements-to-clickup` skill
(`.claude/skills/report-improvements-to-clickup/`) reads a `qa-report.md`'s
"Nice to Have" recommendations and creates one ClickUp Improvement ticket
per item, in the project's fixed Improvements List, additionally
associated with the active sprint, assigned to the logged-in ClickUp
user, with the report's shared happy-path screenshot attached.

Also manual/on-demand:

```bash
/report-improvements-to-clickup path/to/qa-report.md
```

See
`docs/superpowers/specs/2026-09-01-report-improvements-to-clickup-design.md`
for the full design, including the fixed-List-plus-sprint-association
model both skills share.
```

Replace the *entire* existing "Reporting bugs to ClickUp" section (find it by its `## Reporting bugs to ClickUp` heading) with the two sections above, preserving whatever comes after it in the file unchanged.

- [ ] **Step 2: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add README.md
git commit -m "docs: document report-improvements-to-clickup and sprint-association model

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
