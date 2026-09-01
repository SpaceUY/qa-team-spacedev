import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBugRegister, parseReportHeader, inferPlatform, inferEnvironment, inferPage, buildTicketTitle, buildTicketDescription, findActiveSprint, buildTickets } from './parse-report.mjs';

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
    warnings: [],
  });
});

test('parseBugRegister unescapes \\| in a cell and does not misalign the row', () => {
  const md = `
## Bug Register
| ID | Severity | Description | Evidence |
|----|----------|--------------|----------|
| BUG-001 | 🔴 High | a \\| b | 02-invalid-email.png |
`;
  const result = parseBugRegister(md);
  assert.deepEqual(result, {
    bugs: [
      { id: 'BUG-001', severity: 'High', description: 'a | b', evidence: '02-invalid-email.png' },
    ],
    warnings: [],
  });
});

test('parseBugRegister warns and skips a malformed short row while keeping valid rows', () => {
  const md = `
## Bug Register
| ID | Severity | Description | Evidence |
|----|----------|--------------|----------|
| BUG-001 | 🔴 High |
| BUG-002 | 🟡 Medium | Submit button stays enabled during request | 04-double-submit.png |
`;
  const result = parseBugRegister(md);
  assert.deepEqual(result.bugs, [
    { id: 'BUG-002', severity: 'Medium', description: 'Submit button stays enabled during request', evidence: '04-double-submit.png' },
  ]);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /malformed/i);
  assert.match(result.warnings[0], /BUG-001/);
});

test('parseBugRegister warns on an unrecognized severity value but keeps the trimmed value', () => {
  const md = `
## Bug Register
| ID | Severity | Description | Evidence |
|----|----------|--------------|----------|
| BUG-001 | 🔵 Critical | Something bad happened | 02-invalid-email.png |
`;
  const result = parseBugRegister(md);
  assert.deepEqual(result.bugs, [
    { id: 'BUG-001', severity: 'Critical', description: 'Something bad happened', evidence: '02-invalid-email.png' },
  ]);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Unrecognized severity "Critical" for row BUG-001/);
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

test('inferEnvironment does not misclassify a production hostname that merely contains "staging" as a substring', () => {
  assert.equal(inferEnvironment('https://staging-solutions.com/checkout'), 'Production');
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
    { id: '1', name: 'Broken Sprint', startDate: null, endDate: undefined },
    { id: '2', name: 'Sprint 14', startDate: '2026-08-29', endDate: '2026-09-11' },
  ];
  assert.deepEqual(findActiveSprint(sprints, '2026-09-01'), { id: '2', name: 'Sprint 14' });
});

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
    warnings: [],
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
