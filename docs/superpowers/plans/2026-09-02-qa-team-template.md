# qa-team Template Repo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `qa-team` into a reusable QA-department template repo: consolidate all first-party skills at the repo root, adapt `qa-blackbox` to read a per-project `context/` folder, add three new skills (`qa-project-setup`, `qa-smoke-test`, `qa-regression`), retire the standalone `qa-agent/` module, and mark the repo as a GitHub Template.

**Architecture:** All of `qa-team`'s own skills move to `.claude/skills/` at the repo root (Claude Code discovers project skills walking up from cwd to the repo root, so any subdirectory a tester starts a session in still sees them — verified against Claude Code's own docs before this plan was written). `qa-agent/CLAUDE.md`'s protocol content and `qa-agent/README.md`'s setup instructions move to the repo root. A new `context/` directory holds the per-project knowledge base (`navigation-map.md`, `regression-flows.md`), filled in by the new `qa-project-setup` skill and consumed by `qa-blackbox`, written to by `qa-smoke-test`, and both read and written by `qa-regression`.

**Tech Stack:** Markdown skill definitions (Claude Code skill format, instructions-only — no executable code in any of the skills this plan touches), OpenKnowledge (`ok init`) for the `context/` project, Playwright MCP and ClickUp MCP (both already configured, just consolidated under one `.claude/settings.local.json`).

## Global Constraints

- **Skill consolidation target:** `qa-blackbox`, `qa-text-check`, `report-bugs-to-clickup`, `report-improvements-to-clickup` — all of `qa-team`'s own skills — end up under a single `.claude/skills/` at the repo root. `frontend-design` and `verification-before-completion` are third-party/plugin skills (per `qa-agent/skills-lock.json`: sources `anthropics/skills` and `obra/superpowers`) and are **not** moved or copied — they continue to be invoked by their existing qualified names (`frontend-design:frontend-design`, `superpowers:verification-before-completion`).
- **`qa-agent/` retirement:** the standalone `qa-agent/` directory is retired. Its `CLAUDE.md` content (standard test scenarios, evidence folder naming rules, "no scripts" rule, full site audit protocol) moves into the repo-root `CLAUDE.md`. Its `README.md` content (prerequisites, Playwright install step, MCP settings setup, troubleshooting) moves into the repo-root `README.md`.
- **Skill visibility from any subdirectory:** Claude Code discovers `.claude/skills/` walking up from the session's cwd to the repository root — this is why consolidating at the root is sufficient; no per-subdirectory duplication or symlinks are needed (spec, "Why skills work from any subdirectory").
- **Three execution scenarios and their `context/` I/O** (spec, "The three execution scenarios"):
  | Scenario | Skill | Reads from `context/` | Writes to `context/` |
  |---|---|---|---|
  | Exploratory | `qa-blackbox` (adapted) | `navigation-map.md` | — |
  | Smoke | `qa-smoke-test` (new) | — (ticket passed at invocation) | `regression-flows.md` (conditionally) |
  | Regression | `qa-regression` (new) | `regression-flows.md` | `regression-flows.md` (last-run history) |
- **`qa-blackbox`'s existing protocol is unchanged** except for one new step: reading `context/navigation-map.md` before running its standard scenarios. Scoring model, standard scenario table, and report format stay exactly as they are today.
- **`qa-smoke-test`'s ticket context is never persisted** in `context/` — always fetched fresh from ClickUp via the ClickUp MCP at invocation time (spec, "Smoke").
- **`qa-smoke-test`'s end-of-run regression sync is mandatory and interactive**, never assumed: after every run, ask the user (via `AskUserQuestion`) to choose Add / Update / Skip regarding `context/regression-flows.md`, and only write on Add or Update (spec, "Smoke" — "End-of-run regression sync").
- **`qa-project-setup` is re-invocable, not one-shot**: running it again edits existing `context/` files rather than overwriting them blindly (spec, "The setup skill").
- **No scripts, ever**: this rule (from `qa-agent/CLAUDE.md` § "🧹 No Scripts — Ever") applies to every skill this plan touches or creates — all browser interaction goes through `mcp__playwright__*` tools directly, never a written `.js` file.
- **Distribution mechanism is a GitHub Template Repository setting**, not a script or CLI tool this plan builds (spec, "Distribution mechanism").

---

### Task 1: Consolidate skills at the repo root — move `qa-blackbox` and `qa-text-check`

**Files:**
- Create: `.claude/skills/qa-blackbox/SKILL.md` (moved from `qa-agent/.agents/skills/qa-blackbox/SKILL.md`, content unchanged in this task — Task 5 adds the `context/` read step)
- Create: `.claude/skills/qa-text-check/SKILL.md` (moved from `qa-agent/.agents/skills/qa-text-check/SKILL.md`, content unchanged)
- Delete: `qa-agent/.agents/skills/qa-blackbox/SKILL.md`
- Delete: `qa-agent/.agents/skills/qa-text-check/SKILL.md`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the two skills at their final root location. Task 5 (qa-blackbox context-reading adaptation) modifies `.claude/skills/qa-blackbox/SKILL.md` in place — that task depends on this one having moved the file there first. Task 8 (CLAUDE.md/README.md consolidation) references both skills by their new root path.

This is a pure file move (`git mv`), not a content rewrite — verify byte-for-byte identity after moving.

- [ ] **Step 1: Move `qa-blackbox`**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
mkdir -p .claude/skills/qa-blackbox
git mv qa-agent/.agents/skills/qa-blackbox/SKILL.md .claude/skills/qa-blackbox/SKILL.md
```

- [ ] **Step 2: Move `qa-text-check`**

```bash
mkdir -p .claude/skills/qa-text-check
git mv qa-agent/.agents/skills/qa-text-check/SKILL.md .claude/skills/qa-text-check/SKILL.md
```

- [ ] **Step 3: Verify byte-for-byte identity and clean empty directories**

```bash
git show HEAD:qa-agent/.agents/skills/qa-blackbox/SKILL.md | diff - .claude/skills/qa-blackbox/SKILL.md
git show HEAD:qa-agent/.agents/skills/qa-text-check/SKILL.md | diff - .claude/skills/qa-text-check/SKILL.md
```

Expected: no output from either `diff` (files identical). If `qa-agent/.agents/skills/` is now empty of these two directories, that's fine — Task 2 will remove the rest of `qa-agent/` (including `frontend-design/` and `verification-before-completion/`, which are NOT moved per the Global Constraints — Task 2 explains what happens to those).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move qa-blackbox and qa-text-check skills to repo-root .claude/skills/"
```

