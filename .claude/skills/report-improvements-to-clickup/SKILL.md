---
name: report-improvements-to-clickup
description: Reads a qa-report.md's "Nice to Have" recommendations and creates one ClickUp Improvement ticket per bullet, in the project's fixed Improvements List, associated to the current sprint, assigned to the logged-in QA. Invoke manually with the path to a qa-report.md.
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion, ToolSearch
---

# report-improvements-to-clickup — Create ClickUp Improvement tickets from a QA report

You turn a `qa-report.md`'s **"Nice to Have"** recommendations into ClickUp Improvement tickets, one ticket per bullet, in the project's fixed Improvements List, associated to the active sprint. This is a manual, on-demand skill — only run it when the user explicitly invokes `/report-improvements-to-clickup <path>`.

## Prerequisite — resolve the ClickUp connector at run time

The ClickUp MCP connector must be live. Discover its operations when this skill runs (`ToolSearch` for `clickup`), and never hardcode a tool name or server id: the connector is registered under an id that changes between sessions, so a name written into this file goes stale and silently blocks the calls this skill exists to make. If nothing resolves, STOP and say the connector is not live.

## Step 0 — Resolve the report path

The user's argument is the path to a `qa-report.md`. If no path was given, ask for one before continuing. Verify the file exists with `Read`; if it doesn't, tell the user and stop.

## Step 1 — Ask which destination List and Sprints Folder to use

Ask the user two things:

1. **The project's fixed Improvements List** (e.g. "Project Improvements") — every ticket created by this skill goes here, regardless of sprint. Use the connector's `clickup_get_list` operation to resolve its ID from the name; if ambiguous, use the connector's `clickup_get_workspace_hierarchy` operation to show the tree and let them pick. This becomes `destinationListId`.
2. **The project's Sprints Folder** — call the connector's `clickup_get_workspace_hierarchy` operation with `max_depth: "2"`, locate the Folder, and collect every List inside it as `{id, name, startDate, endDate}` (converting millisecond timestamps to `YYYY-MM-DD`).

## Step 2 — Identify the reporting QA

Call the connector's `clickup_resolve_assignees` operation with `assignees: ["me"]` to get the current user's ID and display name.

## Step 3 — Run the parser

Shell out via `Bash`:

```bash
node .claude/skills/report-improvements-to-clickup/parse-improvements.mjs "<report-path>" \
  --sprints='<JSON array of {id,name,startDate,endDate} from Step 1>' \
  --today=<today's date, YYYY-MM-DD> \
  --reporter="<display name from Step 2>"
```

Parse the single line of JSON printed to stdout.

- If it has an `error` field, show it to the user verbatim and stop. If the error mentions no sprint covering today's date, ask the user to pick a Sprint List manually from the ones listed in Step 1, then re-run the parser with a synthetic single-entry `--sprints` array covering today, same fallback pattern as `report-bugs-to-clickup`.
- Otherwise, continue to Step 4 with `result.tickets`, `result.sprintListId`, `result.sprintListName`, and `result.evidenceFile`.

## Step 4 — Confirm before creating anything

If `result.warnings` is non-empty, display those warnings prominently ABOVE the confirmation table, same pattern as `report-bugs-to-clickup`.

Show the user a table, one row per ticket in `result.tickets`, with **editable** Priority and Severity columns defaulting to `Low`:

| Title | Priority | Severity | Destination List | Sprint | Assignee |
|---|---|---|---|---|---|

- Priority / Severity: default `Low` for every row; let the user edit any row's value before confirming — if they change one, update that ticket's `description` text to match (re-run `buildImprovementDescription`'s template substitution manually in the ticket's description string, replacing the `Priority:`/`Severity:` lines).
- Destination List: the fixed Improvements List name from Step 1, same for every row.
- Sprint: `result.sprintListName`, same for every row.
- Assignee: the display name from Step 2.

Ask the user to confirm. If they ask for changes (drop an improvement, edit a title, change Priority/Severity), apply them and re-show the table. Do not proceed to Step 5 without explicit confirmation.

## Step 5 — Create the tickets

For each confirmed ticket, call the connector's `clickup_create_task` operation:

- `name`: the ticket's `title`
- `list_id`: `destinationListId` (the fixed Improvements List from Step 1)
- `markdown_description`: the ticket's `description`
- `assignees`: `[<user ID from Step 2>]`

If creation fails, record the failure and continue to the next ticket — do not stop the batch.

### Associate the ticket to the active sprint

After a ticket is created successfully, call the connector's `clickup_add_task_to_list` operation with the created task's ID and `result.sprintListId`. This requires the "Tasks in Multiple Lists" ClickApp. If it fails, do not fail or roll back the ticket — record the outcome for Step 6.

### Attach the shared evidence screenshot, if present

All improvements from this report share one screenshot: `result.evidenceFile`. If it is non-null:

1. Resolve its full path: it is a filename in the same directory as the report itself (`<directory of report-path>/<evidenceFile>`).
2. Check with `Bash` whether the file exists on disk. If not, skip attachment for all tickets from this run silently — note "no evidence file found" in each ticket's record.
3. If it exists, for **each** created ticket, call the connector's `clickup_request_attachment_upload` operation with that ticket's task ID, then follow the returned upload instructions with `curl -f` (or explicit HTTP-status checking — plain `curl` can exit `0` on a 4xx/5xx response) via `Bash`. Record success/failure per ticket; a failure on one ticket's attachment does not stop the batch or affect other tickets.

## Step 6 — Final summary

Print a table: for every ticket, the created ClickUp task URL or failure reason, the evidence-attachment outcome, and the sprint-association outcome. Never claim success for something that failed.

## Constraints

- Never fabricate the "In Scope" text — it is always the "Nice to Have" bullet's own wording, unchanged.
- Never skip Step 4's confirmation, even if the user seems in a hurry.
- Every "Nice to Have" bullet gets a ticket — do not filter or prioritize which ones to create.
- If the ClickUp MCP tools are not available in this session, stop immediately and tell the user, the same way the Playwright MCP pre-flight check in CLAUDE.md does — do not attempt a workaround.
