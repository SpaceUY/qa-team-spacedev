# Design: `report-improvements-to-clickup` skill + `report-bugs-to-clickup` sprint-association fix

**Date:** 2026-09-01
**Author:** Julia Disarli (julia.disarli@otonomi.ai)
**Status:** Approved

## Purpose

Extend the ClickUp automation introduced by `report-bugs-to-clickup` with a
sibling skill, `report-improvements-to-clickup`, that turns a
`qa-report.md`'s "Nice to Have" recommendations into ClickUp "Improvement"
tickets — the same manual, on-demand, confirm-before-write pattern already
built for bugs.

Building this skill surfaced an incorrect assumption baked into the
already-merged `report-bugs-to-clickup`: it treated the active Sprint List
as the ticket's one and only destination List. The real ClickUp setup is
different — each project has one fixed List for its tickets (e.g. "Otonomi
Bugs"), and a ticket is *additionally* associated with the active Sprint
List via ClickUp's "Tasks in Multiple Lists" mechanism, not moved into a
sprint-specific List. This spec also captures the fix to
`report-bugs-to-clickup` for that mechanism, since both skills share it.

## Part 1 — Sprint association fix for `report-bugs-to-clickup`

### What was wrong

`SKILL.md`'s Step 1/Step 5 (as merged) asked the user for a Sprints
Folder, found the active Sprint List by date range, and used that Sprint
List's ID directly as `clickup_create_task`'s `list_id` — i.e., the ticket
was created *inside* the sprint list, with no separate "project List"
concept.

### Corrected model

1. Ask the user for the project's **fixed destination List** (e.g.
   "Otonomi Bugs") — this is the List every bug ticket is created in,
   regardless of sprint. This becomes `clickup_create_task`'s `list_id`.
2. Ask the user for the project's **Sprints Folder** (as before) and
   detect the active Sprint List by date range (as before, using
   `findActiveSprint` — unchanged).
3. After a ticket is created successfully in the fixed List, call
   `clickup_add_task_to_list` with the created task's ID and the active
   Sprint List's ID, associating the ticket to the current sprint via
   ClickUp's multi-list mechanism. The task's "home" list stays the fixed
   project List; the sprint association is additive.
4. `clickup_add_task_to_list` requires the "Tasks in Multiple Lists"
   ClickApp to be enabled on the workspace. If the call fails (ClickApp
   disabled, or any other reason), this does **not** roll back or fail
   the ticket — the ticket already exists correctly in the fixed List.
   Record the sprint-association outcome (associated / failed, with
   reason) per ticket, and surface it in the final summary alongside the
   evidence-attachment outcome.

### Confirmation table update

The Step 4 confirmation table gains a "Sprint" column (the detected
active sprint name) alongside the existing "Destination List" column
(now the fixed project List, not the sprint list).

### No changes to

`findActiveSprint`, `parseBugRegister`, `parseReportHeader`,
`inferPlatform`, `inferEnvironment`, `inferPage`, `buildTicketTitle`,
`buildTicketDescription`, `buildTickets`'s error-propagation order, or
the `warnings` channel — all of that logic is unaffected by *where* the
ticket ends up living.

## Part 2 — `report-improvements-to-clickup`

### Trigger

Manual, on-demand, same as bugs:

```
/report-improvements-to-clickup <path-to-qa-report.md>
```

### Location

`qa-team/.claude/skills/report-improvements-to-clickup/` — sibling
directory to `report-bugs-to-clickup`, same internal layout:

```
report-improvements-to-clickup/
├── SKILL.md
├── parse-improvements.mjs
└── parse-improvements.test.mjs
```

This is a **separate module** from `parse-report.mjs`, not a shared one —
the two skills parse different sections of the same report format and
build different title/description shapes. Where logic is identical
(header parsing, platform/environment/page inference, active-sprint
detection, the CLI JSON-output contract shape), the improvement module
duplicates the small, stable, already-tested functions from
`parse-report.mjs` rather than introducing a shared dependency between
two independently-invoked skills — each skill stays self-contained and
independently testable, consistent with the original design's emphasis
on isolation. (`parseReportHeader`, `inferPlatform`, `inferEnvironment`,
`inferPage` are copied verbatim; the parsing target and ticket-building
functions are new.)

### Input

The same `qa-report.md` format, but a different section: **"Recommended
Actions" → "### Nice to Have"** (see `qa-agent/CLAUDE.md`'s Report Format
— this section already exists in every report; it is free-text bullets,
not a table):

