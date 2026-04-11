# Phase 0 — Research

**Feature**: Security hardening and dependency refresh
**Branch**: `002-security-hardening`
**Date**: 2026-04-11

This document captures every decision that was unresolved in the specification and every piece of external context that the implementation needs in order to proceed without stopping for research. Each section follows the format **Decision / Rationale / Alternatives considered**.

## Dependency target snapshot

The target versions below were resolved on 2026-04-11 by querying the public registry from the project directory. At implementation time the exact versions may have moved forward by patch releases; the `npm install <pkg>@latest` step should be re-run rather than hard-coded to the values below. The majors listed below are the ones to aim for unless a newer major has been released in the interval.

| Package | Current in repo | Target | Bump type |
|---|---|---|---|
| `electron` | 38.3.0 | 41.2.0 | **major +3** |
| `drizzle-orm` | 0.44.6 | **remove** | dead dependency |
| `better-sqlite3` | 12.4.1 | 12.8.0 | patch |
| `react` | 19.2.0 | 19.2.5 | patch |
| `react-dom` | 19.2.0 | 19.2.5 | patch |
| `react-router-dom` | 7.9.4 | 7.14.0 | minor |
| `zod` | 4.1.12 | 4.3.6 | minor |
| `electron-log` | 5.4.3 | 5.4.3 | unchanged |
| `vite` | 7.1.7 | 8.0.8 | **major +1** |
| `electron-vite` | 4.0.0 | 5.0.0 | **major +1** |
| `@vitejs/plugin-react` | 5.0.4 | 6.0.1 | **major +1** |
| `vitest` | 3.2.4 | 4.1.4 | **major +1** |
| `@playwright/test` | 1.55.0 | 1.59.1 | minor |
| `playwright` | 1.55.0 | 1.59.1 | minor |
| `typescript` | 5.9.3 | 6.0.2 | **major +1** |
| `typescript-eslint` | 8.45.0 | 8.58.1 | minor |
| `eslint` | 9.37.0 | 10.2.0 | **major +1** |
| `eslint-plugin-react-hooks` | 5.2.0 | latest compatible with eslint 10 | — |
| `eslint-plugin-react-refresh` | 0.4.23 | latest compatible with eslint 10 | — |
| `@testing-library/react` | 16.3.0 | 16.3.2 | patch |
| `@testing-library/user-event` | 14.6.1 | 14.6.1 | unchanged |
| `@electron/rebuild` | 4.0.3 | 4.0.3 | unchanged |
| `electron-builder` | 26.8.1 | 26.8.1 | unchanged |
| `jsdom` | 27.0.0 | 29.0.2 | **major +2** |
| `@types/node` | 24.6.1 | align with chosen Node runtime | — |
| `@types/react` | 19.2.2 | align with React 19.2.5 | — |
| `@types/react-dom` | 19.2.2 | align with React 19.2.5 | — |
| `@types/better-sqlite3` | 7.6.13 | latest | — |
| `globals` | 16.4.0 | latest | — |

**Eight packages undergo a major bump.** Each is a potential source of breaking changes and must be validated individually before the feature is declared complete.

## Decision log

### D1 — Electron major upgrade path

**Decision**: Upgrade directly from 38.3.0 to 41.2.0 (the latest stable at research time), skipping the 39 and 40 majors intermediate steps.

**Rationale**: The CVE fix that motivated the upgrade is published against `<39.8.5`, so any 39.8.5+, 40.x, or 41.x would satisfy the dependency audit. Electron's stable cadence is fast and users are expected to run the latest, so installing the newest major from the start avoids a second upgrade a few weeks later. Skipping intermediate majors is explicitly supported by Electron's release policy: breaking changes are cumulative, documented in the "Breaking Changes" file on `main`, and are not re-applied when skipping.

