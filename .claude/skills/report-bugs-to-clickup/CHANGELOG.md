# Changelog — report-bugs-to-clickup Skill

## Version 3.0 (2026-09-07)

### ✅ Major Updates

#### 1. Bugs List ID Remembered in Chat
- **Before (v2.0):** Hardcoded per project (`<BUGS_LIST_ID>` for ZENDA)
- **Now (v3.0):** User provides Bugs List ID in Step 1 → **remembered for entire conversation**
- **Benefit:** Supports multi-report sessions where same project's Bugs List is used repeatedly
- **Example:** First run asks "What is your Bugs List ID?" → next run in same chat: "Using Bugs List <BUGS_LIST_ID> — correct?" (no re-entry needed)

#### 2. Manual Assignee Selection (No Auto "me")
- **Before (v2.0):** Tickets automatically assigned to logged-in user ("me")
- **Now (v3.0):** Always ask "Who should own these tickets?" in Step 1.5
  - User can select self ("me"), teammate (email/username), or any ClickUp member
  - Resolved via `clickup_resolve_assignees` to get display name and user ID
- **Benefit:** Single skill works for QA teams where different people report bugs
- **Example:** "Who should own these tickets?" → "julia.disarli" → Resolved to "QA Engineer" and included in table

#### 3. Updated Workflow Steps
- **Before:** Step 1 = Sprint List ID → Step 2 = Reporter (QA) resolution → Step 3 = Parse
- **Now:** 
  - Step 1 = Bugs List ID (remembered) + Sprint List ID (each run)
  - Step 1.5 = Assignee selection
  - Step 2 = Parse tickets
  - Step 3 = Confirm
  - Step 4 = Create tickets
  - Step 5 = Final summary

#### 4. Enhanced Final Summary
- Includes `Assigned to: {assigneeDisplayName}`
- Includes `Bugs List ID (for next run): {bugsListId}` (for reference)
- Shows full context for multi-report workflows

---

### 📝 Documentation Updates
- **GUIDE.md:** Step 3 = Bugs List ID, Step 4 = Sprint List ID, Step 5 = Assignee selection
- **SKILL.md:** Step 1 & 1.5 clarified with Bugs List remembering and assignee selection
- **CHANGELOG.md:** This entry

---

### 🔄 User Impact

**First Run (v3.0):**
```
Claude: What is the ClickUp ID for your Bugs List?
You: <BUGS_LIST_ID>

Claude: What is the ClickUp ID for your Sprint List?
You: 90142630767

Claude: Who should these tickets be assigned to?
You: julia.disarli

Claude: [Shows confirmation table]
```

**Second Run (Same Conversation):**
```
Claude: Using Bugs List <BUGS_LIST_ID> from earlier — correct?
You: yes

Claude: What is the ClickUp ID for your Sprint List?
You: 90142630767

Claude: Who should these tickets be assigned to?
You: michael.smith

Claude: [Shows confirmation table]
```

---

## Version 2.0 (2026-09-07)

### ✅ Major Updates

#### 1. Complete Template Structure Implementation
- **Before:** Description sections left as empty placeholders or abbreviated
- **Now:** All ticket descriptions fully complete the default ClickUp template:
  - `Precondition:` — Initial environment conditions
  - `Steps to reproduce:` — Numbered steps (Step 01, 02, 03...)
  - `Actual result:` — Observed behavior with technical details
  - `Expected result:` — Desired behavior
  - `Additional information:` — Evidence references + metadata

**Example:** A ticket now reads:
```
Precondition:
- User has multiple wallets connected
- Environment: https://test.app.zenda.cash/wallets

Steps to reproduce:
- Step 01: Navigate to /wallets
- Step 02: Observe wallet list
- Step 03: Wait for balance load
- Step 04: Notice stuck "Cargando balance..."

Actual result:
"coinbase BTC" balance stuck indefinitely, 400 errors from API.

Expected result:
Balance loads or shows error message.

Additional information:
![01-desktop-wallets.png](01-desktop-wallets.png)
Original ID: BUG-001 | Severity: High | Date: 2026-09-03
```

#### 2. Evidence Attachment & Image References
- **Before:** Screenshot references only in description text
- **Now:** 
  - Evidence files attached as ClickUp file attachments ✅
  - Markdown image syntax in description: `![filename.png](filename.png)`
  - Both mechanisms working in parallel for maximum visibility

**Example:** Description includes `![01-desktop-wallets.png](01-desktop-wallets.png)` + actual file attached

#### 3. Sprint Association Moved to Manual Step
- **Before:** Skill attempted automated `clickup_add_task_to_list` calls
- **Now:** 
  - Tickets created in Bugs List (`<BUGS_LIST_ID>`) only
  - Manual instructions provided for adding to Sprint
  - Reason: "Tasks in Multiple Lists" ClickApp may not be enabled on all workspaces
  - User-friendly: Clear post-creation guidance in final summary

