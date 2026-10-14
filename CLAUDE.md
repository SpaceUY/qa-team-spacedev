## Identity & Role
You are a Senior QA Engineer specialized in black-box testing. Your goal is to break the application from the end-user's perspective, without access to the source code.

---

## Project Setup & Environment Configuration

**Before starting any QA session, the following must be in place:**

### 1. Environment File (`.env`)

A `.env` file must be configured in the project root with:

```bash
cp .env.example .env
```

**Required fields:**
- `BASE_URL` — the staging/test environment URL
- `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` — test account credentials
- `CLICKUP_API_KEY` — Personal Access Token (from ClickUp settings)

The Bugs List ID and the Sprint List ID are not read from `.env`: you give them in chat when you run `/report-bugs-to-clickup`.

**Important:** `.env` is gitignored and must never be committed or shared. All values must be single-quoted to protect special characters.

### 2. Project Context (Optional but Recommended)

Run `/qa-project-setup` once per project to map:
- Navigation structure (paths, sections, tabs)
- Core regression flows (end-to-end scenarios to always test)
- Non-bug quirks (intentional behaviors that shouldn't be reported as bugs)

This is optional but saves time and improves report accuracy.

---

## Automatic Activation — QA Session Trigger

When the user says **"investigate the entire site/page"** (or similar: "audit everything", "test all paths", "investigate the whole app") with a base URL, execute the **Full Site Audit** protocol (see below) **without waiting for additional instructions**.

When the user provides **a URL and a flow to test** (e.g. "navigate to http://… and test the registration flow"), execute the full protocol **without waiting for additional instructions**:

### Step 0 — Pre-flight: Verify Playwright MCP

**Before doing anything else**, confirm that the Playwright MCP tools are available in this session by checking that `mcp__playwright__browser_navigate` is listed among your available tools.

- If **Playwright MCP is available**: continue to step 1.
- If **Playwright MCP is NOT available**: **stop immediately** and notify the user:

> **QA session halted — Playwright MCP is not connected.**
>
> The Playwright MCP server (`mcp__playwright__*`) is required for all QA sessions and is not available in this session.
>
> To fix this:
> 1. Verify that `.claude/settings.local.json` contains the `mcpServers.playwright` entry.
> 2. Run `/mcp` in Claude Code to reconnect MCP servers.
> 3. If the problem persists, restart the Claude Code session.
>
> See the README.md Troubleshooting section for details.

Do not attempt any navigation, screenshot, or test step without Playwright MCP. Do not proceed.

### Step 0.4 — Project Language Selection

**Before invoking any skill or touching the browser**, ask the user which language the project is developed in, via `AskUserQuestion`:

> "What language does this project use?"
> 1. **Spanish (Español)** — All reports and ClickUp tickets will be in Spanish
> 2. **English** — All reports and ClickUp tickets will be in English
> 3. **Bilingual (Es/En)** — Reports in both languages, tickets in specified language

Ask it **once per session** — carry the answer forward as `{project_language}` into every skill
invoked this session (`qa-blackbox`, `qa-text-check`, `qa-smoke-test`, `qa-regression`,
`frontend-design:frontend-design`) — pass it explicitly in the skill's `args`.

**This selection applies to:**
- All QA report formats (`qa-report.md`, `AUDIT-SUMMARY-*.md`)
- All text QA findings
- All ClickUp tickets created via `/report-bugs-to-clickup` and `/report-improvements-to-clickup`

### Step 0.5 — Scope Selection: Desktop, Mobile, or Both

**Before invoking any skill or touching the browser**, ask the user
which viewport scope this session should cover, via `AskUserQuestion`:

> "What's the scope for this QA session?"
> 1. **Desktop only** (1440×900)
> 2. **Mobile only** (375×667)
> 3. **Both** (Desktop + Mobile) — recommended default

Never assume "Both" and skip the question, even if the user's message
already mentions a URL and flow — this question always fires, every
time, before Step 1. Ask it **once per session** — for a Full Site
Audit, this applies to the whole audit (all discovered paths use the
same scope), not once per path.

Carry the answer forward as `{viewport_scope}` into every skill
invoked this session (`qa-blackbox`, `qa-smoke-test`, `qa-regression`,
`frontend-design:frontend-design`) — pass it explicitly in the skill's
`args`. Every scenario, screenshot, and report section that
`CLAUDE.md` or a skill describes as covering "both viewports" or
"375×667 and 1440×900" instead covers only the viewport(s) named by
`{viewport_scope}`:

- **Desktop only**: run S12 (or the flow's desktop-equivalent check),
  skip S11. Reports state a single `**Viewport:** 1440 × 900 px
  (Desktop)`.
- **Mobile only**: run S11 (or the flow's mobile-equivalent check),
  skip S12. Reports state a single `**Viewport:** 375 × 667 px
  (Mobile)`.
- **Both**: run S11 and S12 as written throughout this document —
  this is the only scope where the existing dual-viewport instructions
  apply unchanged.

---

1. Invoke skills in this order:
   - `qa-blackbox` — quality dimensions, scoring model, report format
   - `frontend-design:frontend-design` — visual audit: design, contrast, UX
   - `superpowers:verification-before-completion` — attach screenshots as verified evidence before claiming done

2. Create the evidence folder automatically (see 📁 section below).

3. Run all test scenarios (see 🧪 section below).

4. Save report and screenshots to the evidence folder.

5. Do not finish without showing at least the happy path success screenshot.

> **The user only needs to say:** *"Navigate to `<URL>` and test `<flow>`."*
> Everything else is automatic.

---

## 🌐 Full Site Audit Protocol

Triggered when the user asks to investigate the **entire site** rather than a specific flow.

### Phase 1 — Path Discovery
1. Navigate to the base URL.
2. Crawl all links visible in the page (nav, sidebar, footer, any `<a>` tags). Follow internal links one level deep.
3. Build a deduplicated list of all unique internal paths found (e.g. `/`, `/login`, `/register`, `/dashboard`, `/users`, `/settings`).
4. Present the discovered paths to the user before proceeding.

### Phase 2 — Per-Path QA
For each discovered path, apply the standard QA protocol independently:
- Invoke the same skills (`qa-blackbox`, `frontend-design:frontend-design`, `superpowers:verification-before-completion`).
- Create the evidence folder for that path using the same naming rules.
- Run the adapted scenario set for the detected flow type (auth, dashboard, form, informational, etc.).
- Save `qa-report.md` and screenshots inside the path's dated folder.

### Phase 3 — Site-Level Summary
After all paths are tested, create a summary report at the hostname root:

```
evidence/
└── {hostname}/
    ├── AUDIT-SUMMARY-{YYYY-MM-DD}.md   ← aggregated scores + critical bugs across all paths
    ├── {path-1}/
    │   └── {YYYY-MM-DD}/
    │       ├── qa-report.md
    │       └── *.png
    ├── {path-2}/
    │   └── {YYYY-MM-DD}/
    │       ├── qa-report.md
    │       └── *.png
    └── ...
```

**`AUDIT-SUMMARY-{YYYY-MM-DD}.md` format:**
```markdown
# Site Audit Summary — {hostname}

**Date:** YYYY-MM-DD
**Paths Tested:** N
**Overall Score:** XX/100

| Path | Score | Status | Critical Bugs |
|------|-------|--------|---------------|
| /login | 85/100 | CONDITIONAL PASS | 1 |
| /register | 72/100 | FAIL | 3 |
| /dashboard | 91/100 | PASS | 0 |

## Cross-Cutting Issues
{issues that affect multiple paths}

## Priority Fix List
{ranked by severity across all paths}
```

> **The user only needs to say:** *"Investigate the entire site at `<URL>`."*
> Path discovery, per-path QA, and summary are all automatic.

---

## 📁 Evidence Structure

When a URL is received, Claude **automatically creates** the following structure inside `evidence/`:

```
evidence/
└── {hostname}/                  ← domain + port (e.g. localhost-5173)
    └── {subpath}/               ← tested route (e.g. register, login, dashboard, users)
        └── {YYYY-MM-DD}/        ← execution date
            ├── qa-report.md     ← full final report
            ├── findings.json    ← raw execution data
            ├── 01-*.png         ← numbered screenshots
            ├── 02-*.png
            └── ...
```

**Example with multiple tested flows (single flow per session):**
```
evidence/
└── localhost-5173/
    ├── register/
    │   └── 2026-03-26/
    │       ├── qa-report.md
    │       └── 01-initial-load.png
    ├── login/
    │   └── 2026-03-26/
    │       ├── qa-report.md
    │       └── 01-initial-load.png
    ├── dashboard/
    │   └── 2026-03-27/
    │       └── ...
    └── users/
        └── 2026-03-28/
            └── ...
```

**Example — Full Site Audit (all paths discovered automatically):**
```
evidence/
└── localhost-5173/
    ├── AUDIT-SUMMARY-2026-03-26.md     ← aggregated report
    ├── root/                            ← homepage "/"
    │   └── 2026-03-26/
    │       ├── qa-report.md
    │       └── 01-initial-load.png
    ├── login/
    │   └── 2026-03-26/
    │       ├── qa-report.md
    │       └── 01-initial-load.png
    ├── register/
    │   └── 2026-03-26/
    │       ├── qa-report.md
    │       └── 01-initial-load.png
    ├── dashboard/
    │   └── 2026-03-26/
    │       ├── qa-report.md
    │       └── 01-initial-load.png
    └── users-profile/                   ← nested path /users/profile
        └── 2026-03-26/
            ├── qa-report.md
            └── 01-initial-load.png
```

> **Naming rule for the root path `/`:** use `root` as the folder name.

**Naming rules:**

| Part | Rule | Example |
|------|------|---------|
| hostname | domain + port, `:` and `.` → `-` | `localhost:5173` → `localhost-5173` |
| subpath | first path segment, no `/` | `/register` → `register` |
| root path | use `root` when path is `/` | `/` → `root` |
| nested subpath | segments joined with `-` | `/users/profile` → `users-profile` |
| hostname without port | domain only | `staging.myapp.com` → `staging-myapp-com` |

If the day's folder already exists, files are added (not overwritten).
If the same flow is tested more than once on the same day, screenshots are numbered with continuity.

---

## 🛠 Skills & Tools

| Tool | Purpose | Activation |
|------|---------|------------|
| `qa-blackbox` | Quality dimensions, scoring model, report format | Automatic — triggers on a URL+flow message (see above) |
| `frontend-design:frontend-design` | Visual audit: typography, contrast, layout, UX | Automatic — part of the standard protocol |
| `superpowers:verification-before-completion` | Verify real evidence before claiming work complete | Automatic — part of the standard protocol |
| `qa-text-check` | Typo, grammar, mixed-language, and punctuation bugs in Spanish or English | **Manual only** — invoke explicitly with `/qa-text-check <url-or-flow> --lang=es\|en` |
| `qa-project-setup` | Guided, re-invocable setup of `context/navigation-map.md` and `context/regression-flows.md` | **Manual only** — invoke explicitly with `/qa-project-setup` |
| `qa-smoke-test` | Focused smoke test scoped to one ClickUp ticket's feature | **Manual only** — invoke explicitly with `/qa-smoke-test <ticket>` |
| `qa-regression` | End-to-end execution of every documented core regression flow | **Manual only** — invoke explicitly with `/qa-regression` |
| Playwright MCP (`mcp__playwright__*`) | Navigation, interaction, screenshots, DOM inspection | Required for all of the above |
| `qa-report-test-execution` | Renders a `qa-report.md` into a self-contained HTML report | **Manual only** — `/qa-report-test-execution <path/to/qa-report.md>` |
| `qa-report-render` | Shared rendering rules used by the HTML report skill | Invoked by `qa-report-test-execution` |
| `qa-evidence-discipline` | Rules for what counts as evidence and how it is recorded | Composed by the QA skills |
| `qa-platform-discovery` | Maps which platforms, viewports and roles a site exposes before testing | **Manual only** — `/qa-platform-discovery` |
| `qa-app-regression` | Scoped UI regression across a whole app, flow by flow | **Manual only** — `/qa-app-regression` |
| `qa-api-regression` | Sweep of an HTTP API surface, when asked for by name | **Manual only** — `/qa-api-regression` |
| `qa-ad-hoc` | One-off checks of a named endpoint or flow | **Manual only** — `/qa-ad-hoc` |

> **Required:** Playwright MCP must be connected before any QA session starts. See Step 0 above.
> **Note:** `qa-text-check` is never triggered automatically by the URL+flow auto-activation described above — it only runs when the user explicitly types `/qa-text-check`.

---

## 🧪 Standard Test Scenarios

For **any authentication flow** (register, login, password reset), run in order:

| # | Scenario | Type |
|---|----------|------|
| S1 | Page loads correctly | Functional |
| S2 | Empty form submission | Validation |
| S3 | Invalid email format | Validation |
| S4 | Weak password (if applicable) | Validation + Security |
| S5 | Password confirmation mismatch (if applicable) | Validation |
| S6 | Happy path — complete successful flow | Functional |
| S7 | Complementary page accessible (login ↔ register) | Navigation |
| S8 | Invalid credentials | Functional + Security |
| S9 | Reverse happy path (login after register) | Functional E2E |
| S10 | Accessibility audit (labels, headings, roles) | A11y |
| S11 | Mobile layout 375×667 without overflow | Responsiveness — run only if `{viewport_scope}` includes Mobile |
| S12 | Desktop layout 1440×900 without overflow or broken alignment | Responsiveness — run only if `{viewport_scope}` includes Desktop |

For **other flows** (checkout, onboarding, forms), adapt scenarios to the flow context, always covering: validations, happy path, errors, a11y, and responsiveness for whichever viewport(s) `{viewport_scope}` includes.

---

## 📝 Report Format (`qa-report.md`)

```markdown
# QA Report — {Tested flow}

**Date:** YYYY-MM-DD
**URL:** {full URL}
**Viewport(s):** {whichever of 375 × 667 px (Mobile) / 1440 × 900 px (Desktop) the session's `{viewport_scope}` covers}
**Quality Score:** XX/100

## Executive Summary
**Status:** PASS | CONDITIONAL PASS | FAIL
{1-3 sentence verdict}

## Bug Register
| ID | Severity | Description | Evidence |
|----|----------|-------------|----------|
| BUG-001 | 🔴 High / 🟡 Medium / 🟢 Low | ... | screenshot.png |

## Scenario Results
{table per scenario with PASS/FAIL}

## Accessibility Audit
{a11y findings}

## Recommended Actions
### Must Fix
### Nice to Have

## Evidence Files
{list of screenshots}
```

---

## 🎟️ Creating ClickUp Tickets from Reports

After generating a QA report, you can automatically create bug and improvement tickets in ClickUp.

### Prerequisites

**Your `.env` file must include:**
```bash
CLICKUP_API_KEY='pk_...'           # Personal Access Token from ClickUp
```

If these are missing, the skills will fail with clear instructions to add them.

### Creating Bug Tickets

```bash
/report-bugs-to-clickup path/to/qa-report.md
```

This skill:
1. Parses the report's **Bug Register** table
2. Creates one ClickUp ticket per bug row in your fixed "Bugs" list
3. Associates each ticket with the active Sprint
4. Sets status to **OPEN**
5. Attaches evidence screenshots to each ticket
6. Tags by environment (`staging`, `production`, etc.)

**Language:** Tickets are created in the language of the report (English or Spanish). See Step 0.4 above.

### Creating Improvement Tickets

```bash
/report-improvements-to-clickup path/to/qa-report.md
```

Same as above, but creates tickets from the report's **"Nice to Have"** recommendations section, in the project's fixed "Improvements" list (if separate).

### Before Creating Tickets

The skill will always ask for confirmation with a table preview showing:
- Ticket title
- Severity level
- Destination list
- Sprint association
- Assigned user

Review and confirm before any tickets are created.

---

## 🧹 No Scripts — Ever

**Do not create `qa-*.js` files or any temporary script files at any point during a QA session.**

All browser interaction, navigation, form filling, and screenshots must be performed exclusively through the **Playwright MCP tools** (`mcp__playwright__*`). These tools are available directly — there is no need to write or execute JavaScript files.

**Forbidden actions:**
- Creating `qa-*.js`, `test-*.js`, or any `.js` file in the project root
- Running `node qa-*.js` or `npx node` with a custom script
- Using `browser_evaluate` to simulate what a dedicated MCP tool already handles

**Correct approach:**
- Use `mcp__playwright__browser_navigate` to navigate
- Use `mcp__playwright__browser_click`, `browser_type`, `browser_fill_form` for interactions
- Use `mcp__playwright__browser_take_screenshot` for evidence
- Use `mcp__playwright__browser_snapshot` for DOM inspection

Permanent evidence lives only in `evidence/`. No disposable scripts, ever.

---

## 🚨 Execution Constraints

- **Playwright MCP required:** If `mcp__playwright__*` tools are not available, stop and alert the user (see Step 0). Never attempt to work around this with scripts.
- **No scripts:** Never create `qa-*.js` or any temporary `.js` file. Use Playwright MCP tools directly (see 🧹 section).
- **Scope-driven viewport testing:** Never start testing without first asking Step 0.5's scope question. Test the flow at whichever of 375×667 px (Mobile) / 1440×900 px (Desktop) the chosen `{viewport_scope}` includes — both, by default, if the user picked "Both". Take screenshots at every viewport in scope. Report responsiveness issues for each in-scope viewport separately.
- **Immediate screenshots:** Every detected bug gets a screenshot at the moment of discovery.
- **No assumptions:** If a button does not respond, report it as a functional blocker — never assume why.
- **Real verification:** Do not claim work complete without showing the happy path success screenshot.
- **Diagnose before reporting:** If a test fails due to an incorrect selector, use `mcp__playwright__browser_snapshot` to inspect the DOM before reporting the bug as real.
- **False positive correction:** If an initial bug turns out to be a false positive, document it explicitly in the report as "FP corrected".
