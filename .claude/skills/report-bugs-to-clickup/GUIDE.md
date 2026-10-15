# report-bugs-to-clickup — User Guide

Convert QA report bugs into ClickUp tickets with complete template structure, evidence screenshots, and proper environment tagging.

## Quick Start

```bash
/report-bugs-to-clickup evidence/staging-example-com/wallets/2026-09-03/qa-report.md
```

Then provide:
1. Your **Bugs List ID** (e.g., `<BUGS_LIST_ID>`) — remembered in this chat for future runs
2. Your current **Sprint List ID** (e.g., `123456789013`) — asked each time (Sprint rotates every 15 days)
3. Who should **own these tickets** (email, username, or "me")

---

## What This Skill Does

1. ✅ Asks for your **Bugs List ID** (remembers it in chat for this conversation)
2. ✅ Asks for your current **Sprint List ID** (each time, as sprint rotates every 15 days)
3. ✅ Asks **who should own these tickets** (you select the assignee, not auto-assigned)
4. ✅ Parses your `qa-report.md`'s **Bug Register** table
5. ✅ Creates one ClickUp ticket per bug in your **Bugs List** (user-provided ID)
6. ✅ Fills the complete template structure:
   - **Precondition:** Initial conditions and environment
   - **Steps to reproduce:** Numbered steps (Step 01, 02, 03...)
   - **Actual result:** Observed behavior with technical details
   - **Expected result:** Desired behavior
   - **Additional information:** Evidence image references + metadata
7. ✅ Attaches evidence screenshots as file attachments
8. ✅ Tags each ticket by environment (`staging`, `production`, `dev`)
9. ✅ Assigns all tickets to the selected assignee (not auto "me")
10. ℹ️ Provides manual instructions for adding to Sprint (manual step)

---

## Template Structure Reference

Every ticket created follows this default ClickUp template:

```
Precondition:
- (Initial conditions, environment setup, prerequisites)

Steps to reproduce:
- Step 01: (First action)
- Step 02: (Second action)
- Step 03: (Third action)
- Step 04: (Fourth action, if needed)

Actual result:
(What you observed, including error messages, API failures, etc.)

Expected result:
(What should happen instead)

Additional information:
![01-desktop-wallets.png](01-desktop-wallets.png)
Original ID: BUG-001 | Severity: High | Reporter: QA Engineer | Date: 2026-09-03
```

**Important:** All sections are filled from the QA report data — nothing is left as a placeholder (`-`).

---

## Step-by-Step Workflow

### Step 1: Prepare Your QA Report

Ensure your `qa-report.md` has a **Bug Register** table:

```markdown
| ID | Severity | Description | Evidence |
|----|----------|-------------|----------|
| BUG-001 | 🔴 High | "coinbase BTC" wallet stuck on loading... | 01-desktop-wallets.png |
| BUG-002 | 🟡 Medium | Multiple wallets also stuck... | 01-desktop-wallets.png |
```

### Step 2: Run the Skill

```bash
/report-bugs-to-clickup <path-to-qa-report.md>
```

Example:
```bash
/report-bugs-to-clickup evidence/staging-example-com/wallets/2026-09-03/qa-report.md
```

### Step 3: Provide Bugs List ID

When prompted, enter your **Bugs List ID** (e.g., `<BUGS_LIST_ID>`).

**Where to find it:**
- Open ClickUp → Your Workspace → Bugs List → Copy the URL/ID
- This will be **remembered in this chat** — on next run, you'll be asked to confirm it

**Example:**
```
Claude: What is the ClickUp ID for your Bugs List?
You: <BUGS_LIST_ID>
Claude: Got it! Using Bugs List <BUGS_LIST_ID>. (I'll remember this for the rest of this chat.)
```

### Step 4: Provide Sprint List ID

When prompted, enter your current **Sprint List ID** (e.g., `123456789013`).

**Where to find it:**
- Open ClickUp → Your Workspace → Current Sprint → Copy the URL/ID
- This is asked **every time** (sprint rotates every 15 days)

**Example:**
```
Claude: What is the ClickUp ID for your current Sprint List?
You: 123456789013
```

### Step 5: Select the Assignee

When prompted, enter who should own these tickets:
- Email address (e.g., `qa.com`)
- Username (e.g., `jane.doe`)
- Or "me" to assign to yourself