---

### Task 2: Retire `qa-agent/` — merge its `CLAUDE.md` and `README.md` into the repo root

**Files:**
- Create: `CLAUDE.md` (repo root — does not exist yet)
- Modify: `README.md` (repo root)
- Delete: `qa-agent/CLAUDE.md`
- Delete: `qa-agent/README.md`
- Delete: `qa-agent/.agents/` (now empty of skills after Task 1; `frontend-design/` and `verification-before-completion/` inside it are plugin-installed copies, not this repo's own content — see Step 1 below for exactly what to do with them)
- Delete: `qa-agent/skills-lock.json`
- Create: `.claude/settings.local.json.example` (repo root — merges `qa-agent/.claude/settings.local.json.example`'s Playwright MCP config with whatever ClickUp MCP config the root already expects; see Step 4)
- Delete: `qa-agent/.claude/settings.local.json.example`
- Delete: `qa-agent/.gitignore` (its two unique entries, `.playwright-mcp/` and `evidence/`, already exist in the root `.gitignore` — confirm in Step 5 rather than assume)
- Modify: `.gitignore` (repo root) — only if Step 5 finds a genuinely new entry to add

**Interfaces:**
- Consumes: Task 1's moved skill files (this task's new root `CLAUDE.md` references `qa-blackbox` and `qa-text-check` by their new `.claude/skills/` paths, not the old `qa-agent/.agents/skills/` paths).
- Produces: the repo-root `CLAUDE.md` and `README.md` that Tasks 3, 4, 6, 7, 8 will each add a section to. Later tasks append to these files — they do not recreate them.

- [ ] **Step 1: Decide what happens to `frontend-design/` and `verification-before-completion/` — they are plugin-sourced, not moved**

Per `qa-agent/skills-lock.json` (read it before proceeding — `git show HEAD:qa-agent/skills-lock.json`), `frontend-design` came from GitHub source `anthropics/skills` and `verification-before-completion` from `obra/superpowers`. These are the **plugin-installed local copies** Claude Code's skill-plugin mechanism created inside `qa-agent/.agents/skills/` — they are invoked today as `frontend-design:frontend-design` and `superpowers:verification-before-completion` (qualified names), which only resolves correctly if those plugins are installed via Claude Code's own plugin mechanism in the new repo, independent of any file living in this git repo.

Do not `git mv` `qa-agent/.agents/skills/frontend-design/` or `verification-before-completion/` anywhere — they get removed along with the rest of `qa-agent/.agents/` in Step 2, and a tester's Claude Code plugin installation (not this repo) is what makes `frontend-design:frontend-design` and `superpowers:verification-before-completion` resolve in the new template repo, the same way it already does for anyone using `qa-agent/` today.

- [ ] **Step 2: Delete the rest of `qa-agent/.agents/` and `qa-agent/skills-lock.json`**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git rm -r qa-agent/.agents/skills/frontend-design
git rm -r qa-agent/.agents/skills/verification-before-completion
git rm qa-agent/skills-lock.json
```

- [ ] **Step 3: Create the repo-root `CLAUDE.md`**

```bash
git mv qa-agent/CLAUDE.md CLAUDE.md
```

Then update the three skill-path references inside it. Read the file after the move, then apply these three edits (use `Edit`, not a full rewrite — the rest of the file's content is unchanged in this task; Task 5 will separately add a `navigation-map.md`-reading step, and Task 8 will separately add the three new skills to the "🛠 Skills & Tools" table):

1. In the "1. Invoke skills in this order:" list near the top, no path changes needed — it already refers to skills by name (`qa-blackbox`, `frontend-design:frontend-design`, `superpowers:verification-before-completion`), not by file path.
2. Under "📁 Evidence Structure" and everywhere else — no path changes needed, this section doesn't reference skill file paths.
3. Under "🛠 Skills & Tools" — no path changes needed here either (Task 8 adds rows here, doesn't change existing ones).

Since `CLAUDE.md`'s own content references skills by name rather than file path, this move needs **no in-content edits** in this task — confirm this by grepping for the old path fragment:

```bash
grep -n "\.agents/skills" CLAUDE.md
```

Expected: no output (the file never referenced its own skills by path). If this grep finds something, read that line and fix it to refer to the skill by name only, consistent with the rest of the file.

- [ ] **Step 4: Merge `README.md` content and the MCP settings example**

First, look at the current repo-root `.claude/` directory to see what MCP configuration (if any) already exists there for the ClickUp skills:

```bash
find /Users/juliadisarli/Documents/GitHub/qa-team/.claude -maxdepth 1
cat /Users/juliadisarli/Documents/GitHub/qa-team/.claude/settings.json
```

There is currently no root `.claude/settings.local.json.example` — the ClickUp MCP tools used by `report-bugs-to-clickup`/`report-improvements-to-clickup` are provided by `claude.ai`-connector-style MCP servers (`mcp__claude_ai_ClickUp__*`), not a project-local `mcpServers` entry, so nothing needs to be merged in on that side. Create the root example file by copying `qa-agent`'s Playwright entry as-is:

```bash
mkdir -p .claude
git mv qa-agent/.claude/settings.local.json.example .claude/settings.local.json.example
```

Read the moved file's content once to confirm it is exactly the Playwright-MCP-plus-allow-list JSON shown in this plan's research (permissions.allow list, `mcpServers.playwright`) — no edits needed to the file's content itself in this step, since ClickUp MCP tools aren't configured via this mechanism.

Now update `README.md`. Read the current root `README.md` and `qa-agent/README.md` (the latter via `git show HEAD:qa-agent/README.md` since Task 1/Step already may have started moving files — use `git show` to read the pre-move content safely) before editing, then replace the root `README.md`'s content with a merged version that:

- Keeps the existing "QA E2E Toolkit" title, the module comparison table, and the "Reporting bugs to ClickUp" / "Reporting improvements to ClickUp" sections (these are already correct and don't reference `qa-agent/` as a path in a way that breaks — they reference `.claude/skills/report-bugs-to-clickup/`, which is unaffected by this plan).
- Replaces the "Quickstart — qa-agent" section (currently `cd qa-agent`, `cp .claude/settings.local.json.example ...`) with a merged "Quickstart — QA Agent" section using the root paths (no more `cd qa-agent`):

```markdown
## Quickstart — QA Agent

```bash
npx playwright install chromium   # one-time
cp .claude/settings.local.json.example .claude/settings.local.json
claude
```

Then tell Claude: *"Navigate to `<URL>` and test the `<flow>` flow."*

At session start, the following skills should appear in the available
skills banner: `qa-blackbox`, `qa-text-check`, `frontend-design`,
`verification-before-completion`. The first two live in this repo's
`.claude/skills/`; the latter two are Claude Code plugin skills (sourced
from `anthropics/skills` and `obra/superpowers` respectively) — see
`CLAUDE.md` for the full protocol.
```

  Update the module comparison table's `qa-agent/` row to say `Claude Code
  + Playwright MCP black-box QA agent — run from the repo root` instead of
  linking to a `qa-agent/` subdirectory that no longer exists, and remove
  the `[qa-agent/](./qa-agent)` link (there is no longer a `qa-agent/README.md`
  to link to — this repo's own root `README.md` now covers it).
- Adds a "Troubleshooting" section at the end, carrying over `qa-agent/README.md`'s three troubleshooting entries (Playwright MCP not available, skills not showing up, browser not found), each edited to drop the `qa-agent/`-relative framing (e.g. "Verify `.claude/settings.local.json` exists" instead of "Verify `.claude/settings.local.json` exists" — this one doesn't need a path change since `.claude/` is now at the root either way; but "Skills not showing up" changes "Verify the `.agents/skills/` directory exists" to "Verify the `.claude/skills/` directory exists").

Do not yet add the "Running a Text QA Check" section, the future `qa-project-setup`/`qa-smoke-test`/`qa-regression` sections, or the "Project Structure" tree update — those are added by Tasks 6, 7, 8 respectively, once those skills exist, so this task's README isn't describing skills that don't exist yet.

- [ ] **Step 5: Reconcile `.gitignore`**

```bash
diff qa-agent/.gitignore .gitignore
```

`qa-agent/.gitignore` has `.playwright-mcp/`, `evidence/`, `.claude/settings.local.json` — all three already exist in the root `.gitignore`. Expected: `diff` shows only lines that exist in the root file already (no genuinely new entries). If `diff` reveals a real difference, add the missing line(s) to the root `.gitignore` before deleting the child file. Then:

```bash
git rm qa-agent/.gitignore
```

- [ ] **Step 6: Remove the now-empty `qa-agent/` directory**

```bash
find qa-agent -type f
```

Expected: no output (everything under `qa-agent/` has been moved or removed by Tasks 1-2). If any file remains, stop and investigate rather than force-deleting — it may be something this plan didn't account for (e.g. an untracked local file). If empty, git already removed the directory automatically (git doesn't track empty directories) — confirm:

```bash
ls qa-agent 2>&1
```

Expected: `ls: qa-agent: No such file or directory` (or the directory is simply gone from git's perspective once all tracked files are removed).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: retire qa-agent/ module, merge its CLAUDE.md and README.md into repo root"
```

---

### Task 3: Create the `context/` directory scaffold

**Files:**
- Create: `context/README.md`
- Create: `context/navigation-map.md` (empty template, to be filled by `qa-project-setup`)
- Create: `context/regression-flows.md` (empty template, to be filled by `qa-project-setup`)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the file paths `context/navigation-map.md` and `context/regression-flows.md` that Task 5 (`qa-blackbox`), Task 6 (`qa-project-setup`), Task 7 (`qa-smoke-test`), and Task 8 (`qa-regression`) all read and/or write. The exact section headers defined here (Step 2/3) are the contract those later tasks' skills parse against — do not let their wording drift from what's written here.

- [ ] **Step 1: Create `context/README.md`**

```markdown
# Project Context

This directory is this project's OpenKnowledge (OK) content — filled in
once via `/qa-project-setup` and kept up to date as the project changes.
It is what lets the QA execution skills (`qa-blackbox`, `qa-smoke-test`,
`qa-regression`) run without re-discovering the app from scratch every
session.

| File | Filled in by | Read by | Written by |
|------|---------------|---------|------------|
| `navigation-map.md` | `qa-project-setup` | `qa-blackbox` | `qa-project-setup` |
| `regression-flows.md` | `qa-project-setup` | `qa-regression` | `qa-project-setup`, `qa-smoke-test`, `qa-regression` |

If this directory's files are still empty templates, run `/qa-project-setup`
before running any of the execution skills.
```

- [ ] **Step 2: Create the empty `context/navigation-map.md` template**

```markdown
# Navigation Map

<!-- Filled in by /qa-project-setup. Do not delete these section headers —
     qa-blackbox looks for them by name. Re-run /qa-project-setup any time
     the app's structure changes; it edits this file in place rather than
     overwriting it. -->

## Base URL

_(not yet configured — run /qa-project-setup)_

## Site Structure

_(sidebar sections, tabs, and their routes — not yet configured)_

## Test Credentials

_(reference to where test user credentials are stored — never a plaintext
password in this file. Not yet configured.)_

## Known Non-Bug Quirks

_(visual/UX behaviors that are intentional, not bugs — so qa-blackbox
doesn't report them as false positives. Not yet configured.)_
```

- [ ] **Step 3: Create the empty `context/regression-flows.md` template**

```markdown
# Regression Flows

<!-- Filled in by /qa-project-setup and kept current by /qa-smoke-test's
     end-of-run sync and by /qa-project-setup re-runs. Do not delete the
     "## Flow:" heading pattern — qa-regression and qa-smoke-test parse
     flows by that heading. -->

<!--
Each flow follows this template:

## Flow: {Flow Name}

**Steps:**
1. ...
2. ...

**Test data:**
- ...

**Last successful run:** YYYY-MM-DD (or "never run")
-->

_(no flows yet — run /qa-project-setup to add the product's core flows)_
```

- [ ] **Step 4: Commit**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
git add context/
git commit -m "feat: scaffold context/ directory for per-project OK knowledge base"
```

---

### Task 4: Mark `context/` as an OpenKnowledge project and document `ok init`

**Files:**
- Modify: `README.md` (repo root) — add a short "Project Context (OpenKnowledge)" section
- Modify: `.gitignore` (repo root) — add OK's own generated artifacts if `ok init` produces any gitignore-worthy output (verify in Step 1 rather than assume)

**Interfaces:**
- Consumes: Task 3's `context/` directory (this task documents how it becomes an OK project; it does not change Task 3's file contents).
- Produces: documentation that Task 6 (`qa-project-setup`) references when it runs `ok init` as its first action.

This task does NOT run `ok init` itself — a template repo should ship with `context/` as plain, uninitialized Markdown (so a fresh clone starts clean), and `qa-project-setup` (Task 6) is what runs `ok init` for a specific new project the first time it's used. This task only documents the mechanism so a tester understands what's about to happen when they run `qa-project-setup`.

- [ ] **Step 1: Confirm what `ok init` would add, without actually running it**

Read the `open-knowledge-discovery` skill's description of `ok init` (already loaded once in this session's history — re-read via `Skill` tool if unavailable) to confirm: it scaffolds a `.ok/` directory, wires the OK MCP server into detected editors, and installs a project-local runtime skill at `.claude/skills/open-knowledge/`. None of this should be committed into the **template** repo itself — `.ok/` and the project-local `open-knowledge` runtime skill are meant to be created fresh in each tester's own project repo (created from the template), not baked into the template.

Add `.ok/` to the root `.gitignore` **only if** the template repo itself should never accidentally commit one (defensive — in case someone runs `ok init` locally while testing the template before it's used to create a real project repo):

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
grep -n "^\.ok/" .gitignore
```

If no match, add it:

```bash
echo ".ok/" >> .gitignore
```

- [ ] **Step 2: Add the "Project Context (OpenKnowledge)" section to `README.md`**

Insert this section after the "Quickstart — QA Agent" section (added in Task 2) and before "Quickstart — e2e-tests":

```markdown
## Project Context (OpenKnowledge)

This repo's `context/` directory is an [OpenKnowledge](https://github.com/inkeep/open-knowledge)
project once initialized. The first time you use a project repo created
from this template, run `/qa-project-setup` — it runs `ok init` for you
and then walks you through filling in `context/navigation-map.md` and
`context/regression-flows.md` with your project's specifics.

You do not need to run `ok init` yourself, and this template repo does
not ship with `.ok/` already created — `qa-project-setup` creates it the
first time, scoped to your new project repo.
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: document context/ as an OpenKnowledge project, deferred to qa-project-setup"
```

---

### Task 5: Adapt `qa-blackbox` to read `context/navigation-map.md`

**Files:**
- Modify: `.claude/skills/qa-blackbox/SKILL.md`

**Interfaces:**
- Consumes: `context/navigation-map.md`'s section headers from Task 3 (`## Base URL`, `## Site Structure`, `## Test Credentials`, `## Known Non-Bug Quirks`) — this task's new step must reference those exact headers.
- Produces: nothing new consumed by later tasks — this is the last modification to `qa-blackbox` in this plan.

This is the ONLY change to `qa-blackbox` in this entire plan — its scoring model, standard scenario table (S1-S12), and report format are unchanged (Global Constraints).

- [ ] **Step 1: Read the current file and locate the insertion point**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
cat -n .claude/skills/qa-blackbox/SKILL.md | head -30
```

The file (moved intact by Task 1) starts with frontmatter, then `# qa-blackbox — Black-Box Browser QA`, then `You are a Senior QA Engineer...`, then `## Quality Dimensions & Scoring`. There is no existing "pre-flight" or "read context" step inside this file today — the Playwright MCP pre-flight check and the context-reading step both live in the **caller** (`CLAUDE.md`'s "Automatic Activation" section), not inside `qa-blackbox/SKILL.md` itself, per how `qa-agent/CLAUDE.md`'s "1. Invoke skills in this order" list works.

- [ ] **Step 2: Add a "Reading Project Context" section right after the opening paragraph, before "Quality Dimensions & Scoring"**

```markdown
---

## Reading Project Context

Before running any scenario, check `context/navigation-map.md` (relative
to the repo root — use `AskUserQuestion` or state the assumption
explicitly if you're unsure of the repo root from your current working
directory):

- If the file still reads as the empty template (its `## Base URL`
  section says "not yet configured"), tell the user to run
  `/qa-project-setup` first, and ask whether to proceed anyway with a
  cold-start session (no persisted navigation map) or stop and wait.
