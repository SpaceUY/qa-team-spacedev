import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBugRegister, parseReportHeader, inferPlatform, inferEnvironment, inferPage, buildTicketTitle, buildTicketDescription } from './parse-report.mjs';

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
