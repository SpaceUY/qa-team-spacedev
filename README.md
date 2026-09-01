# QA E2E Toolkit

SpaceDev's shared toolkit for end-to-end testing. Two independent modules —
pick the one that fits what you're doing:

| Module | What it is | When to use it |
|--------|------------|-----------------|
| [`qa-agent/`](./qa-agent) | Claude Code + Playwright MCP black-box QA agent. Claude drives a real browser, runs a standard scenario checklist, and writes a markdown report with screenshots. No test code involved. | Interactive/exploratory QA sessions — auditing a flow or a whole site, ad hoc bug hunting, generating an evidence report to share. |
| [`e2e-tests/`](./e2e-tests) | Traditional [Playwright Test](https://playwright.dev/docs/test-intro) suite (`.spec.ts`), runs via `npx playwright test`. | Automated regression testing you want versioned in code and run in CI on every PR. |

Both modules use [Playwright](https://playwright.dev/) under the hood, but
in different modes: `qa-agent/` uses the Playwright **MCP server** (browser
control exposed as tools Claude calls directly), while `e2e-tests/` uses the
Playwright **Test runner** (compiled `.spec.ts` files executed by a CLI).

## Quickstart — qa-agent

```bash
cd qa-agent
npx playwright install chromium   # one-time
cp .claude/settings.local.json.example .claude/settings.local.json
claude
```

Then tell Claude: *"Navigate to `<URL>` and test the `<flow>` flow."*
See [`qa-agent/README.md`](./qa-agent/README.md) for details.

## Quickstart — e2e-tests

```bash
cd e2e-tests
npm ci
npx playwright install --with-deps
BASE_URL=https://your-app.example.com npm test
```

See [`e2e-tests/README.md`](./e2e-tests/README.md) for details, including
how to add specs for a new project.

## CI

`.github/workflows/e2e.yml` runs the `e2e-tests/` suite on every pull
request and on pushes to `main`. The `qa-agent/` module is interactive-only
and does not run in CI.
