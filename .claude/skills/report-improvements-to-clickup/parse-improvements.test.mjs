import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReportHeader, inferPlatform, inferEnvironment, inferPage, parseNiceToHave, findSharedEvidenceFile } from './parse-improvements.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

test('findSharedEvidenceFile sorts unnumbered files to the end, not the front', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qa-evidence-'));
  writeFileSync(join(dir, '01-a.png'), '');
  writeFileSync(join(dir, '03-b.png'), '');
  writeFileSync(join(dir, '05-c.png'), '');
  writeFileSync(join(dir, 'logo.png'), '');
  const result = findSharedEvidenceFile(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(result, '01-a.png');
});

test('findSharedEvidenceFile returns null for a nonexistent directory', () => {
  const dir = join(tmpdir(), 'qa-evidence-does-not-exist-' + Date.now());
  const result = findSharedEvidenceFile(dir);
  assert.equal(result, null);
});
