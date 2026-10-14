---
name: qa-evidence-discipline
description: >-
  The evidence rule every QA run is bound by: 'is this finding real', 'can I
  report this yet', 'the section looks blank', 'the button is disabled', 'I think
  this is a bug'. No claim without fresh evidence gathered in this run; a
  screenshot at the moment of discovery, not after; a false positive corrected in
  writing rather than deleted; and the PASS / FAIL / BLOCKED split that keeps a
  missing precondition from being scored as a defect. Composed by every QA test
  skill and agent in this repo.
user-invocable: false
allowed-tools: Read, Write, AskUserQuestion
---

# QA evidence discipline

## Prerequisites, inputs, outputs

- **Prerequisites:** none. This is a rule set, not a tool.
- **Used by:** `qa-regression`, `qa-smoke-test`, `qa-text-check`, `qa-app-regression`, `qa-api-regression`, `qa-ad-hoc`, and the `qa-ui-tester` and `qa-api-tester` agents.
- **Input:** the findings and observations of the current run.
- **Output:** every finding in `qa-report.md` carries its evidence, its outcome (PASS, FAIL or BLOCKED), or a written correction.
- **Invocation:** not user-typed. The calling skill or agent applies these rules while it runs.

The rule this skill exists for: **a QA report's only value is that its claims are true.** A run that reports nine real defects and one invented one is not 90% useful. It is a report someone now has to re-verify from scratch, which costs more than not running it.

Everything below is in service of that.

## The evidence rule

**No claim without fresh evidence, gathered in this run.**

Not from a previous session, not from an old report, not from what the documentation says should happen. If you did not observe it in this run, you cannot report it in this run.

Concretely, before writing any finding:

1. **Name what would prove it.** A screenshot, a response body, a DOM query, a network status.
2. **Get that.** Now, not later.
3. **Read what you got**, not what you expected to get.
4. **Then write the finding**, with the evidence attached.

A finding whose evidence you cannot produce is not a finding. Say what you observed and that you could not confirm it, or drop it.

## Screenshot at the moment of discovery

**Capture the anomaly when you see it, before doing anything else**: before retrying, before navigating away, before checking whether it reproduces.

The reason is not diligence. These states are frequently transient. A blank panel that resolves on the next render, a validation message that clears on blur, a spinner that eventually stops: capture them a step later and you have a screenshot of a working page attached to a bug report claiming otherwise.

If a capture tool fails, say so in the report and use a DOM snapshot instead. **A failed capture is not evidence of a defect**, and it is not a reason to skip the finding either. It is a stated gap.

## PASS, FAIL, BLOCKED — three outcomes, not two

This is the distinction most often collapsed, and collapsing it is what makes a report untrustworthy in both directions.

| Outcome | Meaning |
|---|---|
| **PASS** | You ran the check and the behavior was correct |
| **FAIL** | You ran the check and the behavior was wrong |
| **BLOCKED** | **You could not run the check** |

A scenario is `BLOCKED` when a precondition is absent: no test account for that role, an unset variable in `.env`, seed data that does not exist in the environment, a record that has expired, an account that does not exist there.

**A blocked scenario is never a FAIL.** Record it as `BLOCKED`, name the missing precondition, and move on. Reporting it as a defect sends someone to debug an application that is behaving correctly.

Equally: **a blocked scenario is never a PASS.** A check that did not run has no result. Do not let a blocked row quietly read as covered.

## Attempt the correct interaction before reporting a control broken

A disabled button is not evidence of a defect until you have tried to enable it properly.

Some controls depend on a value chosen from an autocomplete rather than typed. The sequence is: type at least two characters, wait for the suggestion list, click a suggestion.

- If the control enables after correct selection, that is **expected behavior**. Record `requires autocomplete selection to test`, not a bug.
- If it stays disabled **after** correct selection, that is a real defect, and now you have evidence.

The same principle generalizes: before reporting that something does not work, confirm you used it the way it is meant to be used.

## Correct a false positive in writing

When a finding turns out not to be real, **write the correction into the report.** Do not delete the finding.

A deleted false positive is rediscovered by the next run, investigated again, and costs the same time again. A recorded one is read once and skipped. State what you suspected, what you checked, and why it is not a defect. Under the report's `Corrected false positives` note, these are what make the surviving findings credible.

## Check the project's known non-bug quirks first

Some behavior is intended, and it is easy to report it as a bug. Before the run, read the project's `context/navigation-map.md`, section `## Known Non-Bug Quirks`. If the file or the section is still the empty template, there is nothing to check against; say so in the report.

A listed quirk is a **default, not a gag**. If your observation carries evidence the note did not have (a successful network response with known data behind it, a reproduction on direct page load, a clean console), say so explicitly and report it anyway, naming the quirk you departed from and why. The list exists to stop repetition, not to stop reporting.

## Waiting longer is not a diagnosis

If a section renders blank under automation, waiting five, ten or thirty seconds and seeing no change **does not establish that the blank is real.** A longer wait produces confidence without evidence.

The only check that separates an automation artifact from a product defect is **a human loading the same page in a real browser.** If that has not happened, the finding is provisional and must say so.

## Before you call a run complete

- Every scenario has an outcome: PASS, FAIL or BLOCKED. No blanks.
- Every FAIL has its evidence attached.
- Every BLOCKED names the missing precondition.
- Every corrected false positive is written down.
- The happy path has a success screenshot. **A run with no evidence that anything worked is not a completed run**, whatever else it found.
- Coverage gaps are stated explicitly: what you did not test, and why. An unstated gap reads as a pass.

## Related

- `.claude/skills/qa-blackbox/`: quality dimensions, scoring, severity and report format.
- `.claude/skills/qa-report-render/`: the rendered report shape.
- `CLAUDE.md`: the standard scenarios and the screenshot rules.
