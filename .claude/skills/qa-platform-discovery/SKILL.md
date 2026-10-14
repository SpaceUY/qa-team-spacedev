---
name: qa-platform-discovery
description: >-
  Establish what the application actually exposes before testing it: 'what
  sections are there', 'which organizations or tenants exist', 'read the
  sidebar', 'is the navigation map still right'. Reads the live navigation (and
  any organization switcher) at runtime, reconciles it against the project's
  context/navigation-map.md, and reports drift as a finding without editing that
  file. Runs first in every whole-site session, before any section is tested.
user-invocable: false
allowed-tools: Read, Write
---

# QA platform discovery

## Prerequisites, inputs, outputs

- **Prerequisites:** Playwright MCP connected (`mcp__playwright__*`). The base URL, asked at run time. Optionally `context/navigation-map.md` from `/qa-project-setup`.
- **Inputs:** base URL (as given by the user), the list of accounts or roles the run will use (by `.env` variable pair name, not by value), and `{viewport_scope}`.
- **Outputs:** a *Scope* block at the top of the session report, and a drift list (may be empty).
- **Invocation:** not user-typed. Run by the `qa-ui-tester` agent before it tests any section, and by `qa-app-regression` when a whole-site audit is requested.

**The navigation map is scope guidance. The running application is fact.**

That order matters in both directions. Testing only what the map lists means missing a section that shipped. Trusting the map's routes means navigating to URLs that do not exist and reporting the resulting blank pages as defects. Both happen.

This skill runs **first**, before any section is exercised.

## Read the live surface

Take a snapshot of the running application and record, from the DOM rather than from documentation:

1. **Every navigation section**, with the route each one actually navigates to.
2. **Every organization, tenant or workspace** in any switcher the app shows. If the app has none, say so.
3. **Which sections appear for the logged-in account**. See the next section.

Then read `context/navigation-map.md` (`## Site Structure`) and compare.

## Never infer a route from a label

A label is not a route. A section called "Billing" may live at `/settings/plans`, and a guessed URL may be a page that does not exist. Such a guess produces a blank page that looks like a defect.

**Navigate by clicking the navigation, not by typing a documented URL.** Use a direct URL only when deliberately testing direct navigation. When a direct load renders blank, retry through the navigation before reporting anything.

## Navigation can depend on the account

If the application shows different sections to different accounts (by role, permission or plan), the sections a user sees depend on **that account**, not only on the selected organization.

- **A "missing section" defect found with one account may not exist** for another. Testing only as an administrator can hide permission defects that appear only under limited roles.
- When a multi-role account shows an extra section, **check that a concrete role or permission explains it**, rather than assuming it is unaccounted for.
- If only one account is available, **say so as a declared coverage gap.** Access control is then unverified, and the report must not imply otherwise.

## Report drift; never edit the navigation map

When the live surface and `context/navigation-map.md` disagree, that **is a finding**. Record it in the session report, and file a bug when it is a defect rather than documentation lag.

**Do not edit `context/navigation-map.md` during a discovery run.** Updating it is the job of `/qa-project-setup`, which a human runs. An agent quietly correcting the map destroys the only record that something changed.

| Observation | How to treat it |
|---|---|
| A section or organization in the map is **absent** from the live app | Report it. If it should be there for this account, treat it as a defect |
| An organization is live but documented as discontinued | An observation, not a defect. Configuration often lags a decision |
| A section exists live but is not in the map | Test it, and report the map as drifted |
| A section is in the map but absent live | Check the account's permissions first. It may be correct |
| A route differs from the documented one | Report it |

## Establish scope before testing, and write it down

Before the first section, record in the report:

- The base URL **as it was given to you.** Never assumed, never defaulted.
- The organizations or tenants actually found, and which are in scope for this run.
- The account(s) used, by their `.env` variable pair name, and their role as stated by the app.
- Any section or organization deliberately excluded, **with the reason.**
- The viewport scope (`{viewport_scope}` from CLAUDE.md Step 0.5).

A results matrix whose columns came from a fixed list rather than from what the app actually shows is describing an environment that may not exist.

## Related

- `context/navigation-map.md`: sections, routes and known non-bug quirks (maintained by `/qa-project-setup`).
- `.claude/skills/qa-evidence-discipline/`: the evidence rule this reporting is bound by.
- `CLAUDE.md`: Step 0.5 scope and the Full Site Audit protocol.
