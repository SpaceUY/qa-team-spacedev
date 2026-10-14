---
name: qa-ad-hoc
description: >-
  The scoped, account-driven mode for API black-box testing: 'check this one
  endpoint', 'does this route reject a foreign key', 'test it as the other
  account', 'poke at the payload'. Takes the API version (if any), the account
  (by its .env variable name) and the base URL as named inputs, reaches ANY
  endpoint, not only ones a suite covers, through a transport ladder that keeps
  the credential out of the transcript, applies the qa-api-regression techniques
  to exactly the thing named, and sizes its output to the run. Not a sweep (that
  is qa-api-regression) and not a scripted suite (that is /qa-regression).
user-invocable: false
allowed-tools: Read, Write, AskUserQuestion, Bash
---

# Ad-hoc API testing

## Prerequisites, inputs, outputs

- **Prerequisites:** `curl` in Bash. A `.env` file at the repo root with the key variable(s) for the account(s) you will use (copy `.env.example`; values single-quoted). The API base URL, asked at run time.
- **Inputs (all asked, none defaulted):**
  - the mode, endpoint or behaviour, in one sentence
  - the API version, if the API has versions
  - the account: the `.env` variable name holding its key
  - the base URL and HTTP method, path and body for the request
  - the expected result, if you have one (otherwise the run is exploratory)
- **Outputs:** inline in the chat. Each check as PASS, FAIL or BLOCKED, with the request shape (credential redacted) and the actual response status and body, and one line on what was not covered. No session report unless the user asks for one.
- **Invocation:** not user-typed as a slash command. The `qa-api-tester` agent runs this mode when the request is a single endpoint or behaviour.

**One named endpoint or behaviour, as one named account, and nothing either side of it, on any endpoint.**

This is the **fallback** mode of `qa-api-tester`. A sweep of the whole API is `qa-api-regression`. A scripted suite is `/qa-regression`. Everything else lands here, which makes this the mode most small checks are actually in.

**So say which mode you are in before the first request.** One line is enough: the mode, the endpoint or behaviour, the version, the account variable name, and the base URL. A user who meant a sweep gets to correct you before the run is spent.

## The account is a parameter, not a credential detail

What a request returns can depend on which organization or role the calling key belongs to, so an unstated account produces a result that reads as a verdict about the endpoint when it is a verdict about the caller.

**Ask for the account by its `.env` variable name, and never default.** Check that the named variable is set, by name only, inside one sourced Bash command. The command prints `set` or `unset`, never the value:

```bash
set -a && source .env && set +a && if [ -n "${ACCOUNT_KEY_VAR:-}" ]; then echo set; else echo unset; fi
```

Replace `ACCOUNT_KEY_VAR` with the name the user gave. If it is `unset`, report `BLOCKED` on that account. Do not guess a neighbouring variable.

**Each variable is one account.** If two accounts are needed for a cross-account check, ask for both variable names. Do not reuse a key under two names.

**If the variable is unset, the check is `BLOCKED`.** Name the variable, point at `.env.example`, and stop for that account. **Never substitute another account's key.**

**The account as stated is the account as reported.** The variable name proves a key is set, never whose key it is. Report the account as the user named it, marked as stated. A `401` or `403` may mean the key belongs to another organization, so hold it until the user confirms the owner (see *Known failures* in `qa-api-regression`).

## The transport ladder: any endpoint, and no credential in the transcript

This mode tests whatever endpoint it was pointed at, including one nothing has called before. The credential still never enters your context, your stdout, or the process list. The ladder below is how both hold. **Take the lowest rung that reaches your endpoint.**

### Rule that applies at every rung

**Never print a credential.** Forbidden, at any rung:

- `echo`, `printf`, `printenv`, `env`, bare `set`, or `export -p` while a credential is set in the shell
- `cat`, `grep` on the values, `head`, `less` or any reader on `.env`
- `curl -v`, `--trace` or `--trace-ascii`, which print request headers including the key
- writing the value to a file, a pipe, a variable you then print, or a commit

The only way a key reaches a request is **inside one Bash command, expanded by the shell from the sourced file**, as shown below. The command text shows `$VARIABLE_NAME`, never the value.

If a permission layer refuses one of these forms, read it as the rule working, not as an obstacle to route around.

### Rung 0: everything that needs no credential, first

Host checks, route existence, health, and the shape of an unauthenticated rejection cost nothing and need no key. Run them first, because they are frequently the whole answer.

```bash
curl -sS -i "{base_url}/{path}"
```

- A route that exists usually answers `401` or `403` without a key, not `404`. That separates "not deployed" from "not authorized" before any key is involved.
- The rejection body names the service that answered. One keyless call settles which host you reached.

