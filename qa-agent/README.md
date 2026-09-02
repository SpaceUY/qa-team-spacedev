# QA Agent — Playwright MCP + Claude Code

Black-box QA sessions using Claude Code with Playwright MCP. No test
scripts, no project dependencies — all browser interaction goes through
the MCP.

This module lives inside the `qa-e2e-toolkit` monorepo. It has no
`package.json` of its own and does not participate in CI — it's meant for
interactive, human-in-the-loop QA sessions.

---

## Prerequisites

- [Claude Code](https://claude.ai/download) installed and authenticated
- Node.js 18+ (required to run `npx` for the Playwright MCP server)
- Internet access (the MCP server is fetched via `npx @playwright/mcp@latest`)

---

## Step 1 — Install Playwright Browser Binaries

```bash
npx playwright install chromium
```

One-time setup. The MCP server (`@playwright/mcp`) is downloaded
automatically by Claude Code on first use via the config in
`.claude/settings.local.json`.

---

## Step 2 — Set up local MCP settings

```bash
cp .claude/settings.local.json.example .claude/settings.local.json
```

`settings.local.json` is gitignored — it may end up with machine-local
tweaks over time. The example file is the source of truth for what the
project needs.

---

## Step 3 — Start a Claude Code session

```bash
cd qa-agent   # if not already inside this module
claude
```

At session start, the following skills must appear in the available
skills banner:

- `qa-blackbox`
- `frontend-design`
- `verification-before-completion`
- `qa-text-check`

These skills live locally in `.agents/skills/` — no plugin installation
needed. The Playwright MCP (`mcp__playwright__*`) loads automatically from
`.claude/settings.local.json`. Unlike the other three, `qa-text-check`
only runs when explicitly invoked with `/qa-text-check` — it does not
trigger automatically.

---

## What Each Piece Does

| Component | Location | Purpose |
|-----------|----------|---------|
| `qa-blackbox` skill | `.agents/skills/qa-blackbox/` | Quality dimensions, scoring model, report format |
| `frontend-design` skill | `.agents/skills/frontend-design/` | Visual/UX audit: typography, contrast, layout, accessibility |
| `verification-before-completion` skill | `.agents/skills/verification-before-completion/` | Requires real evidence before claiming work complete |
| `qa-text-check` skill | `.agents/skills/qa-text-check/` | Manual-only: typo, grammar, mixed-language, and punctuation bugs (es/en) |
| Playwright MCP | `npx @playwright/mcp@latest` (auto-fetched) | Browser navigation, screenshots, accessibility tree inspection |

---

## Running a QA Session

Just tell Claude:

> Navigate to `<URL>` and test the `<flow>` flow.

Claude will automatically:
1. Verify Playwright MCP is connected
2. Create the evidence folder structure
3. Run all test scenarios
4. Save the report and screenshots

See [`CLAUDE.md`](./CLAUDE.md) for the full protocol (auto-activation
triggers, full-site audit mode, evidence folder naming rules, standard
scenario checklist, report format).

---

## Running a Text QA Check

Unlike `qa-blackbox`, this does **not** run automatically — invoke it
explicitly:

> `/qa-text-check <url-or-flow> --lang=es|en`

Optionally pass `--pages=<screen list>` to name the screens to visit;
otherwise Claude asks which screens or flow to cover. Claude will:
1. Verify Playwright MCP is connected
2. Visit each screen, extract visible UI text, take one evidence
   screenshot per screen, review for issues, and write the report —
   running that entire pipeline as a single background task instead
   of inline when the scope covers more than 5 screens
3. Report only high-confidence typo/grammar/mixed-language/
   punctuation issues
4. Save `text-qa-report.md` (in `report-bugs-to-clickup`'s exact
   4-column Bug Register format) to the same evidence folder
   structure used by `qa-blackbox`

See [`.agents/skills/qa-text-check/SKILL.md`](./.agents/skills/qa-text-check/SKILL.md)
for the full protocol.

---

## Project Structure

```
qa-agent/
├── .agents/
│   └── skills/
│       ├── qa-blackbox/SKILL.md
│       ├── frontend-design/SKILL.md
│       ├── verification-before-completion/SKILL.md
│       └── qa-text-check/SKILL.md
├── .claude/
│   ├── settings.local.json.example   # copy to settings.local.json
│   └── settings.local.json           # gitignored, created locally
├── evidence/                          # gitignored — screenshots and reports
├── skills-lock.json
├── CLAUDE.md
└── README.md
```

---

## Troubleshooting

**Playwright MCP tools (`mcp__playwright__*`) not available — session halted**

Claude Code will refuse to start any QA session if the Playwright MCP is
not connected:

> QA session halted — Playwright MCP is not connected.

Fix checklist:
1. Verify `.claude/settings.local.json` exists and contains the
   `mcpServers.playwright` entry (copy it from `.example` if missing).
2. Run `/mcp` inside Claude Code to reconnect MCP servers without
   restarting.
3. Confirm `npx @playwright/mcp@latest` runs without errors in your
   terminal.
4. If nothing works, close and reopen Claude Code.

Do **not** attempt to work around a missing Playwright MCP by writing
scripts. Claude is configured to refuse this (see `CLAUDE.md`).

**Skills not showing up at session start**

All skills are local files in `.agents/skills/`. If they are missing:
- Verify the `.agents/skills/` directory exists and contains the
  `SKILL.md` files.
- Close and reopen Claude Code — skills load at session start only.

**Browser not found when MCP starts**

```bash
npx playwright install chromium
```
