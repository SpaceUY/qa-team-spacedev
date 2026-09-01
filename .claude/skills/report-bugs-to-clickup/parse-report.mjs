import path from 'node:path';
import fs from 'node:fs';

const SEVERITY_ICONS = { '🔴': 'High', '🟡': 'Medium', '🟢': 'Low' };

// Returns { severity, unrecognized } — unrecognized is true when the cell didn't match
// a known icon or plain High/Medium/Low word, so the caller can warn without fabricating a value.
function stripSeverityIcon(cell) {
  const trimmed = cell.trim();
  for (const [icon, name] of Object.entries(SEVERITY_ICONS)) {
    if (trimmed.startsWith(icon)) return { severity: name, unrecognized: false };
  }
  // Fallback: cell may already be a plain severity word.
  if (['High', 'Medium', 'Low'].includes(trimmed)) return { severity: trimmed, unrecognized: false };
  // Unrecognized icon/word: strip a leading emoji-like icon (if present) so the reported
  // value is just the word, without inventing a High/Medium/Low value that wasn't there.
  const withoutIcon = trimmed.replace(/^\p{Extended_Pictographic}️?\s*/u, '').trim();
  return { severity: withoutIcon || trimmed, unrecognized: true };
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
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
  const warnings = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break; // table ended
    const cells = splitRow(line);
    if (cells.length < 4) {
      warnings.push(`Skipped malformed row: "${line}"`);
      continue;
    }
    const [id, severityCell, description, evidence] = cells;
    const { severity, unrecognized } = stripSeverityIcon(severityCell);
    if (unrecognized) {
      warnings.push(`Unrecognized severity "${severity}" for row ${id} — expected High, Medium, or Low`);
    }
    bugs.push({
      id,
      severity,
      description,
      evidence,
    });
  }

  if (bugs.length === 0) {
    return { error: 'Bug Register table has no rows.' };
  }

  return { bugs, warnings };
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
    warnings: bugRegisterResult.warnings || [],
  };
}

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
