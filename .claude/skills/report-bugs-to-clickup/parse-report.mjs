import path from 'node:path';

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
