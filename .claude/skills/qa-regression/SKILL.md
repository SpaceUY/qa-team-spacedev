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

## Step 1 — Reading Project Context

Read `context/navigation-map.md`'s `## Site Structure` section for
general orientation on the site's layout — this is supplementary to
each flow's own `**Steps:**`, which already say exactly where to go;
use Site Structure only if a flow's steps reference a section by name
without a concrete route. This skill does not read `.env` — it has no
base URL or credential of its own to look up; every flow's steps and
test data already carry whatever a specific flow needs.

Cross-check anything you're about to report as a bug (per Step 3 below)
against `## Known Non-Bug Quirks` first — if it's listed there, do not
report it; treat it as confirmed-intentional behavior. This is the same
false-positive guard `qa-blackbox` already applies.

If both sections still read as their empty-template placeholder text,
that's fine — proceed using only what each flow's own steps provide.

## Step 2 — Load the regression flows

Read `context/regression-flows.md`. If it has no `## Flow:` entries yet
(just the empty-state placeholder), tell the user to run
`/qa-project-setup` first to add core flows, and stop — there is nothing
to regress against.

If it has flows, list them to the user before starting (name and last
successful run date for each), and ask whether to run all of them or a
subset (`AskUserQuestion`, multi-select from the flow names found).

## Step 3 — Execute each selected flow

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

## Step 4 — Update last-run history

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

## Step 5 — Final report

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
