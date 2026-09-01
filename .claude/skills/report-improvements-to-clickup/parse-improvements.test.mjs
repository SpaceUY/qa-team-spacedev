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