- If it's filled in, use its `## Base URL`, `## Site Structure`, and
  `## Test Credentials` sections to know what to visit and which test
  user to log in as (never invent or guess credentials — if the
  reference points to a secrets manager or vault, tell the user which
  secret to retrieve rather than trying to access it yourself).
- Cross-check anything you're about to report as a bug against the
  `## Known Non-Bug Quirks` section first — if it's listed there, do not
  report it; treat it as confirmed-intentional behavior.

This step does not replace or skip Step 0's Playwright MCP pre-flight
check (see `CLAUDE.md`) — it happens after Playwright MCP is confirmed
available, before Scenario S1.
```

- [ ] **Step 3: Verify the edit didn't disturb anything else**

```bash
grep -n "^## " .claude/skills/qa-blackbox/SKILL.md | head -10
```

Expected: `## Reading Project Context` now appears as the first `##` heading, immediately followed by `## Quality Dimensions & Scoring` (unchanged), then the rest of the file's existing headings in their original order.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/qa-blackbox/SKILL.md
git commit -m "feat: qa-blackbox reads context/navigation-map.md before running scenarios"
```

---

### Task 6: Create the `qa-project-setup` skill

**Files:**
- Create: `.claude/skills/qa-project-setup/SKILL.md`

**Interfaces:**
- Consumes: `context/navigation-map.md` and `context/regression-flows.md`'s template structure from Task 3 (this skill fills in those exact section headers, and must recognize them as already present vs. still-empty on re-invocation).
- Produces: the skill itself, invoked as `/qa-project-setup`. Task 9 (README/CLAUDE.md final consolidation) references this skill by name.

- [ ] **Step 1: Write the SKILL.md**

```markdown
---
name: qa-project-setup
description: Guided, re-invocable setup that fills in this project's context/navigation-map.md and context/regression-flows.md, and runs `ok init` the first time. Invoke manually when starting a new project repo, or again any time the app's structure or core flows change.
user-invocable: true
allowed-tools: Read, Write, Edit, AskUserQuestion, Bash
---