**Example:**
```
Claude: Who should these tickets be assigned to?
You: jane.doe
Claude: Resolved to QA Engineer (qa.com)
```

### Step 6: Review & Confirm

The skill shows a confirmation table:

| Title | Severity | Bugs List | Sprint List | Tag | Assignee |
|-------|----------|-----------|-------------|-----|----------|
| [BUG] [Staging] Wallets - "coinbase BTC"... | High | <BUGS_LIST_ID> | 123456789013 | staging | QA Engineer |

**Confirm** to proceed with ticket creation.

### Step 7: Tickets Created ✅

Each ticket is created with:
- ✅ Complete template structure (all sections filled)
- ✅ Environment tag (`staging`, etc.)
- ✅ Evidence screenshot attached
- ✅ Assigned to the selected assignee

**Example result:**
```
✅ BUG-001 created (ID: 86bbvvhqq)
   Evidence: 01-desktop-wallets.png [attached]
   Assigned to: QA Engineer
✅ BUG-002 created (ID: 86bbvvhrx)
   Evidence: 01-desktop-wallets.png [attached]
   Assigned to: QA Engineer
```

### Step 8: Add to Sprint (Manual)

⚠️ **This is a manual step** — the skill provides instructions but does not automate it:

1. Open ticket in ClickUp (e.g., https://app.clickup.com/t/86bbvvhqq)
2. Click **"Add to List"** in the right panel
3. Select your **Sprint List** (`123456789013`)
4. Repeat for each ticket

**Why manual?** The "Tasks in Multiple Lists" ClickApp may not be enabled on your workspace — this way you have full control.

---

## Example: Full Workflow

### Input: QA Report

```markdown
# QA Report — Wallets

**URL:** https://staging.example.com/wallets
**Date:** 2026-09-03

## Bug Register

| ID | Severity | Description | Evidence |
|----|----------|-------------|----------|
| BUG-001 | 🔴 High | "coinbase BTC" wallet balance stuck on "Cargando balance..." indefinitely. Root cause: 400 Bad Request from Blockstream testnet API. No error state shown. | 01-desktop-wallets.png |
| BUG-002 | 🟡 Medium | "Phantom Sepolia" and "Coinbase Wallet" also stuck in same pattern. Broader issue affecting external chain balance fetches. | 01-desktop-wallets.png |
```

### Command

```bash
/report-bugs-to-clickup evidence/staging-example-com/wallets/2026-09-03/qa-report.md
```

### Output: Two ClickUp Tickets Created

**Ticket 1: 86bbvvhqq**
```
Title: [BUG] [Staging] Wallets - "coinbase BTC" wallet balance stuck indefinitely on "Cargando balance..."

Precondition:
- User has multiple wallets connected in the app, including external wallets (Coinbase BTC, Phantom Sepolia, Coinbase Wallet)
- Test environment: https://staging.example.com/wallets

Steps to reproduce:
- Step 01: Navigate to https://staging.example.com/wallets
- Step 02: Observe the wallet balance list displaying connected wallets
- Step 03: Wait for balance data to load for all wallets
- Step 04: Notice that "coinbase BTC" wallet balance gets stuck on "Cargando balance..."

Actual result:
"coinbase BTC" wallet balance remains indefinitely on "Cargando balance..." (loading state never resolves). Root cause: repeated 400 Bad Request responses from Blockstream testnet API endpoint. No error state or retry mechanism shown to user — silent failure.

Expected result:
Wallet balance should load successfully or display a visible error message ("Balance unavailable" or "Retry") instead of an indefinite loading spinner.

Additional information:
![01-desktop-wallets.png](01-desktop-wallets.png)
Original ID: BUG-001 | Severity: High | Reporter: QA Engineer | Date: 2026-09-03

Tag: staging
Assigned to: QA Engineer
Attachment: 01-desktop-wallets.png ✅
```

**Ticket 2: 86bbvvhrx**
```
[Similar structure for BUG-002]
```

### Manual Next Step

```
📌 Add to Sprint (Manual):

Ticket IDs created: 86bbvvhqq, 86bbvvhrx
Sprint List ID: 123456789013

To associate tickets to the sprint:
1. Open each ticket in ClickUp
2. Click "Add to List" in the right panel
3. Select Sprint List (123456789013)
```

---

## Troubleshooting

### "ClickUp MCP is not connected"
- Run `/mcp` in Claude Code to reconnect
- Verify the ClickUp connector is connected to your claude.ai account (it is a claude.ai connector, not a server in `.mcp.json`)
- Restart Claude Code if needed

### "Ticket creation failed"
- Check that the **Bugs List ID** (`<BUGS_LIST_ID>`) exists in your workspace
- Verify your ClickUp API key is valid in `.env`
- Check that tags (`staging`, etc.) exist in your ClickUp space

### "Evidence file not found"
- Verify the filename in the Bug Register matches your actual screenshot file
- Check the evidence file is in the same directory as the `qa-report.md`

### "Sprint association failed"
- This is normal if "Tasks in Multiple Lists" ClickApp is not enabled
- Add tickets to sprint manually (Step 6)
- Or enable the app in ClickUp → Workspace Settings → Apps

---

## Template Structure — Deep Dive

### Precondition
List the initial state needed to reproduce the bug:
- User role, permissions
- Environment (staging, production)
- Connected services (wallets, chains)
- Prerequisite data or setup

**Example:**
```
Precondition:
- User has multiple wallets connected in the app (Tron, Polygon, external)
- Test environment: https://staging.example.com
- External wallet "Coinbase BTC" is in the wallet list
```

### Steps to Reproduce
Numbered, actionable steps in the exact order to trigger the bug:
- Format: `- Step 01:`, `- Step 02:`, etc.
- Each step should be a single, specific action
- Include exact URLs, buttons, or menu paths

**Example:**
```
Steps to reproduce:
- Step 01: Navigate to https://staging.example.com/wallets
- Step 02: Observe wallet list on page load
- Step 03: Wait 5+ seconds for balances to load
- Step 04: Notice "Cargando balance..." never resolves for "coinbase BTC"
```

### Actual Result
What you observed — be specific:
- Exact error messages
- Behavior that shouldn't happen
- Time it took or how long it lasted
- API failures, console errors, etc.

**Example:**
```
Actual result:
"coinbase BTC" wallet shows "Cargando balance..." indefinitely.
Console logs show 3 repeated 400 Bad Request responses from
https://blockstream.info/testnet/api/address/bc1qwymt...
No error message displayed to user.
```

### Expected Result
What should happen instead:
- Correct behavior
- User-facing messaging
- Timeout or error handling

**Example:**
```
Expected result:
Wallet balance loads and displays correctly, or shows a visible error
message like "Balance unavailable — Retry" instead of infinite loading.
```

### Additional Information
Metadata and evidence:
- Image references with markdown syntax: `![filename.png](filename.png)`
- Original bug ID, severity, reporter
- Date tested
- Related tickets or notes

**Example:**
```
Additional information:
![01-desktop-wallets.png](01-desktop-wallets.png)
Original ID: BUG-001 | Severity: High | Reporter: QA Engineer | Date: 2026-09-03
Related: BUG-002 (similar pattern on other wallets)
```

---

## Key Differences from Previous Versions

| Aspect | v1.0 | v2.0 | v3.0 (Current) |
|--------|------|------|----------|
| Bugs List ID | Hardcoded per project | Hardcoded | **Remembered in chat** (user enters once) |
| Assignee | Auto "me" (current user) | Auto "me" | **Manual selection** (always ask) |
| Sprint association | Attempted automated | Manual, post-creation | Manual, post-creation (same) |
| Template sections | Often abbreviated | All fully completed | All fully completed (same) |
| Evidence | Description only | Description + file + markdown | Description + file + markdown (same) |
| Environment tags | Flexible | Strict (`staging`, `production`, `dev`) | Strict (same) |
| Confirmation step | Often skipped | Always shown | Always shown (same) |

---

## Tips for Best Results

1. **Complete the QA Report first:** Ensure your Bug Register has clear, detailed descriptions before running the skill.
2. **Use consistent evidence filenames:** The skill matches filenames exactly — use `01-`, `02-`, etc. format.
3. **Review before confirming:** Always review the confirmation table for accuracy before clicking "Confirm."
4. **Add to sprint immediately:** Don't leave tickets in Bugs List — add to Sprint within the same session.
5. **Tag correctly:** Verify the environment tag matches your actual environment (staging vs. production).

---

## See Also

- [SKILL.md](SKILL.md) — Technical implementation details
- [Project QA README](../../../README.md) — Full QA testing guide
- ClickUp Workspace: https://app.clickup.com/
