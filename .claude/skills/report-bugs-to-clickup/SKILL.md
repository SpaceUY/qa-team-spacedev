---
name: report-bugs-to-clickup
description: Reads a qa-report.md's Bug Register table and creates one ClickUp bug ticket per row in your project's Bugs List. Asks for Bugs List ID (remembered in chat), Sprint List ID (each run), and assignee (manual selection). Completes full template structure (Precondition, Steps to reproduce, Actual result, Expected result, Additional information), attaches evidence screenshots, tags by environment. Sprint association is manual (post-creation). Invoke with `/report-bugs-to-clickup <report-path>`.
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion, mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy, mcp__claude_ai_ClickUp__clickup_get_list, mcp__claude_ai_ClickUp__clickup_create_task, mcp__claude_ai_ClickUp__clickup_add_task_to_list, mcp__claude_ai_ClickUp__clickup_resolve_assignees, mcp__claude_ai_ClickUp__clickup_request_attachment_upload
---

# report-bugs-to-clickup — Create ClickUp bug tickets from a QA report

You turn a `qa-report.md`'s **Bug Register** table into ClickUp bug tickets, one ticket per row, created in the project's fixed Bugs List and associated to the active sprint list. This is a manual, on-demand skill — only run it when the user explicitly invokes `/report-bugs-to-clickup <path>`.

## Step 0 — Resolve the report path

The user's argument is the path to a `qa-report.md`. If no path was given, ask for one (`AskUserQuestion` or a direct question) before continuing. Verify the file exists with `Read` before proceeding; if it doesn't, tell the user and stop.

## Step 1 — Get Bugs List ID and Sprint List ID from the user

Ask the user for **both** IDs:

### Bugs List ID
- **Question:** "What is the ClickUp ID for your **Bugs List**?" (e.g., `901408710081`)
- **Remembering:** Store this ID in chat/session memory. On next run of this skill in the same conversation, recall and confirm: "Using Bugs List `901408710081` — correct?" If user confirms, skip asking again in that conversation.
- **Format:** The user provides the ID directly. This becomes `bugsListId`.

### Sprint List ID
- **Question:** "What is the ClickUp ID for your current **Sprint List**?" (e.g., `90142630767`)
- **Remembering:** Sprint rotates every 15 days, so ask every time (no memory carry-over between conversations).
- **Format:** The user provides the ID directly. This becomes `sprintListId`.

## Step 1.5 — Ask who should be assigned to tickets

- **Question:** "Who should these tickets be assigned to? Provide their email, username, or say 'me' for yourself."
- **Resolution:** Call `mcp__claude_ai_ClickUp__clickup_resolve_assignees` with the provided name/email to get their user ID and display name.
- **Result:** Store both `assigneeId` (for task creation) and `assigneeDisplayName` (for description/table).

## Step 2 — Build the tickets

Shell out via `Bash` to run the parser. The parser builds tickets with title and description:

```bash
node .claude/skills/report-bugs-to-clickup/parse-report.mjs "<report-path>" \
  --today=<today's date, YYYY-MM-DD> \
  --reporter="<assigneeDisplayName from Step 1.5>"
```

Parse the single line of JSON printed to stdout.

- If it has an `error` field, show the error to the user verbatim and stop.
- Otherwise, continue to Step 3 with `result.tickets`.

## Step 3 — Confirm before creating anything

If `result.warnings` is a non-empty array, display those warnings to the user prominently ABOVE the confirmation table — e.g.:

```
⚠️ 2 row(s) had issues:
- Skipped malformed row: "| BUG-004 | 🔴 High |"
- Unrecognized severity "Critical" for row BUG-005 — expected High, Medium, or Low
```

Let the user decide whether to proceed as-is, fix the source report and re-run, or manually adjust the affected ticket before confirming.

Show the user a table, one row per ticket in `result.tickets`:

| Title | Severity | Bugs List | Sprint List | Tag | Assignee |
|---|---|---|---|---|---|

- Bugs List: the `bugsListId` from Step 1 (same for every row)
- Sprint List: the `sprintListId` from Step 1 (same for every row)
- Tag: the ticket's `environment` field, lowercased (`staging`, `production`, `dev`).
- Assignee: the `assigneeDisplayName` from Step 1.5 (same for every row).

Ask the user to confirm (`AskUserQuestion`, yes/no or "edit"). If they ask for changes (drop a bug, edit a title), apply them to the in-memory list and re-show the table. Do not proceed to Step 4 without explicit confirmation.

## Step 4 — Create the tickets

For each confirmed ticket, call `mcp__claude_ai_ClickUp__clickup_create_task`:

- `name`: the ticket's `title` (format: `[BUG] [Environment] Area - Brief description`)
- `list_id`: the `bugsListId` from Step 1 (user-provided, project-specific)
- `markdown_description`: the ticket's `description` (must fill the default template structure completely)
- `assignees`: `[<assigneeId from Step 1.5>]`
- `tags`: `[<environment tag, lowercased>]` (e.g., `staging`, `production`, `dev`)

**Important — Description Template Structure:**

All ticket descriptions **must** complete the following default template structure:

