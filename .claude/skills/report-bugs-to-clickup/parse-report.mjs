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
