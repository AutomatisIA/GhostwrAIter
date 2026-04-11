# LinkedIn Poster Development Guidelines

Auto-generated from active specifications. Last updated: 2026-04-10

## Active Technologies
- TypeScript 5.9+ compiled by Vite and electron-vite. Node runtime is the one bundled with the target Electron version. (002-security-hardening)
- local SQLite database at `${workspace}/data/linkedin-poster.db`, accessed through `better-sqlite3`. Unchanged by this feature except for the workspace-path validation that gates every write under the workspace root. (002-security-hardening)
- TypeScript 6.0.2 compiled by Vite 7.3.2 + electron-vite 5. Same toolchain as feature 002. (003-ipc-validation)
- no change. SQLite via better-sqlite3. (003-ipc-validation)
- TypeScript 6.0.2 + Vite 7.3.2 + electron-vite 5.0.0 + Electron 41.2.0. Same toolchain as feature 003. (004-cross-platform-portability)

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
- 004-cross-platform-portability: Added TypeScript 6.0.2 + Vite 7.3.2 + electron-vite 5.0.0 + Electron 41.2.0. Same toolchain as feature 003.
- 003-ipc-validation: Added TypeScript 6.0.2 compiled by Vite 7.3.2 + electron-vite 5. Same toolchain as feature 002.
- 002-security-hardening: Added TypeScript 5.9+ compiled by Vite and electron-vite. Node runtime is the one bundled with the target Electron version.


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