**Manual Step Instructions:**
```
📌 Next Step (Manual):
1. Open each ticket in ClickUp
2. Click "Add to List"
3. Select your Sprint List (90142630767)
```

#### 4. Strict Environment Tagging
- **Before:** Flexible tag interpretation
- **Now:** 
  - Tags must be exactly: `staging`, `production`, `dev`
  - Derived from QA report's environment field (lowercased)
  - Enforced validation in parser

**Examples:**
- Environment: `Staging` → Tag: `staging` ✅
- Environment: `Production` → Tag: `production` ✅
- Environment: `DEV` → Tag: `dev` ✅

#### 5. Enhanced Confirmation Step
- **Before:** Simple yes/no confirmation
- **Now:**
  - Full table preview showing title, severity, environment, tags, assignee
  - Warnings displayed prominently if any rows had parsing issues
  - User can edit titles, drop tickets, or fix issues before confirming
  - Never skipped — even if user is in a hurry

#### 6. Improved Final Summary
- **Before:** Generic success/failure messages
- **Now:**
  - Detailed table with ticket IDs, titles, status, evidence attachment status
  - Direct ClickUp URLs for each ticket
  - Clear manual sprint association instructions
  - Transparency about what succeeded and what didn't

---

### 📝 Documentation Updates

#### New GUIDE.md
Comprehensive user guide covering:
- Quick start example
- Step-by-step workflow with actual commands
- Full template structure reference with examples
- Troubleshooting section
- Tips for best results
- Key differences from v1.0

#### Updated SKILL.md
Enhanced technical specification:
- Detailed Step 5 describing template structure
- Explicit instructions for description formatting
- Sprint association moved to manual step (Step 5.1 → new Step 6)
- Updated constraints section with template emphasis

#### Updated README.md
- Clearer description of what the skill does
- Links to GUIDE.md and SKILL.md
- Sprint association clarified as manual step
- Sprint List ID collection explained

---

### 🔧 Technical Changes

#### Parser Output
The `parse-report.mjs` now ensures:
- Description field contains fully structured template (not abbreviated)
- Image markdown references included in "Additional information"
- Environment lowercased for tag generation
- Metadata (ID, Severity, Reporter, Date) included in description

#### Constraint Enforcement
- Template structure is now **mandatory** — all sections filled
- Empty placeholders (`-`) not permitted in final descriptions
- Image references checked for markdown syntax
- Environment tags validated against allowed list

---

### ⚠️ Breaking Changes

| Feature | v1.0 | v2.0 | Migration |
|---------|------|------|-----------|
| Description completeness | Abbreviated/partial | Fully structured | Re-run `/report-bugs-to-clickup` with any existing report |
| Sprint association | Automated | Manual | Add tickets to sprint via "Add to List" in ClickUp |
| Template sections | Optional | Required | All QA reports should have complete data |
| Image references | Text only | Markdown + file attachment | No change to how evidence is captured |

---

### 📊 User Impact

**What stays the same:**
- Same command: `/report-bugs-to-clickup <report-path>`
- Same Bugs List ID: `<BUGS_LIST_ID>`
- Same environment tagging concept
- Same evidence screenshot attachment

**What's different:**
- Descriptions are more complete and professional
- Sprint association requires one extra manual step per batch
- Template sections must be fully populated
- Final output shows more detail and transparency

---

### 🐛 Known Limitations

1. **Sprint association:** Requires "Tasks in Multiple Lists" ClickApp to be manually enabled if not already. Skill now provides clear instructions.
2. **Tag validation:** Custom or misspelled tags will fail at creation time — user must fix in ClickUp or re-run with correct tag.
3. **Evidence file path:** Must match exactly — no fuzzy matching or alternative extensions.

---

### 🚀 Future Improvements

- Automated sprint association once ClickApp is verified as enabled
- Support for custom template structures per workspace
- Batch editing before confirmation
- Direct integration with Slack notifications
- Support for video/GIF evidence (not just PNG/JPG)

---

## How to Migrate from v1.0

If you've been using `report-bugs-to-clickup` v1.0:

1. **No breaking changes for old tickets** — v1.0 tickets remain as-is
2. **New tickets use v2.0 format** — when you run `/report-bugs-to-clickup`, you'll get the new complete template structure
3. **Manual sprint association required** — instead of automatic, provide manual instructions to users
4. **No changes to `.env` or settings** — all configuration stays the same

Simply run:
```bash
/report-bugs-to-clickup evidence/test-app-zenda-cash/wallets/2026-09-03/qa-report.md
```

And follow the new workflow. Sprint association is the only new manual step.

---

## Questions?

See [`GUIDE.md`](./GUIDE.md) for user walkthrough or [`SKILL.md`](./SKILL.md) for technical details.