**Alternatives considered**:
- Upgrade to 39.8.5 minimum, the lowest version without the HIGH CVE. Rejected because it would leave the project one or two majors behind on the day of publication and invite immediate issues.
- Stay on 38 and pin a CVE override. Rejected because overriding a HIGH CVE in an application about to go open-source is a bad signal and because the underlying Chromium version on 38 is also old.

**Follow-up during implementation**: read `https://www.electronjs.org/docs/latest/breaking-changes` for the cumulative list of breaking changes from 38 → 41. Known areas to check: `app.getPath()` deprecations, `session.setPermissionRequestHandler` signature changes, any `webPreferences` field renames. No API used by this codebase is on the high-risk deprecation list at the time of writing, but the list must be re-read at implementation time.

**Shipped as planned (2026-04-11)**: Electron upgraded to 41.2.0. Neither typecheck nor lint nor the 132-test suite surfaced any breaking-change migration requirement from 38 → 41 against the APIs used by this codebase. `npm audit` reports zero vulnerabilities after the upgrade. One unrelated fix was required during US2 verification: activating `sandbox: true` forced the preload script to be rebuilt as CommonJS (captured separately in commit `fix(002): make preload sandbox-compatible and drop frame-ancestors meta directive`).

### D2 — Removal of `drizzle-orm`

**Decision**: Remove `drizzle-orm` from `dependencies`. Do not add it back.

**Rationale**: `grep` confirms no import of `drizzle-orm` anywhere in `app/`, `tests/`, or `scripts/`. The only occurrences of the string are in `package.json` and `package-lock.json`. Removing the declaration removes the CVE GHSA-gpj5-g38j-94v9 (HIGH, SQL injection via improperly escaped identifiers) with zero code change.

**Alternatives considered**:
- Upgrade `drizzle-orm` to `>=0.45.2` as recommended by the audit. Rejected because the package is unused; upgrading a dead dependency adds cost without removing it.
- Keep the current version with an explicit `overrides` entry. Rejected for the same reason.

### D3 — `better-sqlite3` native rebuild against Electron 41

**Decision**: Upgrade `better-sqlite3` to 12.8.0, rebuild against Electron 41 via `@electron/rebuild` (already at 4.0.3, unchanged), verify by launching the dev app and running the unit suite that touches the database.

**Rationale**: `better-sqlite3` 12.x supports all currently supported Electron majors. The 12.4.1 → 12.8.0 bump is a patch/minor series that contains bug fixes; the ABI contract with Electron is held by `@electron/rebuild`, which reads the target Electron version from `devDependencies` and rebuilds the `.node` binary accordingly.

**Alternatives considered**:
- Pin `better-sqlite3` to 12.4.1 to minimize change surface. Rejected because the spec mandates "latest stable" and the patch bumps are low-risk.

### D4 — Cluster upgrade of the Vite/Vitest toolchain

**Decision**: Upgrade the following four packages **together** as a single step: `vite` 7 → 8, `electron-vite` 4 → 5, `@vitejs/plugin-react` 5 → 6, `vitest` 3 → 4. Treat the cluster as a single atomic change in the implementation plan.

**Rationale**: These packages share a peer-dependency graph. `electron-vite` 5 requires `vite` 8; `vitest` 4 is aligned with `vite` 8; `@vitejs/plugin-react` 6 is aligned with `vite` 8. Upgrading them separately creates incompatible intermediate states and flaky install resolution. Installing them together with explicit `@latest` tags is the only safe path.

**Known breaking-change areas to verify**:
- `vite` 8 removed or renamed some config entries that `electron-vite` exposes. The `electron.vite.config.ts` file must be re-read against the `electron-vite` 5 changelog.
- `vitest` 4 changed the default pool and reporter defaults; the existing `vitest.config` (inlined in `electron.vite.config.ts` or a dedicated file) must be re-validated.
- `@vitejs/plugin-react` 6 may have renamed its options object.

**Alternatives considered**:
- Stay one version behind on the whole cluster to avoid the synchronization risk. Rejected because it would push a second upgrade into chantier 5 (CI) and mix maintenance with release work.