```
Precondition:
- (Initial conditions and environment setup)

Steps to reproduce:
- Step 01: (First action)
- Step 02: (Second action)
- Step 03: (Third action)
- Step 04: (Fourth action, if applicable)

Actual result:
(Observed behavior and technical details)

Expected result:
(Desired behavior)

Additional information:
![evidence-filename.png](evidence-filename.png)
(Metadata: Original ID | Severity | Reporter | Date | Related tickets)
```

The parser outputs `description` field that **must already follow this structure** — do not modify or abbreviate it. If creating manually, ensure all sections are filled per the template above.

If a `clickup_create_task` call fails (e.g. the tag doesn't exist yet in the Space), record the failure with the ticket's title and continue to the next ticket — do not stop the batch.

### Sprint Association — Manual Step

⚠️ **Important Change:** Sprint association is now a **manual, post-creation step** rather than automated.

After all tickets are successfully created in the Bugs List:

1. **Notify the user** that tickets have been created in the Bugs List (`901408710081`)
2. **Provide manual instructions** for adding to the Sprint List:
   - "To associate these tickets to the current sprint, manually add each ticket to the Sprint List (`{sprintListId}`) by:"
   - "1. Opening each ticket in ClickUp"
   - "2. Clicking 'Add to List' in the right panel"
   - "3. Selecting the Sprint List from the dropdown"
3. **Do not** attempt `mcp__claude_ai_ClickUp__clickup_add_task_to_list` calls — this step is intentionally manual because "Tasks in Multiple Lists" ClickApp may not be enabled on all workspaces.

### Attach the evidence screenshot, if present

After a ticket is created successfully, try to attach its evidence screenshot:

1. Resolve the full path to the evidence file: the ticket's `evidence` value (from the parser's output, e.g. `02-invalid-email.png`) is a filename relative to the report's own directory. For example, if the report is at `evidence/x/register/2026-03-26/qa-report.md` and `evidence` is `02-invalid-email.png`, the full path is `evidence/x/register/2026-03-26/02-invalid-email.png`.
2. Check with `Bash` (or `Read`) whether that file exists on disk.
   - If it does **not** exist, skip attachment for this ticket silently — this is not a batch-aborting failure. Note "no evidence file found" against this ticket's record so Step 6 can mention it.
   - If it **does** exist, call `mcp__claude_ai_ClickUp__clickup_request_attachment_upload` with the created task's ID. Follow the returned upload instructions (URL, method, multipart field name) to upload the file with a native HTTP client via `Bash` (e.g. `curl`). Use `curl -f` (which fails, and returns a non-zero exit code, on an HTTP error response) or explicitly check the HTTP status code returned, rather than relying only on curl's plain exit code — a plain `curl` call can exit `0` even on a 4xx/5xx response, which would make a failed upload look like a success.
3. If the upload request or the follow-up HTTP upload fails, record the failure with the ticket's title (do not stop the batch) and note "evidence upload failed" against this ticket's record.

## Step 5 — Final summary

Print a completion summary table to the user with these columns:

| Ticket ID | Title | Status | Evidence | ClickUp URL |
|-----------|-------|--------|----------|-------------|
| ... | ... | ✅ Created / ❌ Failed | ✅ Attached / ⚠️ No file found / ❌ Upload failed | [Link] |

After the table, include the manual sprint association instructions:

```
📌 Next Step (Manual):

Add tickets to Sprint List ({sprintListId}):
1. Open each ticket in ClickUp
2. Click "Add to List" in the right panel
3. Select the Sprint List from the dropdown

Ticket IDs: [list IDs created]
Assigned to: {assigneeDisplayName}
Bugs List ID (for next run): {bugsListId}
```

**Never claim:**
- Success for a ticket that failed to create
- A screenshot was attached when it wasn't
- A ticket was associated to sprint (it's manual now)

## Constraints

- **Bugs List ID in chat memory:** Ask for Bugs List ID in Step 1. On next invocation in the same conversation, recall and confirm it — do not ask again unless user clarifies it changed. This supports multi-report sessions where the same project's Bugs List is used repeatedly.
- **Assignee is always manual:** Never assume "me" — always ask the user who should be assigned to tickets (Step 1.5). Resolve the name/email to a user ID via `clickup_resolve_assignees`.
- **Template Structure is Mandatory:** Every ticket description **must** complete the full default template (Precondition, Steps to reproduce, Actual result, Expected result, Additional information). Do not skip sections or leave them empty — fill all fields with data from the QA report.
- **Image References:** Include markdown image syntax `![filename.png](filename.png)` in the "Additional information" section for each evidence file. Attach the actual file as a ClickUp attachment in parallel.
- **Environment Tags:** Use the report's environment field (lowercase) as the tag: `staging`, `production`, `dev`. Never create custom tags not matching the report.
- **Sprint Association is Manual:** Do not attempt automated sprint association via `mcp__claude_ai_ClickUp__clickup_add_task_to_list`. Inform the user to manually add tickets to the Sprint List after creation (Step 5).
- Never fabricate content — only fill template sections with data explicitly stated in the QA report.
- Never skip Step 3's confirmation, even if the user seems in a hurry.
- All severities (High, Medium, Low) get tickets — do not filter by severity.
- If the ClickUp MCP tools are not available in this session, stop immediately and tell the user, the same way `qa-agent`'s Playwright MCP pre-flight check does — do not attempt a workaround.
