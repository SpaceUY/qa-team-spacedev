# E2E Tests — Playwright Test Suite

Generic, code-based Playwright Test suite. This is the module to use for
automated regression tests that run in CI, as opposed to `../qa-agent`
which is for interactive, human-in-the-loop QA sessions.

---

## Setup

```bash
npm ci
npx playwright install --with-deps
```

---

## Running the tests

Against the default target (`http://localhost:3000`):

```bash
npm test
```

Against a specific environment:

```bash
BASE_URL=https://staging.your-app.com npm test
```

Headed mode (see the browser while it runs):

```bash
BASE_URL=https://staging.your-app.com npm run test:headed
```

View the last HTML report:

```bash
npm run report
```

---

## Adding tests for a new project

`tests/example.spec.ts` is a template, not a real test — copy its
pattern rather than editing it in place. Convention as the suite grows:
one subfolder per project or feature under `tests/`, e.g.:

```
tests/
├── example.spec.ts
├── otonomi/
│   ├── login.spec.ts
│   └── dashboard.spec.ts
└── catalyst/
    └── checkout.spec.ts
```

Each spec should set its own `test.describe` block and rely on the
shared `baseURL` from `playwright.config.ts` (driven by `BASE_URL`) rather
than hardcoding a host.

---

## Configuration

See `playwright.config.ts`:
- `baseURL` — from `BASE_URL` env var, defaults to `http://localhost:3000`.
- Runs against Chromium, Firefox, and WebKit by default. Narrow to one
  browser locally with `--project=chromium`.
- HTML reporter — open with `npm run report` after a run.