# qa-project-setup — Guided Project Context Setup

You fill in this repo's `context/` directory — `navigation-map.md` and
`regression-flows.md` — through a short, one-question-at-a-time
conversation, the same discipline as a brainstorming session: don't ask
several things in one message, and don't guess an answer the user hasn't
given you. This is manual, on-demand: only run it when the user
explicitly invokes `/qa-project-setup`.

**Re-invocable.** This is not one-shot setup. Running it again later (a
new site section shipped, a regression flow's steps changed) edits the
existing files in place — it never blindly overwrites content that's
already there. Always read the current file content first and decide,
file by file, whether it's empty-template or already-filled before
deciding whether to ask "let's fill this in" or "what do you want to
add/change".

## Step 1 — Initialize OpenKnowledge, if not already done

Check whether `.ok/` exists at the repo root:

```bash
test -d .ok && echo "OK_EXISTS" || echo "OK_MISSING"
```

- If `OK_MISSING`: run `ok init` (or `npx @inkeep/open-knowledge init` if
  `ok` isn't on PATH) from the repo root, then continue.
- If `OK_EXISTS`: skip straight to Step 2 — this is a re-run.

If the `ok`/`npx` command fails (e.g. no internet access, Node.js not
installed), tell the user exactly what failed and stop — do not attempt
to hand-write `.ok/`'s internals yourself.

## Step 2 — Fill in or update `context/navigation-map.md`

Read `context/navigation-map.md` first. For each of its four sections
(`## Base URL`, `## Site Structure`, `## Test Credentials`,
`## Known Non-Bug Quirks`), check whether it still holds the empty
template placeholder text (e.g. "not yet configured") or already has
real content.

For each section that's still a placeholder, ask the user (one question
at a time, via `AskUserQuestion` where the answer is a clear choice, or
a direct question when it's open-ended free text):

1. **Base URL**: "What's the base URL for this project? (e.g.
   `https://staging.example.com`)"
2. **Site Structure**: "What are the main sidebar sections or tabs, and
   their routes? (e.g. Dashboard → `/dashboard`, Settings → `/settings`)"
3. **Test Credentials**: "Where are test user credentials for this
   project kept? (Never paste an actual password — give a reference,
   e.g. '1Password vault: QA-Otonomi, entry: staging-test-user'.)" If the
   user tries to paste a real plaintext password, stop them and ask for
   a reference instead — do not write a plaintext credential into this
   file.
4. **Known Non-Bug Quirks**: "Are there any known visual/UX behaviors
   that are intentional, not bugs, that qa-blackbox should not report?
   (e.g. 'sidebar collapses on mobile by design'). If none, say so —
   it's fine to leave this section explicitly empty."

For each section that already has real content, ask instead: "Section X
already has: `<current content>`. Do you want to update it, or leave it
as-is?" — only touch what the user asks to change.

Write each answer into the corresponding section of
`context/navigation-map.md` using `Edit`, replacing only that section's
placeholder or prior content — never rewrite the whole file from
scratch, since a re-run must preserve untouched sections exactly.

## Step 3 — Fill in or update `context/regression-flows.md`

Read `context/regression-flows.md` first. If it still has no `## Flow:`
entries (just the empty-state placeholder text), ask: "What are this
product's core end-to-end flows — the ones that should always be
regression-tested? Let's add them one at a time. What's the first one?"

For each flow the user describes, ask follow-up questions one at a time
to capture:
- **Flow name** (short, e.g. "Registration → First Purchase")
- **Steps** (numbered, end-to-end)
- **Test data** (any reusable values needed to run it — a test card
  number, a valid test address, etc. — same credential-safety rule as
  Step 2: references to where sensitive test data lives, not real
  secrets pasted into this file)

Write each flow as a new `## Flow: {name}` section (matching the
template's exact heading pattern from `context/regression-flows.md`'s
own template comment), with `**Steps:**`, `**Test data:**`, and
`**Last successful run:** never run` — the run-date field is only ever
updated by `qa-regression`, never by this skill.

Keep asking "Any more core flows to add?" until the user says no.

If the file already has flows, ask: "This project already has N
regression flows: `<list their names>`. Do you want to add a new one,
update an existing one, or are we done?" and loop accordingly.

## Step 4 — Summary

Once done, show the user a short summary of what's now in
`context/navigation-map.md` (filled sections vs. still-empty ones) and
`context/regression-flows.md` (flow count and names), and tell them
they're ready to run `qa-blackbox`, `qa-smoke-test`, or `qa-regression`.

## Constraints

- Never write a plaintext credential or secret into `context/` — always
  a reference to where it's stored.
- Never overwrite a section the user didn't ask to change.
- Never fabricate a flow, URL, or credential reference the user didn't
  actually provide — leave a section as its explicit placeholder rather
  than guessing.
```

- [ ] **Step 2: Verify frontmatter and structure**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
head -6 .claude/skills/qa-project-setup/SKILL.md
grep -c "^## Step" .claude/skills/qa-project-setup/SKILL.md
```

Expected: frontmatter has `name: qa-project-setup`, `user-invocable: true`, `allowed-tools: Read, Write, Edit, AskUserQuestion, Bash`; exactly 4 `## Step` headings.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-project-setup/SKILL.md
git commit -m "feat: add qa-project-setup skill for guided context/ setup"
```

---

### Task 7: Create the `qa-smoke-test` skill

**Files:**
- Create: `.claude/skills/qa-smoke-test/SKILL.md`

**Interfaces:**
- Consumes: ClickUp MCP tools already available in this repo (`mcp__claude_ai_ClickUp__clickup_get_task`, per the naming convention visible in this session's available ClickUp tools); `context/regression-flows.md`'s `## Flow:` heading pattern from Task 3, which this skill's end-of-run sync writes into using the identical format `qa-project-setup` (Task 6) uses.
- Produces: the skill itself, invoked as `/qa-smoke-test <ticket>`. Task 9 references it by name.

- [ ] **Step 1: Write the SKILL.md**

```markdown
---
name: qa-smoke-test
description: Focused smoke test of one ClickUp ticket's feature — fetches ticket context fresh from ClickUp, runs a scoped set of checks against that feature, and offers to add/update the tested flow in context/regression-flows.md. Invoke manually with a ticket link or ID.
user-invocable: true
allowed-tools: Read, Write, Edit, AskUserQuestion, mcp__claude_ai_ClickUp__clickup_get_task, mcp__claude_ai_ClickUp__clickup_search
---

# qa-smoke-test — Focused Smoke Test from a ClickUp Ticket

You run a focused smoke test scoped to one ClickUp ticket's feature —
not `qa-blackbox`'s full protocol. This is manual, on-demand: only run
it when the user explicitly invokes `/qa-smoke-test <ticket link or ID>`.

## Step 0 — Pre-flight: verify Playwright MCP

Same check as `qa-blackbox` and `qa-text-check`: confirm
`mcp__playwright__browser_navigate` is available before doing anything
else. If not, stop immediately and tell the user, same message pattern
as `CLAUDE.md`'s Step 0 ("Text QA halted" style, adapted: "**Smoke test
halted — Playwright MCP is not connected.**").

## Step 1 — Fetch the ticket, fresh, every time

Take the ticket link or ID the user gave when invoking this skill.
Resolve it to a ClickUp task ID (parse it out of a URL if given as a
link) and call `mcp__claude_ai_ClickUp__clickup_get_task` to fetch its
current title, description, and acceptance criteria.

**Never cache or persist this ticket content in `context/` or anywhere
else in this repo.** A ticket's content is a moving target during a
sprint — always re-fetch it fresh on every invocation, even for the same
ticket ID re-run minutes apart.

If the ticket can't be found or the ClickUp MCP call fails, tell the
user the exact error and stop — do not guess at what the feature might
be from the ticket ID alone.

## Step 2 — Scope the smoke test to the ticket's feature

From the ticket's title/description/acceptance criteria, identify:
- Which screen(s)/route(s) the feature lives on (ask the user if the
  ticket doesn't make this obvious — don't guess a URL).
- What the acceptance criteria say should work.

Optionally check `context/navigation-map.md` for the base URL and site
structure, the same way `qa-blackbox` does — this skill benefits from
that context too, but does not require it to be filled in (a smoke test
can proceed with a URL the user provides directly if `navigation-map.md`
is still an empty template).

Run a focused set of checks against just this feature: does it match
each acceptance criterion, does the happy path work, and a light pass on
obvious validation/error cases directly related to the ticket — not the
full S1-S12 standard scenario set `qa-blackbox` runs. Take evidence
screenshots the same way `qa-blackbox` does (one per finding, following
the same `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/` convention from
`CLAUDE.md` § "📁 Evidence Structure").

## Step 3 — Report findings

Summarize to the user: which acceptance criteria passed/failed, any bugs
found (with evidence), and an overall smoke-test verdict (PASS /
CONDITIONAL PASS / FAIL) — same three-way verdict vocabulary
`qa-blackbox` uses, for consistency.

## Step 4 — End-of-run regression sync (mandatory, every run)

Regardless of the Step 3 verdict, ask the user via `AskUserQuestion`:

> "Should this flow be added to, or update, the project's regression
> set (`context/regression-flows.md`)?"

with exactly these three options:

1. **Add as a new flow** — this ticket introduced a feature that should
   now be part of ongoing regression testing.
2. **Update an existing flow** — this ticket changed a step, a test data
   value, or a URL for a flow that's already documented there.
3. **Skip** — this ticket doesn't warrant a regression-flows change.

Never skip asking this, even if the smoke test found no bugs or the
ticket seems minor — let the user decide, don't decide for them.

- If **Add**: read `context/regression-flows.md`, then append a new
  `## Flow: {name}` section (ask the user for a short flow name) with
  `**Steps:**` (derived from what you actually exercised during the
  smoke test in Step 2), `**Test data:**` (any values you used), and
  `**Last successful run:** {today's date}` if the smoke test passed, or
  `**Last successful run:** never run` if it didn't. Use the exact same
  heading format `qa-project-setup` uses, so `qa-regression` can parse
  it identically regardless of which skill wrote it.
- If **Update**: ask the user which existing `## Flow:` entry to update,
  read its current content, and use `Edit` to change only what the user
  says changed (a step, a test-data value, a URL) — never rewrite the
  whole entry from scratch.
- If **Skip**: do nothing further to `context/regression-flows.md`.

## Constraints

- Never persist ClickUp ticket content into `context/` — always fetch
  fresh (Step 1).
- Never skip the Step 4 regression-sync question.
- Never fabricate acceptance criteria not actually present on the
  ticket.
- Never write a plaintext credential or secret into `context/` — same
  rule as `qa-project-setup`.
```

- [ ] **Step 2: Verify frontmatter and structure**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
head -6 .claude/skills/qa-smoke-test/SKILL.md
grep -c "^## Step" .claude/skills/qa-smoke-test/SKILL.md
grep -n "AskUserQuestion" .claude/skills/qa-smoke-test/SKILL.md
```

Expected: frontmatter has `name: qa-smoke-test`, `allowed-tools` includes `mcp__claude_ai_ClickUp__clickup_get_task`; exactly 5 `## Step` headings (0 through 4); the mandatory Step 4 question is present.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-smoke-test/SKILL.md
git commit -m "feat: add qa-smoke-test skill with mandatory regression-flows sync"
```

---

### Task 8: Create the `qa-regression` skill

**Files:**
- Create: `.claude/skills/qa-regression/SKILL.md`

**Interfaces:**
- Consumes: `context/regression-flows.md`'s `## Flow:` heading pattern (from Task 3's template, written to by Task 6's `qa-project-setup` and Task 7's `qa-smoke-test`) — this skill must parse the identical heading format those two skills write.
- Produces: the skill itself, invoked as `/qa-regression`. Task 9 references it by name.

- [ ] **Step 1: Write the SKILL.md**

```markdown
---
name: qa-regression
description: Executes every flow documented in context/regression-flows.md end-to-end, and updates each flow's last-successful-run date. Invoke manually to run a full regression pass.
user-invocable: true
allowed-tools: Read, Write, Edit, AskUserQuestion
---

# qa-regression — Core Flow Regression Testing

You execute every flow documented in `context/regression-flows.md`,
end-to-end, using each flow's own steps and test data. This is manual,
on-demand: only run it when the user explicitly invokes `/qa-regression`.

## Step 0 — Pre-flight: verify Playwright MCP

Same check as `qa-blackbox`, `qa-text-check`, and `qa-smoke-test`:
confirm `mcp__playwright__browser_navigate` is available before doing
anything else. If not, stop immediately with the same halted-session
message pattern as the other skills' Step 0 ("**Regression run halted —
Playwright MCP is not connected.**").

## Step 1 — Load the regression flows

Read `context/regression-flows.md`. If it has no `## Flow:` entries yet
(just the empty-state placeholder), tell the user to run
`/qa-project-setup` first to add core flows, and stop — there is nothing
to regress against.

If it has flows, list them to the user before starting (name and last
successful run date for each), and ask whether to run all of them or a
subset (`AskUserQuestion`, multi-select from the flow names found).

## Step 2 — Execute each selected flow

For each flow, in order:

1. Follow its `**Steps:**` exactly, using its `**Test data:**` values.
   Take an evidence screenshot at the happy-path completion of the flow,
   and at the moment any step fails, following the same
   `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/` convention as the other
   skills (`CLAUDE.md` § "📁 Evidence Structure"). Use the flow's name,
   slugified, as the `{subpath}` segment.
2. If a step fails, record it as a bug (same severity vocabulary as
   `qa-blackbox`: 🔴 High / 🟡 Medium / 🟢 Low) and continue to the next
   flow — one flow's failure does not abort the rest of the regression
   run.
3. If a step's test data looks stale or invalid in a way that looks like
   a data problem rather than an app bug (e.g. a test card number that's
   now expired), flag this distinctly from a real bug — note it as
   "test data may need updating" in the final report, not as a product
   defect.

## Step 3 — Update last-run history

For every flow that was run (whether it passed or failed), use `Edit` to
update that flow's `**Last successful run:**` line in
`context/regression-flows.md`:

- If the flow passed end-to-end: set it to today's date.
- If the flow failed at any step: leave the previous
  `**Last successful run:**` value unchanged (a failed run is not a
  successful run) — but mention the failure and today's date in the
  final report to the user instead.

Only edit the specific flow entries that were actually run in this
session — never touch a flow's entry that wasn't part of this run's
selection.

## Step 4 — Final report

Summarize per flow: PASS/FAIL, any bugs found (with evidence), and any
"test data may need updating" flags. Call out any flow whose last
successful run (before this session) was more than 30 days ago, so a
long-neglected flow is visible even if this run didn't cover it.

## Constraints

- Never skip a flow's documented steps or improvise a shortcut through
  it — the flow's whole value is that it's the same steps every time.
- Never mark a flow's last-successful-run date as updated unless it
  actually passed end-to-end in this session.
- Never modify a flow's `**Steps:**` or `**Test data:**` content — that's
  `qa-project-setup`'s and `qa-smoke-test`'s job, not this skill's. This
  skill only reads steps/test-data and writes the last-run date.
```

- [ ] **Step 2: Verify frontmatter and structure**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
head -6 .claude/skills/qa-regression/SKILL.md
grep -c "^## Step" .claude/skills/qa-regression/SKILL.md
```

Expected: frontmatter has `name: qa-regression`; exactly 5 `## Step` headings (0 through 4).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-regression/SKILL.md
git commit -m "feat: add qa-regression skill for end-to-end core flow regression"
```

---

### Task 9: Final documentation consolidation — `CLAUDE.md`, `README.md`, and the GitHub Template setting

**Files:**
- Modify: `CLAUDE.md` (repo root) — add the three new skills to "🛠 Skills & Tools"
- Modify: `README.md` (repo root) — add sections for the three new skills, update "Project Structure" tree, add the tester workflow

**Interfaces:**
- Consumes: all skill names and paths from Tasks 1, 6, 7, 8.
- Produces: nothing consumed by later tasks — this is the last content task before Task 10's live verification.

- [ ] **Step 1: Update `CLAUDE.md`'s "🛠 Skills & Tools" table**

Find the table (moved intact by Task 2, still reading `| qa-text-check | ... |` as its last skill row before the Playwright MCP row):

```markdown
| `qa-text-check` | Typo, grammar, mixed-language, and punctuation bugs in Spanish or English | **Manual only** — invoke explicitly with `/qa-text-check <url-or-flow> --lang=es\|en` |
| Playwright MCP (`mcp__playwright__*`) | Navigation, interaction, screenshots, DOM inspection | Required for all of the above |
```

Insert three new rows between them:

```markdown
| `qa-text-check` | Typo, grammar, mixed-language, and punctuation bugs in Spanish or English | **Manual only** — invoke explicitly with `/qa-text-check <url-or-flow> --lang=es\|en` |
| `qa-project-setup` | Guided, re-invocable setup of `context/navigation-map.md` and `context/regression-flows.md` | **Manual only** — invoke explicitly with `/qa-project-setup` |
| `qa-smoke-test` | Focused smoke test scoped to one ClickUp ticket's feature | **Manual only** — invoke explicitly with `/qa-smoke-test <ticket>` |
| `qa-regression` | End-to-end execution of every documented core regression flow | **Manual only** — invoke explicitly with `/qa-regression` |
| Playwright MCP (`mcp__playwright__*`) | Navigation, interaction, screenshots, DOM inspection | Required for all of the above |
```

- [ ] **Step 2: Add "Running Smoke Tests", "Running Regression Tests", and "Setting Up a New Project" sections to `README.md`**

Insert these three sections after "Running a Text QA Check" (from Task 2's merged README) and before "Project Structure":

```markdown
## Setting Up a New Project

The first time you use a project repo created from this template, run:

> `/qa-project-setup`

Claude will run `ok init` if needed, then walk you through filling in
`context/navigation-map.md` (base URL, site structure, test credentials
reference, known non-bug quirks) and `context/regression-flows.md`
(this product's core end-to-end flows). Re-run it any time the app's
structure or core flows change — it edits existing content, it doesn't
overwrite it.

## Running Smoke Tests

For a specific ClickUp ticket, invoke:

> `/qa-smoke-test <ticket link or ID>`

Claude fetches the ticket fresh from ClickUp, runs a focused set of
checks scoped to that ticket's feature (not the full `qa-blackbox`
protocol), and — at the end of every run — asks whether this flow should
be added to or update `context/regression-flows.md`, so the regression
set stays current as features ship.

## Running Regression Tests

To execute every documented core flow end-to-end:

> `/qa-regression`

Claude reads `context/regression-flows.md`, runs each flow's steps with
its test data, records any bugs found, and updates each passing flow's
last-successful-run date.
```

- [ ] **Step 3: Update the "Project Structure" tree in `README.md`**

Replace the tree (whatever Task 2 left it as, describing the merged root layout) with the final structure:

```markdown
## Project Structure

```
qa-team/
├── .claude/
│   ├── skills/
│   │   ├── qa-blackbox/SKILL.md
│   │   ├── qa-text-check/SKILL.md
│   │   ├── qa-project-setup/SKILL.md
│   │   ├── qa-smoke-test/SKILL.md
│   │   ├── qa-regression/SKILL.md
│   │   ├── report-bugs-to-clickup/
│   │   └── report-improvements-to-clickup/
│   ├── settings.local.json.example   # copy to settings.local.json
│   └── settings.local.json           # gitignored, created locally
├── context/                           # this project's OK knowledge base
│   ├── README.md
│   ├── navigation-map.md
│   └── regression-flows.md
├── e2e-tests/                         # traditional Playwright Test suite (unchanged)
├── evidence/                          # gitignored — screenshots and reports
├── docs/superpowers/                  # specs and plans (this document's own home)
├── CLAUDE.md
└── README.md
```
```

- [ ] **Step 4: Mark the repo as a GitHub Template**

This is a one-time GitHub repo setting, not a file change — it cannot be done via `git`. Add a note to `README.md`'s top (right after the title, before the module comparison table) so future maintainers know this setting matters:

```markdown
> This repo is a GitHub **Template repository**. To start a new
> project, use GitHub's "Use this template" button (or
> `gh repo create --template <owner>/qa-team <new-repo-name>`) — don't
> fork or clone-and-reinit by hand.
```

Then tell the user in your final report for this task that they still need to manually enable "Template repository" in this repo's GitHub Settings (Settings → General → Template repository checkbox) — this plan cannot do that via `git` commands, and it's a one-time setting on the repo itself, not something committed in a file.

- [ ] **Step 5: Verify**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
grep -n "qa-project-setup\|qa-smoke-test\|qa-regression" CLAUDE.md README.md
```

