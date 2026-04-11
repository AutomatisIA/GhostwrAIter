# LinkedIn Poster Development Guidelines

Auto-generated from active specifications. Last updated: 2026-04-10

## Active Technologies
- TypeScript 5.9+ compiled by Vite and electron-vite. Node runtime is the one bundled with the target Electron version. (002-security-hardening)
- local SQLite database at `${workspace}/data/linkedin-poster.db`, accessed through `better-sqlite3`. Unchanged by this feature except for the workspace-path validation that gates every write under the workspace root. (002-security-hardening)

- To be confirmed during `/speckit.plan`

## Project Structure

```text
docs/
.specify/
specs/
```

## Commands

- `specify check`
- `specify version`

## Code Style

Project standards will be finalized from approved implementation plans.

## Recent Changes
- 002-security-hardening: Added TypeScript 5.9+ compiled by Vite and electron-vite. Node runtime is the one bundled with the target Electron version.

- 001-linkedin-editorial-cockpit: Added initial spec-kit project scaffolding and product specification draft

<!-- MANUAL ADDITIONS START -->
- Development rule: TDD is mandatory for all testable behavior. Write the test first, observe failure, implement the minimum passing code, then refactor.
<!-- MANUAL ADDITIONS END -->
