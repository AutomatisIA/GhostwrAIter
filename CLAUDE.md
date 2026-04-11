# LinkedIn Poster Development Guidelines

Auto-generated from active specifications. Last updated: 2026-04-10

## Active Technologies
- TypeScript 5.9+ compiled by Vite and electron-vite. Node runtime is the one bundled with the target Electron version. (002-security-hardening)
- local SQLite database at `${workspace}/data/linkedin-poster.db`, accessed through `better-sqlite3`. Unchanged by this feature except for the workspace-path validation that gates every write under the workspace root. (002-security-hardening)
- TypeScript 6.0.2 compiled by Vite 7.3.2 + electron-vite 5. Same toolchain as feature 002. (003-ipc-validation)
- no change. SQLite via better-sqlite3. (003-ipc-validation)
- TypeScript 6.0.2 + Vite 7.3.2 + electron-vite 5.0.0 + Electron 41.2.0. Same toolchain as feature 003. (004-cross-platform-portability)
- YAML 1.2 for GitHub Actions workflows + Markdown for metadata files. No change to TypeScript 6.0.2 / Node 20 / Electron 41.2.0 runtime. + GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `softprops/action-gh-release@v2`), Dependabot v2. No new npm dependencies. (005-ci-cd-publish)
- N/A — no persistent state introduced by this feature. Workflow artifacts are ephemeral (retained per GitHub's default 90-day policy). (005-ci-cd-publish)

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
- 005-ci-cd-publish: Added YAML 1.2 for GitHub Actions workflows + Markdown for metadata files. No change to TypeScript 6.0.2 / Node 20 / Electron 41.2.0 runtime. + GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `softprops/action-gh-release@v2`), Dependabot v2. No new npm dependencies.
- 004-cross-platform-portability: Added TypeScript 6.0.2 + Vite 7.3.2 + electron-vite 5.0.0 + Electron 41.2.0. Same toolchain as feature 003.
- 003-ipc-validation: Added TypeScript 6.0.2 compiled by Vite 7.3.2 + electron-vite 5. Same toolchain as feature 002.


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
