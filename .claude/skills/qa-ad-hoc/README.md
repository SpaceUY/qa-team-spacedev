# qa-ad-hoc

Scoped API checks: one endpoint or behaviour, as one named account, nothing more.

**Use it when** you want to check a single route ("does this endpoint reject a missing field") rather than sweep the whole API (`qa-api-regression`) or run the scripted suite (the `qa-e2e-runner` agent).

**Before you start**

1. Copy `.env.example` to `.env` at the repo root and fill in the key variable for each account you need. Values must be single-quoted.
2. Have the API base URL ready. It is asked at run time and never assumed.
3. Know the header name the API expects (for example `x-api-key`).

**What you give it (all asked)**

- the endpoint or behaviour, in one sentence
- the API version, if the API has versions
- the account, by its `.env` variable name
- the method, path and body
- the expected result, if you have one

**What you get**

- each check as PASS, FAIL or BLOCKED, with the request (credential redacted) and the actual response
- one line on what was not covered

No session report is written unless you ask for one.

**Invocation:** through the `qa-api-tester` agent, which chooses this mode when the request names a single endpoint. Not a slash command of its own.

**Credential safety:** the key is only ever expanded by the shell from `.env` inside one command. Nothing prints it. See the transport ladder in `SKILL.md`.

Full protocol: `SKILL.md` in this folder.
