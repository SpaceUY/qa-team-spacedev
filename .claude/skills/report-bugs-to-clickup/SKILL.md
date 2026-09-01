---
name: report-bugs-to-clickup
description: Reads a qa-report.md's Bug Register table and creates one ClickUp bug ticket per row in the project's fixed Bugs List, associates each ticket to the current sprint, tags by environment, and assigns to the logged-in QA. Invoke manually with the path to a qa-report.md.
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion, mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy, mcp__claude_ai_ClickUp__clickup_get_list, mcp__claude_ai_ClickUp__clickup_create_task, mcp__claude_ai_ClickUp__clickup_add_task_to_list, mcp__claude_ai_ClickUp__clickup_resolve_assignees, mcp__claude_ai_ClickUp__clickup_request_attachment_upload
---

# report-bugs-to-clickup — Create ClickUp bug tickets from a QA report

You turn a `qa-report.md`'s **Bug Register** table into ClickUp bug tickets, one ticket per row, created in the project's fixed Bugs List and associated to the active sprint list. This is a manual, on-demand skill — only run it when the user explicitly invokes `/report-bugs-to-clickup <path>`.

## Step 0 — Resolve the report path

The user's argument is the path to a `qa-report.md`. If no path was given, ask for one (`AskUserQuestion` or a direct question) before continuing. Verify the file exists with `Read` before proceeding; if it doesn't, tell the user and stop.

## Step 1 — Ask which destination List and Sprints Folder to use

Ask the user two things:

1. **The project's fixed Bugs List** — every ticket created by this skill goes into this one List (e.g. "Otonomi Bugs"), regardless of the current sprint. Use `mcp__claude_ai_ClickUp__clickup_get_list` with the name the user gives you to resolve its ID; if ambiguous, use `mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy` to show the Space/Folder/List tree and let them pick. This becomes `destinationListId`.
2. **The project's Sprints Folder** (e.g. "Otonomi > Sprints") — separate from the fixed List above. Call `mcp__claude_ai_ClickUp__clickup_get_workspace_hierarchy` with `max_depth: "2"` to list Spaces → Folders → Lists, and locate the Folder the user named. Collect every List inside it as `{id, name, startDate, endDate}` — ClickUp lists expose `start_date`/`due_date` (or the Folder's Sprint configuration) as millisecond timestamps; convert each to `YYYY-MM-DD` before using them.

If the user isn't sure which Folder or List, show them the Space/Folder/List names returned by the hierarchy call and let them pick.

## Step 2 — Identify the reporting QA

Call `mcp__claude_ai_ClickUp__clickup_resolve_assignees` with `assignees: ["me"]` to get the current user's ID and display name. Keep the display name for the description template and the ID for the `assignees` field on task creation.

## Step 3 — Run the parser

Shell out via `Bash`:

```bash
node .claude/skills/report-bugs-to-clickup/parse-report.mjs "<report-path>" \
  --sprints='<JSON array of {id,name,startDate,endDate} from Step 1>' \
  --today=<today's date, YYYY-MM-DD> \
  --reporter="<display name from Step 2>"
```

Parse the single line of JSON printed to stdout.

- If it has an `error` field, show the error to the user verbatim and stop. In particular, if the error mentions no sprint covering today's date, ask the user to pick a Sprint List manually from the ones listed in Step 1, then re-run the parser with a synthetic single-entry `--sprints` array covering today (start/end date open-ended around today) so the rest of the flow stays unchanged — `destinationListId` from Step 1 is unaffected by this fallback and is still used as-is in Step 5.
- Otherwise, continue to Step 4 with `result.tickets` and `result.sprintListId`.

## Step 4 — Confirm before creating anything

If `result.warnings` is a non-empty array, display those warnings to the user prominently ABOVE the confirmation table — e.g.:

```
⚠️ 2 row(s) had issues:
- Skipped malformed row: "| BUG-004 | 🔴 High |"
- Unrecognized severity "Critical" for row BUG-005 — expected High, Medium, or Low
```

Let the user decide whether to proceed as-is, fix the source report and re-run, or manually adjust the affected ticket before confirming.

Show the user a table, one row per ticket in `result.tickets`:

| Title | Severity | Destination List | Sprint | Tag | Assignee |
|---|---|---|---|---|---|

- Destination List: `destinationListId`'s name (the fixed Bugs List from Step 1), same for every row.
- Sprint: `result.sprintListName` (the active sprint this ticket will additionally be associated with), same for every row.
- Tag: the ticket's `environment` field, lowercased (`staging`, `production`, `dev`).
- Assignee: the display name from Step 2.

Ask the user to confirm (`AskUserQuestion`, yes/no or "edit"). If they ask for changes (drop a bug, edit a title), apply them to the in-memory list and re-show the table. Do not proceed to Step 5 without explicit confirmation.

## Step 5 — Create the tickets

For each confirmed ticket, call `mcp__claude_ai_ClickUp__clickup_create_task`:

- `name`: the ticket's `title`
- `list_id`: `destinationListId` (the fixed Bugs List from Step 1 — **not** `result.sprintListId`)
- `markdown_description`: the ticket's `description`
- `assignees`: `[<user ID from Step 2>]`
- `tags`: `[<environment tag, lowercased>]`

If a `clickup_create_task` call fails (e.g. the tag doesn't exist yet in the Space), record the failure with the ticket's title and continue to the next ticket — do not stop the batch.

### Associate the ticket to the active sprint

After a ticket is created successfully, call `mcp__claude_ai_ClickUp__clickup_add_task_to_list` with the created task's ID and `result.sprintListId` (from Step 3's parser output). This adds the ticket to the active Sprint List in addition to its home List — it does not move or remove it from the fixed Bugs List.

This call requires the "Tasks in Multiple Lists" ClickApp to be enabled on the workspace. If the call fails for any reason, do **not** fail or roll back the ticket — it already exists correctly in the fixed Bugs List. Record the outcome ("associated with sprint" / "sprint association failed: <reason>") against this ticket's record so Step 6 can report it.

### Attach the evidence screenshot, if present

After a ticket is created successfully, try to attach its evidence screenshot:

1. Resolve the full path to the evidence file: the ticket's `evidence` value (from the parser's output, e.g. `02-invalid-email.png`) is a filename relative to the report's own directory. For example, if the report is at `evidence/x/register/2026-03-26/qa-report.md` and `evidence` is `02-invalid-email.png`, the full path is `evidence/x/register/2026-03-26/02-invalid-email.png`.
2. Check with `Bash` (or `Read`) whether that file exists on disk.
   - If it does **not** exist, skip attachment for this ticket silently — this is not a batch-aborting failure. Note "no evidence file found" against this ticket's record so Step 6 can mention it.
   - If it **does** exist, call `mcp__claude_ai_ClickUp__clickup_request_attachment_upload` with the created task's ID. Follow the returned upload instructions (URL, method, multipart field name) to upload the file with a native HTTP client via `Bash` (e.g. `curl`). Use `curl -f` (which fails, and returns a non-zero exit code, on an HTTP error response) or explicitly check the HTTP status code returned, rather than relying only on curl's plain exit code — a plain `curl` call can exit `0` even on a 4xx/5xx response, which would make a failed upload look like a success.
3. If the upload request or the follow-up HTTP upload fails, record the failure with the ticket's title (do not stop the batch) and note "evidence upload failed" against this ticket's record.

## Step 6 — Final summary

Print a table to the user: for every ticket, either the created ClickUp task URL (returned by `clickup_create_task`) or the failure reason, plus the evidence-attachment outcome (attached / no evidence file found / upload failed / not applicable), plus the sprint-association outcome (associated / association failed / not applicable). Never claim success for a ticket that failed, and never claim a screenshot was attached or a sprint was associated when it wasn't.

## Constraints

- Never fabricate `Preconditions`, `Steps to reproduce`, or `Expected result` content — these stay as the template's empty placeholders (`-`) unless the report itself states them.
- Never skip Step 4's confirmation, even if the user seems in a hurry.
- All severities (High, Medium, Low) get tickets — do not filter by severity.
- If the ClickUp MCP tools are not available in this session, stop immediately and tell the user, the same way `qa-agent`'s Playwright MCP pre-flight check does — do not attempt a workaround.
