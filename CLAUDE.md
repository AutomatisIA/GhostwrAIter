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
- TypeScript 6.0.2 (runner refactor + new tests) and ES Modules JavaScript for the bench script (`scripts/eval-editorial-quality.mjs`). No new TypeScript compiler version, no new Vite version, no new Electron version. Node 20 runtime as before. + No new npm dependencies. Reuse `node:fs` for file IO, `node:path` for path resolution, the existing `yaml` devDep already added in feature 005 only if needed (probably not — the doctrine file is parsed by a simple line-based parser). Reuse `playwright` (already devDep) + `_electron.launch()` for the bench harness, exactly as the existing `scripts/benchmark-editorial-quality.mjs` does today. (006-editorial-quality-evaluation)
- The doctrine source lives at `docs/editorial-doctrine.md` (markdown). The eight skill prompts live at `skills/linkedin-<name>/SKILL.md` (markdown). The evaluation report is written to `dist-eval/eval-report-<timestamp>.{md,json}` per run. No SQLite changes, no schema migration, no IPC surface change, no preload contract change. (006-editorial-quality-evaluation)
- TypeScript 6.0.2 (no version change). React 19.2.5 (no version change). Electron 41.2.0 (no version change). Node 20 runtime (no version change). + No new runtime dependencies. The only devDep change is `eslint-plugin-react-hooks` 6.1.1 → 7.x with possible transitive bumps of `eslint` core or `typescript-eslint` per Clarification Q1 (conditional descope policy). (007-code-quality-refactor)
- No schema change to SQLite. The `execution_runs` table receives the same column set with the same types, only via a single shared write helper instead of three inline copies. No migration. No new index. (007-code-quality-refactor)
- TypeScript 6.0.2 + React 19.2.5, React Router DOM 7.14, Electron 41.2.0, electron-vite 5, Vite 7.3.2 (009-ux-overhaul)
- SQLite via better-sqlite3 (local, `${workspace}/data/linkedin-poster.db`) (009-ux-overhaul)

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
- 009-ux-overhaul: Added TypeScript 6.0.2 + React 19.2.5, React Router DOM 7.14, Electron 41.2.0, electron-vite 5, Vite 7.3.2
- 007-code-quality-refactor: Added TypeScript 6.0.2 (no version change). React 19.2.5 (no version change). Electron 41.2.0 (no version change). Node 20 runtime (no version change). + No new runtime dependencies. The only devDep change is `eslint-plugin-react-hooks` 6.1.1 → 7.x with possible transitive bumps of `eslint` core or `typescript-eslint` per Clarification Q1 (conditional descope policy).
- 006-editorial-quality-evaluation: Added TypeScript 6.0.2 (runner refactor + new tests) and ES Modules JavaScript for the bench script (`scripts/eval-editorial-quality.mjs`). No new TypeScript compiler version, no new Vite version, no new Electron version. Node 20 runtime as before. + No new npm dependencies. Reuse `node:fs` for file IO, `node:path` for path resolution, the existing `yaml` devDep already added in feature 005 only if needed (probably not — the doctrine file is parsed by a simple line-based parser). Reuse `playwright` (already devDep) + `_electron.launch()` for the bench harness, exactly as the existing `scripts/benchmark-editorial-quality.mjs` does today.


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