**Contingency applied at implementation time (2026-04-11)**: the cluster was held at Vite **7.3.2** instead of 8.0.8, because `electron-vite@5.0.0` (the latest stable) peer-depends on `vite ^5.0.0 || ^6.0.0 || ^7.0.0`. A `vite-8`-compatible release of `electron-vite` only exists as `6.0.0-beta.0`, which does not qualify as a stable release per the spec mandate. `@vitejs/plugin-react` was held at **5.2.0** for the same reason (6.0.1 peer-depends on `vite ^8.0.0`). Vitest 4.1.4, electron-vite 5.0.0 and TypeScript 6.0.2 were installed as planned. Revisit this decision in a maintenance commit outside the 002 feature once `electron-vite` publishes a stable vite-8-compatible release.

### D5 — TypeScript 5.9 → 6.0 upgrade

**Decision**: Upgrade `typescript` to 6.0.2 and `typescript-eslint` to 8.58.1 in the same step as the Vite/Vitest cluster (D4).

**Rationale**: The spec requires "latest stable" for every dependency. TypeScript 6.0 is the latest stable at research time.

**Known risks**:
- TypeScript 6.0 is a recent major release post-dating the assistant's knowledge cutoff. The specific breaking changes are not committed to memory and must be consulted from the official TypeScript release notes at implementation time.
- Likely areas of concern based on the TS project's history: tightening of strict flag semantics, removal of long-deprecated compiler options, changes in module resolution defaults.
- The project uses `"strict": true` (to verify at implement time) which means any new strictness introduced in 6.0 will surface at compile time.

**Contingency**: if TypeScript 6.0 introduces a compilation failure that requires more than a few hours of migration, stay on 5.9.x (latest 5.x) and document the downgrade in this research file as a superseding decision. The spec permits a "written justification" for keeping a dependency behind.

**Alternatives considered**:
- Pin TypeScript to 5.9.x explicitly. Rejected as first choice per spec mandate but kept as the contingency path.

**Shipped as planned (2026-04-11)**: TypeScript 6.0.2 installed. `npm run typecheck` is clean on the entire codebase (main process, preload, renderer, shared types, build helpers, test files). No strictness-migration contingency was triggered. No downgrade needed.

### D6 — ESLint 9 → 10 upgrade

**Decision**: Upgrade `eslint` to 10.2.0, and re-align `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh` to whatever stable versions declare peer compatibility with ESLint 10.

**Rationale**: Per spec mandate for latest stable.

**Known risks**:
- ESLint 10 is a recent major and the assistant does not have high-confidence knowledge of its specific breaking changes. The flat config format (already in use in `eslint.config.js`) is unlikely to be removed, as that was the stated goal of the 9.0 migration. Most likely breaking changes: removal of deprecated rule options, changes in default rule severity, potential removal of legacy `.eslintrc` support (already dropped in 9).
- The two React plugins may not yet support ESLint 10 officially. If a peer-dependency resolution fails, the contingency is to stay on ESLint 9 (latest 9.x) and document.

**Contingency applied at implementation time (2026-04-11)**: ESLint was held at **9.39.4** (latest 9.x) instead of 10.2.0 because `eslint-plugin-react-hooks@7.0.1` peer-depends on `eslint ^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0`, which excludes ESLint 10. Additionally, `eslint-plugin-react-hooks@7.0.1` introduces a new discipline rule `react-hooks/set-state-in-effect` that flags pre-existing patterns in `CalendarScreen.tsx` (calling `setState` inside a `useEffect` body). Refactoring those effects is explicitly in the scope of chantier 4 (code quality), not chantier 1 (security hardening). `eslint-plugin-react-hooks` was therefore held at **6.1.1** as a clean major bump from the previous 5.2.0 that does not introduce the new rule, preserving the hardening scope boundary. Revisit both holds in chantier 4 or in a dedicated dependency-maintenance commit.