Expected: multiple matches in both files, covering the table row (CLAUDE.md) and the dedicated sections + tree entries (README.md) for all three new skills.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: consolidate qa-project-setup, qa-smoke-test, qa-regression into CLAUDE.md and README.md"
```

---

### Task 10: Verification pass — confirm the restructured repo is internally consistent

**Files:**
- None created or modified — this task verifies Tasks 1-9's output.

**Interfaces:**
- Consumes: everything from Tasks 1-9.
- Produces: a verification report confirming the repo is in a consistent, usable state. No automated test suite exists for Markdown skill definitions (same situation as the `qa-text-check` plan before this one) — this is a careful re-read and cross-check pass, following `superpowers:verification-before-completion`.

- [ ] **Step 1: Confirm no stale references to `qa-agent/` remain**

```bash
cd /Users/juliadisarli/Documents/GitHub/qa-team
grep -rn "qa-agent" --include="*.md" . | grep -v "docs/superpowers/specs" | grep -v "docs/superpowers/plans"
```

Expected: no output, or only incidental historical mentions that make sense in context (there should be none in `CLAUDE.md`, `README.md`, or any `.claude/skills/*/SKILL.md` — the specs/plans directories are explicitly excluded from this check since they're historical design documents that correctly describe what things looked like *before* this plan, not the current state).

- [ ] **Step 2: Confirm every skill's `allowed-tools` and file path resolve correctly**

```bash
find .claude/skills -name "SKILL.md" | sort
for f in $(find .claude/skills -name "SKILL.md"); do
  echo "--- $f ---"
  head -6 "$f"
done
```

Expected: 7 files listed (`qa-blackbox`, `qa-text-check`, `qa-project-setup`, `qa-smoke-test`, `qa-regression`, `report-bugs-to-clickup`, `report-improvements-to-clickup`), each with valid frontmatter (`name`, `description`, `user-invocable: true`, `allowed-tools`).

- [ ] **Step 3: Confirm `context/` template files have the exact section headers every consuming skill expects**

```bash
grep -n "^## " context/navigation-map.md
grep -n "^## Flow:\|^<!--" context/regression-flows.md
```

Cross-check the `navigation-map.md` output against what `.claude/skills/qa-blackbox/SKILL.md`'s new "Reading Project Context" section (Task 5) names: `## Base URL`, `## Site Structure`, `## Test Credentials`, `## Known Non-Bug Quirks` — all four must be present and spelled identically (case and punctuation) in both places.

- [ ] **Step 4: Confirm `qa-agent/` is fully gone**

```bash
ls qa-agent 2>&1
git log --oneline -1 -- qa-agent
```

Expected: `ls` reports the directory doesn't exist; `git log` shows the last commit that touched anything under `qa-agent/` was one of Task 1's or Task 2's deletion commits (not a stray leftover file added afterward).

- [ ] **Step 5: Confirm the root `README.md`'s Quickstart no longer says `cd qa-agent`**

```bash
grep -n "cd qa-agent" README.md CLAUDE.md
```

Expected: no output.

- [ ] **Step 6: Report results to the user**

Summarize, per `superpowers:verification-before-completion`: results of Steps 1-5, the final skill count and list, and an explicit reminder that (a) enabling "Template repository" in GitHub Settings (Task 9 Step 4) is still a manual step the user must do, and (b) no live Playwright/ClickUp MCP session was run against a real app in this plan — same category of open item as the `qa-text-check` plan's Task 4, left open by design pending a real interactive session, since this plan's implementer has no MCP tools available either.

---

## Self-Review Notes

- **Spec coverage:** Task 1-2 cover the spec's "Repo structure" skill-consolidation and `qa-agent/` retirement. Task 3-4 cover the `context/` scaffold and its OK-project nature (spec: "Repo structure", "The setup skill"'s `ok init` mention). Task 5 covers `qa-blackbox`'s adaptation (spec: "Exploratory"). Task 6 covers `qa-project-setup` (spec: "The setup skill"). Task 7 covers `qa-smoke-test` including the mandatory regression-sync question added by the user after the initial design (spec: "Smoke", "End-of-run regression sync"). Task 8 covers `qa-regression` (spec: "Regression"). Task 9 covers the final documentation consolidation and the GitHub Template setting (spec: "Distribution mechanism"). Task 10 covers verification, required by `superpowers:verification-before-completion`.
- **Placeholder scan:** no TBD/TODO; every step has literal file content or literal commands with expected output. Task 9 Step 4 explicitly flags the one genuinely manual, non-automatable step (GitHub repo setting) rather than pretending a script could do it.
- **Type/name consistency:** the `## Flow:` heading format, the four `navigation-map.md` section headers, and the skill names (`qa-project-setup`, `qa-smoke-test`, `qa-regression`) are used identically across Tasks 3, 5, 6, 7, 8, and verified for drift in Task 10 Step 3.
- **Miscount caught and fixed during self-review:** Task 10 Step 2's file count is 7 (the two moved skills, the three new skills, and the two pre-existing ClickUp skills) — verified consistent with the explicit file list in the same line.
