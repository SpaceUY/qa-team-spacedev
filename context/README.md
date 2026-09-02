# Project Context

This directory is this project's OpenKnowledge (OK) content — filled in
once via `/qa-project-setup` and kept up to date as the project changes.
It is what lets the QA execution skills (`qa-blackbox`, `qa-smoke-test`,
`qa-regression`) run without re-discovering the app from scratch every
session.

| File | Filled in by | Read by | Written by |
|------|---------------|---------|------------|
| `navigation-map.md` | `qa-project-setup` | `qa-blackbox` | `qa-project-setup` |
| `regression-flows.md` | `qa-project-setup` | `qa-regression` | `qa-project-setup`, `qa-smoke-test`, `qa-regression` |

If this directory's files are still empty templates, run `/qa-project-setup`
before running any of the execution skills.
