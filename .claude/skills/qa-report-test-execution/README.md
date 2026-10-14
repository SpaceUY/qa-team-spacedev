# qa-report-test-execution

Internal helper. It turns the results of a QA run into the standard report files. You normally never run it yourself: the test skills call it at the end of a run.

**What it writes (per run, per folder):**

- `evidence/{hostname}/{subpath}/{YYYY-MM-DD}/qa-report.md`: the record. Never overwritten; a second run on the same day merges into it.
- `evidence/{hostname}/AUDIT-SUMMARY-{YYYY-MM-DD}.md`: only when more than one flow, test case or endpoint ran.
- `qa-report.html` beside the markdown, via `qa-report-render`.

**Inputs it expects** (passed by the calling skill):

- `test_type`: regression, api, app or smoke
- `hostname` and `subpath`, derived from the base URL and the tested path (CLAUDE.md naming rules)
- `date`
- `project_language` (Step 0.4 of CLAUDE.md) and `viewport_scope` (Step 0.5)
- the results, bugs and screenshot list collected during the run

**Setup:** nothing to install. Follow the top-level `README.md` and `CLAUDE.md` for `.env` and Playwright MCP.

**Invocation:** from a test skill, as `Invoke skill: qa-report-test-execution` with the arguments above. Not user-typed.

**After it runs:** if you want the bugs filed, run `/report-bugs-to-clickup <report_path>` yourself. Nothing is sent to ClickUp automatically.

Full protocol: `SKILL.md` in this folder.
