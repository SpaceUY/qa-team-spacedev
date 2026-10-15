---
name: qa-report-render
description: >-
  Render a QA session or section report as a self-contained HTML page: 'produce
  the report', 'render the audit summary', 'make the HTML report', 'the session
  report needs its visual version'. Owns the report's colour tokens, score cards,
  bug cards, badges and layout, and the rule that the page must open with no
  network. Composed by the QA test skills at the end of a run, after the markdown
  report is written.
user-invocable: true
allowed-tools: Read, Write
---

# QA report rendering

## Prerequisites, inputs, outputs

- **Prerequisites:** a finished `qa-report.md` (written by `qa-report-test-execution`). No network, no browser, no external template file. This skill is the specification of the page.
- **Input:** the path to `qa-report.md`, and its folder (the screenshots are relative to it).
- **Output:** `qa-report.html` in the same folder as `qa-report.md`, for example `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/qa-report.html`. Screenshots stay where they are and are referenced by relative path.
- **Invocation:** called by `qa-report-test-execution` as its last step, so every QA test skill and agent gets it. Can also be run by hand to (re-)render an existing report: `/qa-report-render <path/to/qa-report.md>`.

Every QA run produces two artifacts: the markdown report, which is the record, and the HTML report, which is what people actually open. This skill owns the second.

**This is a fixed template, not a design exercise.** The value of a report that looks identical every time is that a reader learns where to look once. Do not restyle it, do not improve the palette, do not add a chart because the data would suit one.

## Non-negotiables

**Self-contained.** No external stylesheet, script, font, or image. Everything inline. The page must render completely with the network off, because it gets attached to tickets, emailed, and opened months later when the server that served an asset is gone.

**Never ship a raw runner report as the deliverable.** A Playwright HTML report is technical backup. Keep it if useful, but the deliverable is this page with the run's data in it. This is a standing rule; do not ask which format to use.

**The HTML never carries a finding the markdown does not.** It is a rendering, not a second source. If they disagree, the markdown is right and the HTML is stale: re-render it.

**Language follows the session.** Text in the page is in `{project_language}` (Spanish, English or Bilingual), as the markdown is.

## Colour tokens

Define these as custom properties on `:root` and reference them everywhere. Dark theme, deliberately: these reports are read in long sittings.

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#0f1117` | Page background |
| `--surface` | `#1a1d27` | Cards, panels, table headers |
| `--border` | `#2e3347` | Every border and divider |
| `--text` | `#e2e8f0` | Body text |
| `--text-muted` | `#8892a4` | Labels, captions, secondary values |
| `--green` | `#22c55e` | PASS, healthy scores |
| `--red` | `#ef4444` | FAIL, high severity |
| `--yellow` | `#f59e0b` | CONDITIONAL, medium severity, BLOCKED |
| `--blue` | `#3b82f6` | Informational, neutral emphasis |
| `--purple` | `#a78bfa` | Accents, section headings |

**Never hardcode a colour outside this table.** A one-off hex is how a template stops being one.

## Components

Use these classes; do not invent parallel ones.

- **`.container`**: the page wrapper, constraining width so tables stay readable.
- **`.header`**: the report title block, with `.meta` inside it for the run's metadata pairs (`.label` and `.value`).
- **`.score-card`**: the summary grid at the top, holding `.score-item` cells. Each cell takes a state modifier (`.pass`, `.warn`, `.fail`), and the overall score uses `.score-item.total`.
- **`.badge`**: inline status pills, with `.pass`, `.fail`, `.warn`, `.info`. Used in results tables.
- **`.bug-card`**: one card per finding, with `.bug-id` for its identifier and `.detail` for the body.
- **`.tag-row`**: the row of tags on a card or the header.
- **`.note`**: a callout for caveats, blocked scenarios, and corrected false positives.

## Required sections, in this order

1. **Header**: title, date, environment, base URL, organizations or tenants (if any), account used.
2. **Score card**: the summary grid. Overall score, then per-dimension or per-section scores.
3. **Results matrix**: sections against columns. **Columns are the organizations actually found this run** if the app has them; otherwise the viewports in scope. Never a fixed list.
4. **Bug register**: one `.bug-card` per finding, ordered by severity.
5. **Corrected false positives**: as `.note` blocks. **Never omitted when there were any.**
6. **Coverage gaps**: what was not tested, and why.
7. **Evidence**: the screenshots, referenced relative to the report's own folder.

## Rendering the three outcomes

The badge must distinguish all three, because the report is where the distinction survives:

- **PASS** → `.badge.pass`, green.
- **FAIL** → `.badge.fail`, red.
- **BLOCKED** → `.badge.warn`, yellow, **with the missing precondition in the cell or a `.note`**.

A blocked cell rendered as a fail misreports the application; rendered as a pass it hides a hole. Neither is acceptable, and the colour alone will not carry it. Say why it was blocked.

## Screenshots

Reference them **relative to the report's own folder**, and make sure they are in that folder. A report whose images resolve only on the machine that made it stops working the moment anyone else opens it.

Do not inline screenshots as data URIs. They make the page enormous, and the folder already keeps them together.

## Related

- `.claude/skills/qa-report-test-execution/`: writes the markdown this page renders.
- `.claude/skills/qa-blackbox/`: the scoring model the score card shows.
- `.claude/skills/qa-evidence-discipline/`: where the three outcomes and the correction rule come from.
