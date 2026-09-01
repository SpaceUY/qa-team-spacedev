# Report Bugs to ClickUp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project skill, `report-bugs-to-clickup`, that reads a `qa-report.md`'s Bug Register table and creates one ClickUp bug ticket per row — with an inferred title, a fixed description template, the current sprint as destination list, an environment tag, and the logged-in QA as assignee — after showing the user a confirmation table.

**Architecture:** A single `SKILL.md` (Markdown instructions, Claude-executed — this is a skill, not a compiled program) plus a small pure-logic Node script that the skill shells out to for the deterministic parsing/inference steps (parsing the Bug Register table, inferring platform/environment/page, building titles/descriptions, picking the active sprint list from date ranges). Keeping that logic in a tested `.mjs` script — rather than leaving it to free-form model reasoning at run time — makes it unit-testable and deterministic; the SKILL.md orchestrates: call the script, call ClickUp MCP tools, ask for confirmation.

**Tech Stack:** Node.js (no new dependencies — built-in `fs`/`path` and a hand-rolled minimal Markdown table parser), Claude Code skill frontmatter, ClickUp MCP tools (`clickup_get_workspace_hierarchy`, `clickup_create_task`, `clickup_resolve_assignees`).

## Global Constraints

- Skill lives at `qa-team/.claude/skills/report-bugs-to-clickup/` (per spec, project-level, not inside `qa-agent/`).
- Trigger is manual only: `/report-bugs-to-clickup <path-to-qa-report.md>`. No wiring into `qa-agent`'s automatic flow.
- Title format: `[BUG] {Platform} | {Environment} | {Page} | {Short description}` (spec § "Build ticket title").
- Description template is fixed (spec § "Build ticket description") — `Preconditions`, `Steps to reproduce`, `Expected result` stay as empty placeholders; never fabricate content for them.
- All severities (High, Medium, Low) get tickets — no filtering.
- Must show a confirmation table (title, severity, destination, tag, assignee) and wait for explicit user approval before any ClickUp write call.
- Sprint detection: the destination list is the one, among the Lists in a user-specified Sprints Folder, whose start/end dates cover today's date. If none matches, ask the user to pick manually — never guess.
- Assignee is always the currently authenticated ClickUp user (`"me"`, resolved via `clickup_resolve_assignees`).
- Environment tag (`staging` / `production` / `dev`) must already exist in the ClickUp Space (`clickup_add_tag_to_task`/`tags` param fails silently otherwise) — the skill must warn if tagging fails rather than crash the whole run.
- Individual ticket failures (create/attach) must not abort the batch; failures are surfaced in the final summary.

---

## File Structure

```
qa-team/
└── .claude/
    └── skills/
        └── report-bugs-to-clickup/
            ├── SKILL.md                  # orchestration: read report, call parser, confirm, call ClickUp MCP
            ├── parse-report.mjs          # pure logic: parse Bug Register + build ticket payloads
            └── parse-report.test.mjs     # unit tests for parse-report.mjs (run with `node --test`)
```