```markdown
## Recommended Actions
### Must Fix
- Fix broken submit button on mobile

### Nice to Have
- Add eye icon on login, password field
- Increase contrast on placeholder text
```

Each `-` bullet under `### Nice to Have` becomes one improvement. Bullets
under `### Must Fix` are out of scope for this skill (those are typically
already bugs, covered by `report-bugs-to-clickup`).

### Flow

1. **Parse the report**: extract the report header (flow name, URL,
   date — reusing the same parsing as bugs) and every bullet under
   `### Nice to Have`. If that subsection is missing or has no bullets,
   stop and tell the user — create nothing.
2. **Infer platform/environment/page**: identical logic to
   `report-bugs-to-clickup` (same functions, copied).
3. **Build ticket title**:
   `[Improvement] {Platform} | {Environment} | {Page} | {Short description}`
   — `{Short description}` is the bullet text verbatim (trimmed to
   title-length if very long, same convention as bugs).
4. **Build ticket description**, fixed template:
   ```
   In Scope:
   {bullet text verbatim}

   Additional information:
   Reported by: {QA display name}
   Priority: {value from confirmation table}
   Severity: {value from confirmation table}
   ```
   `In Scope` is never fabricated or expanded — it is the bullet's own
   text, unchanged, matching the "never invent content" principle from
   the bugs skill.
5. **Priority / Severity**: the Nice-to-Have bullets carry no such
   values in the report. The skill defaults both to `Low` per
   improvement and shows them as part of the Step-6 confirmation table
   (see below) so the user can edit any row's Priority/Severity before
   confirming. These two values are never silently invented beyond the
   shown default — the confirmation step is where the user owns them.
6. **Evidence**: attach the report's main/happy-path screenshot (the
   first numbered screenshot in the report's evidence folder, e.g.
   `01-initial-load.png` or equivalent — same folder the report lives
   in) to every improvement ticket created from that report. All
   improvements from one report share the same page/flow, so one shared
   screenshot is appropriate context, unlike bugs where each row has its
   own Evidence column pointing at a specific screenshot. Uses the same
   `clickup_request_attachment_upload` mechanism as bugs.
7. **Destination List**: ask the user for the project's fixed
   Improvements List (e.g. "Otonomi Improvements") — analogous to the
   Bugs List, a separate List from it.
8. **Sprint association**: ask for the Sprints Folder, detect the active
   Sprint List by date range (same `findActiveSprint` logic, duplicated
   from the bugs module), and associate every created ticket to it via
   `clickup_add_task_to_list` — same corrected mechanism as Part 1. Same
   non-blocking failure handling (ticket still exists in the fixed List
   even if sprint association fails).
9. **Assignee**: the currently authenticated ClickUp user (`"me"`,
   resolved via `clickup_resolve_assignees`), same as bugs.
10. **Confirmation before creating anything**: show a table with, for
    every improvement:

    | Title | Priority | Severity | Destination List | Sprint | Assignee |

    Priority and Severity default to `Low` and are editable by the user
    before they confirm — this is the mechanism from step 5 above. Wait
    for explicit confirmation; re-show the table if the user edits
    anything. No ticket is created before this gate.
11. **Create tickets**: for every confirmed improvement, in order:
    `clickup_create_task` in the fixed Improvements List with the built
    title/description and the resolved assignee; attach the shared
    evidence screenshot; associate to the active sprint via
    `clickup_add_task_to_list`. Individual failures (attach, sprint
    association) do not abort the batch.
12. **Final summary**: ClickUp task URL per improvement, or the failure
    reason; evidence-attachment and sprint-association outcomes noted
    per ticket, same as the bugs skill's final report.

### Error handling

- No `### Nice to Have` subsection, or it has no bullets → stop, tell
  the user, create nothing.
- No sprint List's date range covers today → same fallback as bugs: ask
  the user to pick a destination Sprint List manually.
- Individual ticket creation/attachment/sprint-association failure →
  continue with the rest of the batch, surface in the final report.
- ClickUp MCP not connected → stop immediately, same pre-flight pattern
  as both existing skills.

### Out of scope (for this iteration)

- Modifying `qa-agent`'s report format to add a structured "Improvement
  Register" table — explicitly rejected in favor of parsing the existing
  free-text "Nice to Have" bullets, to avoid touching the other module.
- Deduplicating improvements against previously created tickets on a
  re-run.
- A shared/imported module between `report-bugs-to-clickup` and
  `report-improvements-to-clickup` — each skill's parser stays
  self-contained per the isolation rationale above.
