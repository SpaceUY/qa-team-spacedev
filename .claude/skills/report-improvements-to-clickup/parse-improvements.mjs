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