### D7 — `jsdom` 27 → 29 upgrade

**Decision**: Upgrade `jsdom` to 29.0.2 directly, skipping the 28 major.

**Rationale**: `jsdom` is only used indirectly by `vitest` to provide a DOM for component tests. The component-test surface of this project is small (screens in `tests/unit/*-screen.test.tsx`); any jsdom breakage will surface as a test failure, which is easy to diagnose and fix.

### D8 — Chromium sandbox and preload bridge compatibility

**Decision**: Enable the Chromium sandbox (`sandbox: true`) on the main window. No preload refactor is required.

**Rationale**: `app/preload/index.ts` already uses `contextBridge.exposeInMainWorld("linkedinPoster", {...})` to expose its API. `contextBridge` is the canonical API for exposing functionality to a sandboxed renderer and works correctly under `sandbox: true` provided the preload itself uses only the safe subset of Node APIs (which `app/preload/index.ts` does — it only imports `electron` and type-only imports from `@shared/types`).

**Consequence**: enabling the sandbox will not break the `window.linkedinPoster.*` API. The unit test `tests/unit/webpreferences-hardening.test.ts` must verify the sandbox flag in the options passed to `BrowserWindow`; a manual launch of the dev app must confirm that all screens continue to call their IPC methods without error.

**Alternatives considered**:
- Stay with `sandbox: false` but tighten all other flags. Rejected because sandbox is the single most important Electron security primitive and its cost here is zero thanks to the pre-existing `contextBridge`.

### D9 — Content Security Policy strategy

**Decision**: Inject a `<meta http-equiv="Content-Security-Policy">` element into `app/renderer/index.html` via an `electron-vite` build-time transform. The policy differs between production and development:

**Production CSP**:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self'
```

**Development CSP** (relaxed to allow Vite HMR):

```
default-src 'self' ws:;
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self' ws: http://localhost:* http://127.0.0.1:*;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self'
```

**Rationale**: the production policy is minimal and appropriate for an Electron app that never needs to load remote content. `style-src 'self' 'unsafe-inline'` is necessary because React Router and other React libraries may inject style attributes; the project does not currently use any such library that needs full CSP compliance, but `'unsafe-inline'` on styles (not scripts) is the accepted Electron-security community default. The development policy relaxes only what is needed for Vite's hot-module-replacement pipeline: websockets for HMR notifications, eval-based module replacement, and inline scripts for dev-mode injection. No relaxation is carried over to production.

**Alternatives considered**:
- Inject the CSP via HTTP headers set by the Electron main process on the renderer's `session.webRequest.onHeadersReceived`. Rejected because the `<meta>` approach is simpler, version-controlled directly in the repository, and does not require a listener on every request.
- Fully strict production policy without `'unsafe-inline'` for styles. Rejected because some inline style injection from React is expected and hard to audit exhaustively before publication. This can be revisited once the renderer is audited in chantier 4.

### D10 — Codex runner timeout semantics

**Decision**: Extend the existing `defaultExecutor` in `app/main/domains/execution/codex-cli-runner.ts` to read a timeout value from the environment variable `CODEX_CLI_TIMEOUT_MS`, parse it as a positive integer, fall back to 120 000 ms if absent or invalid, and pass it to `spawnSync` as the `timeout` option.

When `spawnSync`'s timeout fires, Node sends `SIGTERM` to the child and returns a result object with `signal: "SIGTERM"` and `status: null`. The runner detects this shape and returns a typed failure:

```json
{
  "status": "failed",
  "summary": "Codex CLI execution timed out",
  "error": {
    "code": "CODEX_CLI_TIMEOUT",
    "message": "Codex CLI did not respond within <N> ms. Increase CODEX_CLI_TIMEOUT_MS or verify Codex availability."
  }
}
```

**Rationale**: `spawnSync` is the minimum-change path. The `timeout` option is supported on Node 20+ (which Electron 41 bundles) and is documented as the canonical way to bound a synchronous child process. Detection via `signal: "SIGTERM"` and `status: null` is stable Node behavior.

**Known limitation**: `spawnSync` remains synchronous. During a Codex invocation, the Electron main process event loop is blocked entirely. IPC handlers from the renderer cannot respond until the invocation returns, including when the invocation is in the process of timing out (the renderer will see a frozen UI for up to `CODEX_CLI_TIMEOUT_MS` milliseconds in the worst case). This is the pre-existing behavior of the codebase. Migrating to an asynchronous runner (`spawn` + promise wrapper with a timer) is a larger refactor that is intentionally out of scope for this feature. It is listed in this document as a follow-up for a later chantier.

**Alternatives considered**:
- Migrate to asynchronous `spawn`. Rejected for scope reasons. Would require the calling code in `workshop.service.ts`, `ideas-ipc.ts`, `library.service.ts`, `strategy-ipc.ts` to become async-aware at their Codex boundaries. Not a spec requirement.
- Use another synchronous child-process helper that also supports the `timeout` option. Functionally equivalent to `spawnSync` but less explicit about argument passing. Rejected.

### D11 — Workspace root validation strategy

**Decision**: Rewrite `resolveWorkspaceRoot()` in `app/main/workspace/workspace.service.ts` to validate the environment variable against the following rules in order:

1. If `LINKEDIN_POSTER_WORKSPACE_ROOT` is absent or empty string, return the default `join(userDataPath, "workspace")` unchanged.
2. Otherwise, if the value is not an absolute path (`path.isAbsolute(value) === false`), throw `WorkspaceConfigurationError` with a message naming the variable and stating that an absolute path is required.
3. Compute `normalized = path.resolve(value)`. If `normalized` contains any path segment equal to `..` after resolution, throw `WorkspaceConfigurationError` with a traversal message. (After `path.resolve`, a well-formed path should not contain `..`; its presence means the input was malformed and resolved to an unexpected location.)
4. If the parent directory of `normalized` does not exist or is not writable, throw `WorkspaceConfigurationError` with an actionable message distinguishing "parent does not exist" from "parent is not writable".
5. Return `normalized`.

Additionally, a new internal helper `assertUnderRoot(candidate, root)` is exported from the same file. It resolves both paths and throws `WorkspacePathEscapeError` if the normalized candidate is not a descendant of the normalized root. Every existing path builder in the workspace service uses only `path.join(rootDirectory, ...)` with known relative segments, so no caller needs to be refactored today. The helper is included now so that any future contributor who wants to construct a dynamic path has a safe utility sitting right next to the workspace service.

**Rationale**: the validation rules cover the realistic misconfiguration cases without being paranoid. The fail-fast behavior prevents silent data writes to unexpected locations. The `assertUnderRoot` helper is defense-in-depth, not a response to a current vulnerability.

**Alternatives considered**:
- Silently fall back to the default when the env variable is invalid. Rejected because it hides configuration bugs and contradicts FR-013.
- Validate at first path construction instead of at startup. Rejected because failing at startup is simpler to test and easier to diagnose.

### D12 — Dynamic DDL whitelist in `workshop.service.ts`

**Decision**: Rewrite `ensureColumn(db, table, column, definition)` so it validates `table` and the column identifier against explicit allowlists before interpolating. The allowlist is hard-coded in the file and matches the actual call sites.

**Current allowlist for `ensureColumn` callers** (to be confirmed by reading the file at implement time):
- `drafts` table, columns for quality score and tags.
- `execution_runs` table, columns for skill version, input/output JSON, error metadata.

The definition string (which includes the column name and the SQL type) is also whitelisted: the whitelist stores the full definition string per column, and the caller passes only a symbolic key. This removes variable interpolation from the DDL path entirely.

**Rationale**: this is cosmetic hardening because no user input currently reaches `ensureColumn`, but the anti-pattern must not be left in the file on the day of publication. A reviewer reading the file should see a safe helper, not an injection-prone helper protected only by the current call graph.

**Alternatives considered**:
- Delete `ensureColumn` entirely and inline the DDL. Rejected because `ensureColumn` performs idempotency via `PRAGMA table_info`, which is useful for schema evolution and should be preserved.
- Use a migrations library. Rejected as out of scope — the project does not yet have a schema-migration tool, and introducing one is a separate concern for chantier 4.

### D13 — Transitive vulnerability contingency

**Decision**: run the dependency audit at several checkpoints during implementation (after each cluster upgrade) rather than only at the end. If a transitive vulnerability appears at any checkpoint, apply the following decision tree in order:

1. Check if the parent dependency has a newer release that resolves the transitive. If yes, upgrade the parent.
2. Otherwise, add an `overrides` entry in `package.json` pinning the transitive to a fixed version.
3. Otherwise, downgrade the direct dependency that pulls in the offending transitive to a version that does not depend on it, and document the downgrade in a new subsection of this research file.
4. Otherwise, accept the finding only with an explicit written justification, again documented in this file.

**Rationale**: running the audit incrementally localizes the blame to the last upgrade step, which is faster than bisecting at the end.

### D14 — Navigation and window-open guards

**Decision**: In `app/main/index.ts`, after `createWindow()` is invoked and before `loadURL`/`loadFile`, attach two handlers:

1. `window.webContents.on("will-navigate", (event, targetUrl) => {...})`: compare the target URL against the allowed origins (`file://` for production build, the `ELECTRON_RENDERER_URL` origin for dev). If the target is outside the allowlist, call `event.preventDefault()` and optionally delegate to `shell.openExternal(targetUrl)` when the target is a well-formed `http(s)` URL.
2. `window.webContents.setWindowOpenHandler(({ url }) => {...})`: return `{ action: "deny" }` for any target outside the allowlist. For `http(s)` URLs, delegate to `shell.openExternal(url)` before denying so the user's default browser receives the click.

