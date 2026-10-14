---
name: qa-api-regression
description: >-
  The HTTP API black-box protocol: 'test the API', 'audit the endpoints',
  'exercise the public routes', 'check v2'. Applies partitioning, boundary and
  error-guessing techniques to payloads, authentication and error paths over
  HTTP, with no browser. Carries the rules for asking the API version and the
  account, and the rules for judging a failure as a defect or as known behavior.
  HTTP only. The browser counterpart is qa-app-regression.
user-invocable: false
allowed-tools: Read, Write
---

# QA API regression protocol

## Prerequisites, inputs, outputs

- **Prerequisites:** a shell with `curl` (the `qa-api-tester` agent runs requests through Bash). The API base URL, asked at run time. The API key variable name(s) in `.env`, asked at run time. No browser.
- **Inputs:** base URL, API version if the API is versioned, the account (the `.env` variable name holding its key), the endpoints or area to test, and `{project_language}`.
- **Outputs:** one result per endpoint and check (PASS / FAIL / BLOCKED) with the request shape and the actual status and body. Sweeps are written with `qa-report-test-execution`.
- **Invocation:** not user-typed. Run by the `qa-api-tester` agent in its sweep mode.

Black-box testing of the API over HTTP. No browser, no source assumptions.

**This is exploratory testing, not a suite runner.** If the repo has a scripted API suite (under `e2e-tests/`), running it is the job of `/qa-regression`. This skill covers what a scripted suite usually does not: invalid payloads, boundaries, authentication failures, error paths, and the accounts and paths no suite reaches.

**A green scripted suite is not evidence that a path works.** A case can pass by avoiding the failing path, for example by hardcoding a valid value. Passing means it avoided the path, not that the path is sound.

## The version and the account are inputs, never defaults

**If the API has more than one version, ask which one before the first request.** Never default to the version that has existing coverage. Versions can share paths and still differ in their success shapes, so an assertion written for one may be wrong against the other. Error envelopes are often the same across versions, so error-path assertions may not need to branch. Success-path assertions usually do.

**Which account you call as is a test dimension, not plumbing.** What a request returns can depend on the calling key's organization or role. Ask for the account by its `.env` variable name, and never default. An unstated account yields a verdict about the caller that reads as a verdict about the endpoint.

Read the key from `.env` by variable name only, through the protocol in `qa-ad-hoc` (`set -a && source .env && set +a` inside Bash, never printed). If a variable is unset, the run is `BLOCKED` on that account. Name the variable and stop for that account. **Never substitute another account's key.**

## Confirm the host before spending the run on it

Confirm the base URL is the API you meant to test. A keyless request is the quickest check: the expected service should answer with its own authentication error (for example "missing API key"), and a different service in front of it may answer differently. If you reach the wrong host, stop before any authenticated request.

## Known hazards: recognize them, do not rediscover them

Record the project's API hazards in `context/navigation-map.md` under `## Known Non-Bug Quirks`, or in notes the user provides. Before writing a finding, check it against those notes. A documented quirk is expected behavior unless the new evidence says otherwise (see the evidence discipline in `qa-evidence-discipline`).

Typical hazards to check for:

- A route that exists but answers `404` because the id is missing from the path, not because the endpoint is absent.
- A health endpoint that lives outside the versioned prefix.
- Identification rules that differ between versions (for example, one version accepts one of two fields and rejects a request carrying neither). A `400` naming the accepted fields is correct behavior.
- A filter parameter that the endpoint silently ignores. **Assert the data, not just the status and the envelope**: a `200` with the unfiltered list is a defect.

## Known failures: decided by the record, not by a list

**A failure is expected only if a recorded entry says so**: an open ClickUp bug ticket (search with the ClickUp connector, see below) or an earlier `qa-report.md` under `evidence/`. Read its status and its closing reason:

- **Open** → known. Cite it; do not file it again. Add new evidence to the existing ticket through `/report-bugs-to-clickup` if the user wants it.
- **Closed as designed or as intended** → expected behavior. Not a defect. Cite the entry.
- **Closed for any other reason** → fixed and released. **A recurrence is a possible regression**: report it with its evidence and reopen or re-file it.
- **No entry** → new. Report it.

No hazard list in this file, and no README table, overrides a recorded entry.

To search ClickUp, load the connector's tools first with `ToolSearch` (for example query `clickup`). Do not hardcode tool names.

## Techniques

**Partitioning.** Per field: valid, wrong type, missing, null, empty string, and, for identifiers, well-formed but non-existent. A well-formed non-existent reference is a classic place for a missing check.

**Boundaries.** Numeric limits at minimum, maximum, and one past each. Dates in the past, far in the future, and malformed. Pagination at zero, one, the page size, and past it. String fields at and past their length limit.

**Error guessing.** No key, a malformed key, a key from a different organization. A payload with extra unexpected fields. A duplicate creation. A resource identifier belonging to someone else. A request that succeeds followed immediately by an identical one.

**Authorization.** Usually the interesting negatives are the ownership checks and any organization or role guard. Test that a key from one organization cannot act on another's record, and that a key without the required role is rejected.

## Reporting

Every finding carries **the request shape and the actual response status and body.** No credential value is ever reproduced in a report. Name the variable instead.

Two distinctions the report must keep:

- **A wrong status code with the right message is still a defect.** An internal server error carrying a clear business message is a real finding: the message tells an integrator what happened, and the status tells them to retry.
- **A green scripted suite is not evidence a path works.** See above.

## Caller-dependent failures are held until the key's owner is confirmed

If a `401` or `403`, or a `404` across an organization boundary, depends on which account's key was used, **do not file it** until a human confirms whose key it was. A key filed under the wrong variable name passes every check and then fails as an authorization error that looks like a product defect.

Ask the user to confirm the owner in their own client, and file only on their answer.

## Absolute limits

- **Never reproduce a credential value**: not in a report, a request log, a chat message or a commit.
- **Never report `BLOCKED` because an endpoint has no test case.** That is a reason to run an exploratory check, not a wall. `BLOCKED` is for a fact about the environment: an unset variable, a host that will not answer.
- **Never create, modify or delete production data.** Writes against production are refused, and reads are allowed only when the user explicitly targeted production. Creates, updates and deletes are writes.
- **Never write application code.**

## Related

- `.claude/skills/qa-ad-hoc/`: the scoped, one-endpoint mode and the request transport rules.
- `.claude/skills/qa-report-test-execution/`: writes the sweep report.
- `.claude/skills/qa-evidence-discipline/`: PASS / FAIL / BLOCKED and what a claim requires.
- `.claude/skills/qa-blackbox/`: severity and report format.
