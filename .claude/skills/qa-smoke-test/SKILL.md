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
  whole entry from scratch. Also update that entry's
  `**Last successful run:**` line: set it to today's date if the smoke
  test passed, or leave it unchanged (do not overwrite a real prior
  date with `never run`) if the smoke test failed — the same
  pass/fail rule the **Add** path above uses, applied to an existing
  entry instead of a new one.
- If **Skip**: do nothing further to `context/regression-flows.md`.

## Constraints

- Never persist ClickUp ticket content into `context/` — always fetch
  fresh (Step 1).
- Never skip the Step 4 regression-sync question.
- Never fabricate acceptance criteria not actually present on the
  ticket.
- Never write a plaintext credential or secret into `context/` — same
  rule as `qa-project-setup`.
