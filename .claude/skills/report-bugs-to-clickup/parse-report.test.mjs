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