**Rationale**: these are the two Electron entry points where the renderer can trigger navigation that the main process sees. Blocking both is necessary and sufficient to prevent the renderer from loading unexpected content into its own BrowserWindow.

**Alternatives considered**:
- Intercept at the `session.webRequest.onBeforeRequest` level. Rejected because it is overkill for a single-window app with no embedded iframes.

### D15 — DevTools conditional activation

**Decision**: gate the `openDevTools` call on `process.env.ELECTRON_RENDERER_URL`, which is set by `electron-vite` only in development mode. In production (`loadFile` path), `openDevTools` is not called. Additionally, set `window.webContents.on("devtools-opened", () => window.webContents.closeDevTools())` in production mode as a defense-in-depth measure against accidental DevTools opening via keyboard shortcut.

**Rationale**: `ELECTRON_RENDERER_URL` is already used in the existing `createWindow()` to decide between `loadURL` and `loadFile`, so reusing it is the minimum-change path. The closeDevTools defense-in-depth is optional but cheap.

## Open items deferred to implementation

None. All decisions required for implementation are closed in this document.

## Follow-up chantiers

The following topics came up during research but are explicitly out of scope for this feature. They are recorded here so the next chantier (chantier 2 — systematic IPC input validation) inherits the context.

- **Asynchronous Codex runner**: `spawnSync` blocks the main loop. A future migration to async `spawn` with promise-based timeout would allow the UI to remain responsive during long generations. Track in chantier 4 (code quality).
- **Codex binary cryptographic verification**: the current runner trusts any binary found in `PATH`. A future hardening could verify a known-good hash before execution. Track in a late-stage chantier after Windows/Linux portability is resolved in chantier 3.
- **SQLite encryption at rest**: the local database and the execution logs are in plain text. This is documented in `docs/exploitation.md` as part of this feature but not solved. Tracked for a post-launch consideration.
- **IPC schema validation**: the IPC handlers still cast inputs without running them through zod schemas. Explicitly the scope of chantier 2.
