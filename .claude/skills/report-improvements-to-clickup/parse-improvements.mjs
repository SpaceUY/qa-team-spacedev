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
    const numA = a.match(LEADING_NUMBER_RE) ? parseInt(a.match(LEADING_NUMBER_RE)[1], 10) : Infinity;
    const numB = b.match(LEADING_NUMBER_RE) ? parseInt(b.match(LEADING_NUMBER_RE)[1], 10) : Infinity;
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });

  return imageFiles[0];
}