A keyless `curl` is always permitted. **What is forbidden is a header carrying a key outside rung 1.**

### Rung 1: the endpoint with the account's key, from `.env`

Ask the user for the header name the API expects (for example `x-api-key`, or `Authorization: Bearer`) and the variable name holding the account's key. Then:

```bash
set -a && source .env && set +a && curl -sS -i -X {METHOD} -H "{HEADER_NAME}: ${ACCOUNT_KEY_VAR}" "{base_url}/{path}"
```

- `ACCOUNT_KEY_VAR` in the command above is a placeholder for the variable name the user gave (for example `PARTNER_KEY`). Keep the `$` and braces so the shell expands it. Do not paste a value.
- Add `-H "Content-Type: application/json" -d '{...}'` for bodies. Bodies are test data, never secrets. Do not put a key in a body.
- For a `Bearer` scheme, put `Authorization: Bearer ${ACCOUNT_KEY_VAR}` in the same way.

### Rung 2: hand the exact command to a human

When rung 1 cannot run (for example, the request must run from a client that only the user has), **stop climbing.** Emit the exact command with the variable name, not a value. Have the user run it and report the status and body they see. Grade those against the expectation.

A rung-2 result is evidence a human observed. Your report says so. It settles the check, but it is not a first-hand observation because you wrote the command.

## Validate the request before sending it

Before any request, confirm with the user, in one line:

- the method, which must be a method the user asked for
- the path, with the version segment if the API has versions
- the body, if any, as JSON
- the expected status, if they have one

**Production writes are refused.** A deliberate read against production is allowed when the user explicitly targeted production. A `POST`, `PUT`, `PATCH` or `DELETE` against production is not sent. Ask the user to run it themselves (rung 2) or to choose a non-production host.

## Confirm the host before spending the run on it

Rung 0 is the host check. If the response does not come from the service you expected, stop and report it as a host problem before any authenticated request.

## Clean up after a write

A `201` on a non-production host leaves a real record. When a write is allowed:

- Delete what you created, confirm it is gone with a read, and report the cleanup.
- **Redact any secret the response returned** (a one-time token, a generated key) from the report. A value the service minted for your test is still a credential.

## Scope, and how it is allowed to grow

**Test exactly what was named.** Not the endpoints beside it, not the rest of the resource, not "while we are here". A run that quietly becomes a sweep spends a budget nobody authorized.

Scope may grow **once, deliberately, and out loud**: when the named check fails and the cheapest discriminating follow-up would say whether the fault is the endpoint, the account or the version. Name the follow-up, run it, and stop. Two requests to localize a failure is diagnosis. Eleven is a sweep with a story attached.

The techniques are those of `qa-api-regression` (partitioning, boundaries, error guessing). What changes is the surface they are pointed at.

## Hazards that produce false findings in a scoped run

Check the named endpoint against the project's known non-bug quirks (`context/navigation-map.md`, section `## Known Non-Bug Quirks`) and the notes in `qa-api-regression`, **before** writing a finding. A two-request run does not have the context to recognize a known trap, which is exactly when one gets filed as a discovery.

## Output, sized to the run

A scoped run does not earn a session report. It produces an answer, and the answer is the deliverable.

Report inline, and keep it to what the run establishes:

- The mode, the endpoint or behaviour, the version, the **account variable name**, and the base URL as given.
- Each check as `PASS`, `FAIL` or `BLOCKED`, with **the request shape (credential redacted) and the actual response status and body.**
- What was *not* covered, in one line. An ad-hoc `PASS` says one thing worked for one account. It must never read as "the endpoint is fine".

**A defect still gets reported.** Findings do not become less real for arriving in a small run. Put the defect in your reply with its evidence, and ask the user whether to run `/report-bugs-to-clickup` on a session report. Do not file a ClickUp ticket yourself.

Write a session report to `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/qa-report.md` (via `qa-report-test-execution`) only if the user asks for one, or if the run grew enough that its coverage is worth recording. Say which you did.

## Absolute limits

- **Never reproduce a credential value.** Name the variable.
- **Never report `BLOCKED` because an endpoint has no test case.** That is rung 1 or rung 2, not a wall. `BLOCKED` is for a fact about the environment: an unset variable, a host that will not answer.
- **Never open a database connection as a verification step.** Output the query for a human, take the value they report, and grade against that.
- **Never create, modify or delete production data.**
- **Never write application code.**

## Related

- `.claude/skills/qa-api-regression/`: the techniques, the version and account rules, and the known-failure rules.
- `.claude/skills/qa-evidence-discipline/`: PASS / FAIL / BLOCKED and what a claim requires.
- `.claude/skills/qa-report-test-execution/`: writes a session report when one is requested.