- `parse-report.mjs` is a standalone Node script with no external dependencies, invoked by the skill via `node .claude/skills/report-bugs-to-clickup/parse-report.mjs <report-path> --sprints=<json>` (sprint list dates passed in once fetched from ClickUp MCP, so the script stays pure/testable and doesn't need network access itself). It prints a single JSON object to stdout: the parsed bugs plus computed title/description/environment/platform/page/sprint-list-id for each, or an error object.
- `SKILL.md` never re-implements parsing/inference logic inline — it always shells out to `parse-report.mjs` for anything algorithmic, and only handles: invoking ClickUp MCP tools, asking the user questions, and formatting the confirmation table for display.

---

### Task 1: Bug Register table parser

**Files:**
- Create: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`
- Test: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`

**Interfaces:**
- Produces: `parseBugRegister(markdownText: string): { bugs: Array<{id: string, severity: 'High'|'Medium'|'Low', description: string, evidence: string}> } | { error: string }`
- Produces: `parseReportHeader(markdownText: string): { flowName: string, url: string, date: string } | { error: string }`

- [ ] **Step 1: Write the failing test for `parseBugRegister`**

Create `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBugRegister, parseReportHeader } from './parse-report.mjs';

test('parseBugRegister extracts rows from a Bug Register table', () => {
  const md = `
# QA Report — Register Flow

**Date:** 2026-03-26
**URL:** https://staging.otonomi.ai/register
**Viewports:** 375 × 667 px (Mobile) · 1440 × 900 px (Desktop)
**Quality Score:** 72/100

## Bug Register
| ID | Severity | Description | Evidence |
|----|----------|--------------|----------|
| BUG-001 | 🔴 High | Email validation accepts malformed addresses | 02-invalid-email.png |
| BUG-002 | 🟡 Medium | Submit button stays enabled during request | 04-double-submit.png |
| BUG-003 | 🟢 Low | Placeholder text has low contrast | 05-contrast.png |

## Scenario Results
| Scenario | Result |
`;
  const result = parseBugRegister(md);
  assert.deepEqual(result, {
    bugs: [
      { id: 'BUG-001', severity: 'High', description: 'Email validation accepts malformed addresses', evidence: '02-invalid-email.png' },
      { id: 'BUG-002', severity: 'Medium', description: 'Submit button stays enabled during request', evidence: '04-double-submit.png' },
      { id: 'BUG-003', severity: 'Low', description: 'Placeholder text has low contrast', evidence: '05-contrast.png' },
    ],
  });
});

test('parseBugRegister returns an error when the section is missing', () => {
  const md = '# QA Report — Login Flow\n\n**Date:** 2026-03-26\n\nNo bug table here.\n';
  const result = parseBugRegister(md);
  assert.deepEqual(result, { error: 'No "Bug Register" section found in report.' });
});

test('parseBugRegister returns an error when the table has no data rows', () => {
  const md = '## Bug Register\n| ID | Severity | Description | Evidence |\n|----|----------|-------------|----------|\n';
  const result = parseBugRegister(md);
  assert.deepEqual(result, { error: 'Bug Register table has no rows.' });
});

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
Expected: FAIL — `Cannot find module './parse-report.mjs'`

- [ ] **Step 3: Write minimal implementation**

Create `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`:

```javascript
const SEVERITY_ICONS = { '🔴': 'High', '🟡': 'Medium', '🟢': 'Low' };

function stripSeverityIcon(cell) {
  const trimmed = cell.trim();
  for (const [icon, name] of Object.entries(SEVERITY_ICONS)) {
    if (trimmed.startsWith(icon)) return name;
  }
  // Fallback: cell may already be a plain severity word.
  if (['High', 'Medium', 'Low'].includes(trimmed)) return trimmed;
  return trimmed;
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

export function parseBugRegister(markdownText) {
  const lines = markdownText.split('\n');
  const sectionStart = lines.findIndex((line) => /^##\s+Bug Register/.test(line.trim()));
  if (sectionStart === -1) {
    return { error: 'No "Bug Register" section found in report.' };
  }

  // Find the header row (starts with "| ID") after the section heading.
  let headerIdx = -1;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (/^\|\s*ID\s*\|/i.test(lines[i].trim())) {
      headerIdx = i;
      break;
    }
    // Stop scanning if we hit the next section heading first.
    if (/^##\s+/.test(lines[i].trim())) break;
  }
  if (headerIdx === -1) {
    return { error: 'No "Bug Register" section found in report.' };
  }

  // Data rows start two lines after the header (header, separator, then data).
  const bugs = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break; // table ended
    const cells = splitRow(line);
    if (cells.length < 4) continue;
    const [id, severityCell, description, evidence] = cells;
    bugs.push({
      id,
      severity: stripSeverityIcon(severityCell),
      description,
      evidence,
    });
  }

  if (bugs.length === 0) {
    return { error: 'Bug Register table has no rows.' };
  }

  return { bugs };
}

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs
git commit -m "feat: add Bug Register table parser for report-bugs-to-clickup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Metadata inference (platform, environment, page)

**Files:**
- Modify: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`
- Test: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1 directly (independent pure functions), but is called alongside `parseReportHeader`'s output.
- Produces: `inferPlatform(header: {flowName: string}, reportPath: string): 'Web' | 'Mobile'`
- Produces: `inferEnvironment(url: string): 'Staging' | 'Production' | 'Dev'`
- Produces: `inferPage(reportPath: string): string` — derives the readable page name from the evidence folder path convention (`evidence/{hostname}/{subpath}/{date}/qa-report.md`).

- [ ] **Step 1: Write the failing tests**

Append to `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`:

```javascript
import { inferPlatform, inferEnvironment, inferPage } from './parse-report.mjs';

test('inferPlatform defaults to Web', () => {
  assert.equal(inferPlatform({ flowName: 'Register Flow' }, 'evidence/staging-otonomi-ai/register/2026-03-26/qa-report.md'), 'Web');
});

test('inferPlatform detects Mobile from flow name', () => {
  assert.equal(inferPlatform({ flowName: 'Mobile App Login Flow' }, 'evidence/x/login/2026-03-26/qa-report.md'), 'Mobile');
});

test('inferEnvironment detects Staging from hostname', () => {
  assert.equal(inferEnvironment('https://staging.otonomi.ai/register'), 'Staging');
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

Run: `node --test qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
Expected: FAIL — `inferPlatform is not a function` (and similarly for the other two)

- [ ] **Step 3: Write minimal implementation**

Append to `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`:

```javascript
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
  if (hostname.startsWith('staging.') || hostname.includes('staging')) return 'Staging';
  if (hostname.startsWith('dev.') || hostname.includes('.dev.')) return 'Dev';
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

Add the missing `path` import at the top of the file:

```javascript
import path from 'node:path';
```

(This goes above the existing `SEVERITY_ICONS` constant.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs
git commit -m "feat: add platform/environment/page inference to report-bugs-to-clickup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Ticket title and description builders

**Files:**
- Modify: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`
- Test: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`

**Interfaces:**
- Consumes: `bug: {id, severity, description, evidence}` (Task 1), `platform: string`, `environment: string`, `page: string` (Task 2), `header: {url: string}` (Task 1), `reporterName: string`
- Produces: `buildTicketTitle(bug, platform, environment, page): string`
- Produces: `buildTicketDescription(bug, header, reporterName): string`

- [ ] **Step 1: Write the failing tests**

Append to `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`:

```javascript
import { buildTicketTitle, buildTicketDescription } from './parse-report.mjs';

test('buildTicketTitle assembles the pipe-separated format', () => {
  const bug = { id: 'BUG-001', severity: 'High', description: 'The user cannot see the image', evidence: '01-home.png' };
  assert.equal(
    buildTicketTitle(bug, 'Web', 'Staging', 'Home'),
    '[BUG] Web | Staging | Home | The user cannot see the image'
  );
});

test('buildTicketDescription fills the fixed template', () => {
  const bug = { id: 'BUG-001', severity: 'High', description: 'The user cannot see the image', evidence: '01-home.png' };
  const header = { url: 'https://staging.otonomi.ai/' };
  const description = buildTicketDescription(bug, header, 'Julia Disarli');

  assert.equal(description, [
    'Preconditions:',
    '-',
    '',
    'Steps to reproduce:',
    '-',
    '',
    'Actual Result:',
    'The user cannot see the image',
    '',
    'Expected result:',
    '-',
    '',
    'Additional information:',
    'Original ID: BUG-001',
    'Severity: High',
    'URL: https://staging.otonomi.ai/',
    'Evidence: 01-home.png',
    'Reported by: Julia Disarli',
  ].join('\n'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
Expected: FAIL — `buildTicketTitle is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`:

```javascript
export function buildTicketTitle(bug, platform, environment, page) {
  return `[BUG] ${platform} | ${environment} | ${page} | ${bug.description}`;
}

export function buildTicketDescription(bug, header, reporterName) {
  return [
    'Preconditions:',
    '-',
    '',
    'Steps to reproduce:',
    '-',
    '',
    'Actual Result:',
    bug.description,
    '',
    'Expected result:',
    '-',
    '',
    'Additional information:',
    `Original ID: ${bug.id}`,
    `Severity: ${bug.severity}`,
    `URL: ${header.url}`,
    `Evidence: ${bug.evidence}`,
    `Reported by: ${reporterName}`,
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs
git commit -m "feat: add ticket title/description builders to report-bugs-to-clickup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Active sprint list detection

**Files:**
- Modify: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`
- Test: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`

**Interfaces:**
- Consumes: `sprintLists: Array<{id: string, name: string, startDate: string, endDate: string}>` (dates as `YYYY-MM-DD`, fetched by the skill from `clickup_get_workspace_hierarchy` before calling this), `today: string` (`YYYY-MM-DD`)
- Produces: `findActiveSprint(sprintLists, today): {id: string, name: string} | { error: string }`

- [ ] **Step 1: Write the failing tests**

Append to `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`:

```javascript
import { findActiveSprint } from './parse-report.mjs';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
Expected: FAIL — `findActiveSprint is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`:

```javascript
export function findActiveSprint(sprintLists, today) {
  const match = sprintLists.find((sprint) => sprint.startDate <= today && today <= sprint.endDate);
  if (!match) {
    return { error: `No sprint list covers today's date (${today}). Ask the user to pick a destination list manually.` };
  }
  return { id: match.id, name: match.name };
}
```

(String comparison works here because dates are in `YYYY-MM-DD` format, which sorts lexicographically the same as chronologically.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs
git commit -m "feat: add active sprint detection to report-bugs-to-clickup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: CLI entry point wiring it all together

**Files:**
- Modify: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`
- Test: `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`

**Interfaces:**
- Consumes: all functions from Tasks 1–4.
- Produces: a CLI mode — when run as `node parse-report.mjs <report-path> --sprints=<json> --today=<YYYY-MM-DD> --reporter="<name>"` — that prints one JSON object to stdout:
  `{ tickets: Array<{title, description, severity, environment}> } | { error: string }`
  This is what `SKILL.md` will shell out to and parse.

- [ ] **Step 1: Write the failing test for the combined `buildTickets` function**

Append to `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`:

```javascript
import { buildTickets } from './parse-report.mjs';

test('buildTickets combines parsing, inference, and building end-to-end', () => {
  const md = `
# QA Report — Register Flow

**Date:** 2026-03-26
**URL:** https://staging.otonomi.ai/register

## Bug Register
| ID | Severity | Description | Evidence |
|----|----------|--------------|----------|
| BUG-001 | 🔴 High | Email validation accepts malformed addresses | 02-invalid-email.png |
`;
  const sprintLists = [{ id: '9', name: 'Sprint 14', startDate: '2026-08-29', endDate: '2026-09-11' }];
  const result = buildTickets({
    markdownText: md,
    reportPath: 'evidence/staging-otonomi-ai/register/2026-03-26/qa-report.md',
    sprintLists,
    today: '2026-09-01',
    reporterName: 'Julia Disarli',
  });

  assert.deepEqual(result, {
    sprintListId: '9',
    sprintListName: 'Sprint 14',
    tickets: [
      {
        title: '[BUG] Web | Staging | Register | Email validation accepts malformed addresses',
        description: [
          'Preconditions:',
          '-',
          '',
          'Steps to reproduce:',
          '-',
          '',
          'Actual Result:',
          'Email validation accepts malformed addresses',
          '',
          'Expected result:',
          '-',
          '',
          'Additional information:',
          'Original ID: BUG-001',
          'Severity: High',
          'URL: https://staging.otonomi.ai/register',
          'Evidence: 02-invalid-email.png',
          'Reported by: Julia Disarli',
        ].join('\n'),
        severity: 'High',
        environment: 'Staging',
        evidence: '02-invalid-email.png',
      },
    ],
  });
});

test('buildTickets surfaces a parse error without throwing', () => {
  const result = buildTickets({
    markdownText: '# QA Report — Empty\n\n**Date:** 2026-03-26\n**URL:** https://x.com\n',
    reportPath: 'evidence/x/root/2026-03-26/qa-report.md',
    sprintLists: [],
    today: '2026-09-01',
    reporterName: 'Julia Disarli',
  });
  assert.deepEqual(result, { error: 'No "Bug Register" section found in report.' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
Expected: FAIL — `buildTickets is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs`:

```javascript
export function buildTickets({ markdownText, reportPath, sprintLists, today, reporterName }) {
  const headerResult = parseReportHeader(markdownText);
  if (headerResult.error) return headerResult;

  const bugRegisterResult = parseBugRegister(markdownText);
  if (bugRegisterResult.error) return bugRegisterResult;

  const sprintResult = findActiveSprint(sprintLists, today);
  if (sprintResult.error) return sprintResult;

  const platform = inferPlatform(headerResult, reportPath);
  const environment = inferEnvironment(headerResult.url);
  const page = inferPage(reportPath);

  const tickets = bugRegisterResult.bugs.map((bug) => ({
    title: buildTicketTitle(bug, platform, environment, page),
    description: buildTicketDescription(bug, headerResult, reporterName),
    severity: bug.severity,
    environment,
    evidence: bug.evidence,
  }));

  return {
    sprintListId: sprintResult.id,
    sprintListName: sprintResult.name,
    tickets,
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
    console.log(JSON.stringify({ error: 'Usage: node parse-report.mjs <report-path> --sprints=<json> --today=<YYYY-MM-DD> --reporter="<name>"' }));
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

  const result = buildTickets({ markdownText, reportPath: reportPathArg, sprintLists, today, reporterName });
  console.log(JSON.stringify(result));
  if (result.error) process.exitCode = 1;
}

// Only run the CLI when this file is executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
```

Add the missing `fs` import at the top of the file, next to the `path` import:

```javascript
import fs from 'node:fs';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs`
Expected: PASS (18 tests)

- [ ] **Step 5: Manually verify the CLI mode end-to-end**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
mkdir -p /tmp/qa-report-fixture
cat > /tmp/qa-report-fixture/qa-report.md << 'EOF'
# QA Report — Register Flow

**Date:** 2026-03-26
**URL:** https://staging.otonomi.ai/register

## Bug Register
| ID | Severity | Description | Evidence |
|----|----------|--------------|----------|
| BUG-001 | 🔴 High | Email validation accepts malformed addresses | 02-invalid-email.png |
EOF
node .claude/skills/report-bugs-to-clickup/parse-report.mjs /tmp/qa-report-fixture/qa-report.md \
  --sprints='[{"id":"9","name":"Sprint 14","startDate":"2026-08-29","endDate":"2026-09-11"}]' \
  --today=2026-09-01 \
  --reporter="Julia Disarli"
```

Expected: a single line of JSON on stdout with `sprintListId: "9"` and one ticket whose `title` is `[BUG] Web | Staging | Register | Email validation accepts malformed addresses`.

- [ ] **Step 6: Commit**

```bash
git add qa-team/.claude/skills/report-bugs-to-clickup/parse-report.mjs qa-team/.claude/skills/report-bugs-to-clickup/parse-report.test.mjs
git commit -m "feat: wire report-bugs-to-clickup parser into a CLI entry point

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: SKILL.md orchestration

**Files:**
- Create: `qa-team/.claude/skills/report-bugs-to-clickup/SKILL.md`

**Interfaces:**
- Consumes: the CLI contract from Task 5 (`node parse-report.mjs <report-path> --sprints=<json> --today=<YYYY-MM-DD> --reporter="<name>"` → JSON on stdout).
- Consumes ClickUp MCP tools: `mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy`, `mcp__claude_ai_ClickUp__clickup_create_task`, `mcp__claude_ai_ClickUp__clickup_resolve_assignees`.
- Produces: the `/report-bugs-to-clickup` user-invocable skill.

This task has no automated test (SKILL.md is Claude-executed instructions, not code) — verification is a manual dry run in Step 2.

- [ ] **Step 1: Write `SKILL.md`**

Create `qa-team/.claude/skills/report-bugs-to-clickup/SKILL.md`:

```markdown
---
name: report-bugs-to-clickup
description: Reads a qa-report.md's Bug Register table and creates one ClickUp bug ticket per row, in the project's current sprint, tagged by environment and assigned to the logged-in QA. Invoke manually with the path to a qa-report.md.
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion, mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy, mcp__claude_ai_ClickUp__clickup_create_task, mcp__claude_ai_ClickUp__clickup_resolve_assignees
---

# report-bugs-to-clickup — Create ClickUp bug tickets from a QA report

You turn a `qa-report.md`'s **Bug Register** table into ClickUp bug tickets, one ticket per row, in the project's active sprint list. This is a manual, on-demand skill — only run it when the user explicitly invokes `/report-bugs-to-clickup <path>`.

## Step 0 — Resolve the report path

The user's argument is the path to a `qa-report.md`. If no path was given, ask for one (`AskUserQuestion` or a direct question) before continuing. Verify the file exists with `Read` before proceeding; if it doesn't, tell the user and stop.

## Step 1 — Ask which Sprints Folder to use

Ask the user which ClickUp Space/Folder holds this project's sprints (e.g. "Otonomi > Sprints"). Then call `mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy` with `max_depth: "2"` to list Spaces → Folders → Lists, and locate the Folder the user named. Collect every List inside it as `{id, name, startDate, endDate}` — ClickUp lists expose `start_date`/`due_date` (or the Folder's Sprint configuration) as millisecond timestamps; convert each to `YYYY-MM-DD` before using them.

If the user isn't sure which Folder, show them the Space/Folder names returned by the hierarchy call and let them pick.

## Step 2 — Identify the reporting QA

Call `mcp__claude_ai_ClickUp__clickup_resolve_assignees` with `assignees: ["me"]` to get the current user's ID and display name. Keep the display name for the description template and the ID for the `assignees` field on task creation.

## Step 3 — Run the parser

Shell out via `Bash`:

```bash
node .claude/skills/report-bugs-to-clickup/parse-report.mjs "<report-path>" \
  --sprints='<JSON array of {id,name,startDate,endDate} from Step 1>' \
  --today=<today's date, YYYY-MM-DD> \
  --reporter="<display name from Step 2>"
```

Parse the single line of JSON printed to stdout.

- If it has an `error` field, show the error to the user verbatim and stop. In particular, if the error mentions no sprint covering today's date, ask the user to pick a destination List manually from the ones listed in Step 1, then skip straight to Step 5 using that List's ID as `sprintListId` and re-run the parser with a synthetic single-entry `--sprints` array covering today (start/end date open-ended around today) so the rest of the flow stays unchanged.
- Otherwise, continue to Step 4 with `result.tickets` and `result.sprintListId`.

## Step 4 — Confirm before creating anything

Show the user a table, one row per ticket in `result.tickets`:

| Title | Severity | Destination List | Tag | Assignee |
|---|---|---|---|---|

- Destination List: `result.sprintListName` for every row (all tickets in one run go to the same sprint list).
- Tag: the ticket's `environment` field, lowercased (`staging`, `production`, `dev`).
- Assignee: the display name from Step 2.

Ask the user to confirm (`AskUserQuestion`, yes/no or "edit"). If they ask for changes (drop a bug, edit a title), apply them to the in-memory list and re-show the table. Do not proceed to Step 5 without explicit confirmation.

## Step 5 — Create the tickets

For each confirmed ticket, call `mcp__claude_ai_ClickUp__clickup_create_task`:

- `name`: the ticket's `title`
- `list_id`: `result.sprintListId`
- `markdown_description`: the ticket's `description`
- `assignees`: `[<user ID from Step 2>]`
- `tags`: `[<environment tag, lowercased>]`

If a `clickup_create_task` call fails (e.g. the tag doesn't exist yet in the Space), record the failure with the ticket's title and continue to the next ticket — do not stop the batch.

## Step 6 — Final summary

Print a table to the user: for every ticket, either the created ClickUp task URL (returned by `clickup_create_task`) or the failure reason. Never claim success for a ticket that failed.

## Constraints

- Never fabricate `Preconditions`, `Steps to reproduce`, or `Expected result` content — these stay as the template's empty placeholders (`-`) unless the report itself states them.
- Never skip Step 4's confirmation, even if the user seems in a hurry.
- All severities (High, Medium, Low) get tickets — do not filter by severity.
- If the ClickUp MCP tools are not available in this session, stop immediately and tell the user, the same way `qa-agent`'s Playwright MCP pre-flight check does — do not attempt a workaround.
```

- [ ] **Step 2: Manually dry-run the skill**

Since `SKILL.md` is instructions, not code, verify it by re-reading it end-to-end against the design spec (`docs/superpowers/specs/2026-09-01-report-bugs-to-clickup-design.md`) and confirming every spec step (§ 1–10) maps to a step in the SKILL.md. Then, in a live Claude Code session with the ClickUp MCP connected, run:

```
/report-bugs-to-clickup /tmp/qa-report-fixture/qa-report.md
```

using the fixture from Task 5 Step 5, pointed at a real (test) ClickUp Space/Folder, and confirm:
- The confirmation table appears before any ClickUp write.
- Declining at Step 4 creates no tickets.
- Confirming creates exactly one ticket, in the expected sprint List, with the expected title, tag, and assignee.

- [ ] **Step 3: Commit**

```bash
git add qa-team/.claude/skills/report-bugs-to-clickup/SKILL.md
git commit -m "feat: add report-bugs-to-clickup SKILL.md orchestration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: README documentation

**Files:**
- Modify: `qa-team/README.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Add a row documenting the new skill**

Read the current `qa-team/README.md` module table, then add a new section after the "CI" section:

```markdown
## Reporting bugs to ClickUp

The `report-bugs-to-clickup` skill (`.claude/skills/report-bugs-to-clickup/`)
reads any `qa-report.md`'s Bug Register table and creates one ClickUp bug
ticket per row, in the project's active sprint, tagged by environment and
assigned to the logged-in ClickUp user.

This is a manual, on-demand skill — it does not run automatically at the
end of a `qa-agent` session. Run it explicitly when you're ready to file
tickets:

```bash
/report-bugs-to-clickup path/to/qa-report.md
```

See `docs/superpowers/specs/2026-09-01-report-bugs-to-clickup-design.md`
for the full design.
```

- [ ] **Step 2: Commit**

```bash
git add qa-team/README.md
git commit -m "docs: document report-bugs-to-clickup skill in README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
