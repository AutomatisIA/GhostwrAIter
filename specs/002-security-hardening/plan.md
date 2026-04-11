# Implementation Plan: Security hardening and dependency refresh

**Branch**: `002-security-hardening` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-security-hardening/spec.md`

## Summary

Harden the Electron runtime configuration, refresh the entire dependency tree to the latest stable releases, add a startup-time validation to the workspace root, subject Codex command-line invocations to a bounded-time policy, clean up a dynamic DDL anti-pattern, and document the resulting security posture. The work must leave zero CVE reported by `npm audit`, keep the strict Codex execution doctrine intact, and cause no visible regression for existing users.

The technical approach is surgical: every change is localized to a file that already exists (main entrypoint, preload, codex runner, workspace service, workshop service, renderer HTML entry, package manifest, exploitation docs). No new abstractions, no new modules, no new test frameworks. The only structural addition is a small validation helper for the workspace root, co-located with `workspace.service.ts`.

## Technical Context

**Language/Version**: TypeScript 5.9+ compiled by Vite and electron-vite. Node runtime is the one bundled with the target Electron version.
**Primary Dependencies** (current → target for this feature):
- `electron` 38.3.0 → latest stable major (≥ 41.2.0 per published CVE fix, install with `@latest` at implementation time and pin the resolved version).
- `drizzle-orm` 0.44.6 → **removed** (dead dependency, not imported anywhere in source).
- `better-sqlite3` 12.4.1 → latest stable compatible with the target Electron major (requires native rebuild via `@electron/rebuild`).
- `react`, `react-dom` 19.2.0 → latest stable 19.x.
- `react-router-dom` 7.9.4 → latest stable 7.x.
- `zod` 4.1.12 → latest stable 4.x.
- `electron-log` 5.4.3 → latest stable 5.x.
- `vite` 7.1.7, `electron-vite` 4.0.0, `@vitejs/plugin-react` 5.0.4 → latest stable compatible.
- `vitest` 3.2.4, `@testing-library/react` 16.3.0, `@testing-library/user-event` 14.6.1 → latest stable compatible.
- `playwright` / `@playwright/test` 1.55.0 → latest stable.
- `typescript` 5.9.3, `typescript-eslint` 8.45.0, `eslint` 9.37.0, `eslint-plugin-react-hooks` 5.2.0, `eslint-plugin-react-refresh` 0.4.23 → latest stable.
- `@electron/rebuild` 4.0.3, `electron-builder` 26.8.1 → latest stable.
- Type packages (`@types/node` 24.6.1, `@types/react` 19.2.2, `@types/react-dom` 19.2.2, `@types/better-sqlite3` 7.6.13) → latest stable aligned with their runtime siblings.
- `globals` 16.4.0, `jsdom` 27.0.0 → latest stable.

**Storage**: local SQLite database at `${workspace}/data/linkedin-poster.db`, accessed through `better-sqlite3`. Unchanged by this feature except for the workspace-path validation that gates every write under the workspace root.

**Testing**: Vitest for unit and component tests, Playwright for end-to-end against the built Electron app, and `scripts/real-app-audit.mjs` as a live regression probe. No new test framework; existing suites must keep passing.

**Target Platform**: macOS Apple Silicon today. Windows and Linux support is the scope of chantier 3 and is explicitly out of this feature.

**Project Type**: single-process Electron desktop application with three layers (main / preload / renderer) and a shared types package.

**Performance Goals**: preserve the current latency envelope. Codex generations that currently complete in well under a minute must continue to do so. A newly introduced default timeout of 120 seconds must never trip on a normal generation. Electron startup time must not regress by more than ~200 ms from the baseline.

**Constraints**: fully offline-capable except for Codex CLI invocations, single-user, strict Codex execution (no degraded fallback, preserved per FR-022), local-first storage, no remote telemetry.

**Scale/Scope**: ~70 TypeScript/TSX source files, ~10 000 lines of code, 7 business domains, 28 IPC channels, 8 Codex skills. This feature touches roughly a dozen source files and the dependency manifest, not the domain services themselves.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0:

| Principle | Status | Notes |
|---|---|---|
| I. Local-First and Confidential by Default | ✅ Pass | The feature strengthens confidentiality by hardening the runtime container and fixing a workspace escape vector. It does not introduce any remote backend, telemetry, or cloud dependency. |
| II. Workflow Before Prompting | ✅ Pass | No change to the editorial workflow. All user-facing screens and flows stay identical. |
| III. Specialized Skills with Structured I/O | ✅ Pass | The Codex timeout extends the existing typed-error contract (`CODEX_CLI_FAILED`, `CODEX_CLI_INVALID_JSON`, etc.) with a new variant (`CODEX_CLI_TIMEOUT`). No new I/O shape, no ad-hoc channel. |
| IV. Test-First Development Is Mandatory | ⚠ Required discipline | Every behavioral change in this feature (sandbox enablement, workspace validation, Codex timeout, DDL whitelist, CSP enforcement) must be driven by a failing test written first. See the Testing Strategy section below for the specific test files that will be added or extended. |
| V. Human Validation Over Autonomous Publishing | ✅ Pass | No change to the publishing path, no automation introduced. |
| VI. Simplicity for MVP, Extensibility for the System | ✅ Pass | The feature is intentionally non-structural: no new module, no new abstraction, no new design pattern. Every change is a surgical edit to an existing file. |

**Gate result**: pass with no violations. The Complexity Tracking table is empty.

**Post-Phase-1 re-check** (2026-04-11): the Phase 0 research log and the Phase 1 artifacts (`data-model.md`, `contracts/*.md`, `quickstart.md`) were re-read against the six principles after generation. No new concern surfaced. The new error variants and typed configuration entries (`CODEX_CLI_TIMEOUT`, `WorkspaceConfigurationError`, `WorkspacePathEscapeError`, `CODEX_CLI_TIMEOUT_MS`) extend the existing structured I/O contract rather than introducing a parallel channel, so principle III is strengthened, not diluted. Principle IV is captured by the explicit TDD ordering in the Testing Strategy section above. No complexity-tracking entry added.

## Project Structure

### Documentation (this feature)

```text
specs/002-security-hardening/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — decisions, version pinning, migration notes
├── data-model.md        # Phase 1 output — shape of new typed errors and validation rules
├── quickstart.md        # Phase 1 output — how to verify the hardening end-to-end
├── contracts/           # Phase 1 output — internal contracts touched by this feature
│   ├── codex-timeout-error.md
│   ├── workspace-validation-error.md
│   └── webpreferences-baseline.md
├── checklists/
│   └── requirements.md  # Already produced by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — not in this command)
```

### Source Code (repository root)

Files **touched** by this feature (all already exist except where noted):

```text
app/main/index.ts
  — webPreferences explicit hardening: sandbox, contextIsolation,
    nodeIntegration, webSecurity.
  — Conditional DevTools: dev only.
  — Window-open and navigation handlers: block external origins.

app/main/workspace/workspace.service.ts
  — resolveWorkspaceRoot() rewritten to validate the env var and
    throw a typed WorkspaceConfigurationError on failure.
  — New internal helper assertUnderRoot(path, root) used by any
    future path builder in this file.

app/main/domains/execution/codex-cli-runner.ts
  — defaultExecutor() reads CODEX_CLI_TIMEOUT_MS (default 120 000).
  — spawnSync() receives the timeout option.
  — execute() detects SIGTERM signal from timeout and maps to the
    CODEX_CLI_TIMEOUT typed error.
  — Type CodexCliCommandExecutor extended with optional timeoutMs
    result field so tests can simulate timeouts via the injected
    executor.

app/main/domains/workshop/workshop.service.ts
  — ensureColumn() rewritten with table/column whitelist.
  — Internal callers updated to pass whitelisted names only.

app/renderer/index.html
  — <meta http-equiv="Content-Security-Policy" ...> inserted in
    <head>. Environment-aware via a small build-time injection in
    electron-vite.config.ts (see below).

electron.vite.config.ts
  — Renderer build plugin injects CSP meta tag with the strict
    production policy when building for production. In dev, a
    relaxed policy is injected that permits Vite HMR websockets
    and inline scripts.

package.json
  — Remove drizzle-orm.
  — Bump every dependency and devDependency to latest stable.
  — Ensure @electron/rebuild + electron-builder resolve correctly
    against the new Electron major.

package-lock.json
  — Regenerated by npm install.

docs/exploitation.md
  — New section "Security posture" documenting:
    * Codex timeout default and configuration (CODEX_CLI_TIMEOUT_MS).
    * Workspace root validation rules and error messages.
    * Unencrypted local storage and cloud-sync caveat.
    * Known out-of-scope items (IPC schema validation, SQLite
      encryption, Codex binary verification) linked to chantiers
      2, 3, 4, 5, 6 for follow-up.
```

New test files **added** by this feature (TDD discipline):

```text
tests/unit/webpreferences-hardening.test.ts
  — Asserts createWindow() passes a webPreferences object with the
    four required flags set to their secure values. Loads index.ts
    with a stubbed BrowserWindow constructor that records the
    options it receives.

tests/unit/workspace-service.test.ts
  — Extended: new cases for empty string, relative path, traversal
    segments, non-absolute path, and valid path. Each case asserts
    the expected WorkspaceConfigurationError or success.

tests/unit/codex-cli-runner.test.ts
  — Extended: new cases for timeout on spawnSync (simulated via
    injected executor that returns signal: "SIGTERM" and status:
    null), assertion that the typed error CODEX_CLI_TIMEOUT is
    returned, and that a subsequent normal invocation succeeds.

tests/unit/workshop-service.test.ts
  — Extended: new case for ensureColumn() rejecting an unknown
    table name and an unknown column name. Internal helper export
    or test-only export required.

tests/unit/csp-injection.test.ts  (NEW)
  — Asserts the built renderer HTML in production mode contains
    the strict CSP meta tag, and the dev variant contains the
    relaxed policy. Runs against the output of electron-vite
    build with a fixture config.

tests/unit/navigation-guards.test.ts  (NEW)
  — Asserts will-navigate and setWindowOpenHandler handlers block
    external origins and delegate to shell.openExternal for http(s)
    links. Uses a stubbed BrowserWindow with webContents mock.
```

Files **not touched** by this feature:

- Any file under `app/main/domains/` other than `execution/codex-cli-runner.ts` and `workshop/workshop.service.ts`.
- Any file under `app/main/ipc/` (scope of chantier 2).
- Any file under `app/renderer/src/` (scope of chantier 6).
- Any script under `scripts/` (scope of chantier 3).
- Any file under `.github/` (scope of chantier 5, which does not yet exist).

**Structure decision**: no structural change. Every edit lives in the existing tree. The feature is a targeted hardening pass that touches ~12 files in total.

## Phase 0 — Research

Detailed findings go in `research.md`. The research topics addressed:

1. **Latest stable Electron version compatible with `better-sqlite3`** — checked at implementation time with `npm view electron version` and the better-sqlite3 compatibility note. Decision captured as a specific version pinned in package.json.
2. **Known breaking changes between Electron 38 and the target major** — consulted from the Electron breaking-changes documentation for each intervening major. Migration notes captured per API in use.
3. **Chromium sandbox implications on the existing preload bridge** — verified by reading `app/preload/index.ts`: `contextBridge.exposeInMainWorld` is already used, so sandbox activation should not require any preload refactor. Noted as a green-light in the research.
4. **CSP policy suitable for Electron + Vite + React hot-reload** — researched and documented. Decision: strict in production (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`), relaxed in development to allow Vite's HMR websocket and eval-based module replacement.
5. **`spawnSync` timeout semantics on Node 20+** — verified from Node documentation: the `timeout` option causes SIGTERM on expiration, the returned object carries `signal: "SIGTERM"` and `status: null`. Decision: detect this shape and map to `CODEX_CLI_TIMEOUT`.
6. **Workspace root validation strategy** — researched prior art in security-sensitive path handling. Decision: require an absolute path, normalize via `path.resolve`, reject any value whose normalized form does not equal its input, reject values containing traversal segments, and verify the parent directory is writable.
7. **Contingency if a transitive vulnerability survives the upgrade** — decision tree documented: prefer patching upstream, otherwise pin the offending transitive via `overrides` in package.json, otherwise downgrade the direct dependency that pulls it in and document the decision in research.md.

## Phase 1 — Design & Contracts

### Data model (`data-model.md`)

This feature introduces no business entity. It introduces two new typed-error variants that enrich the existing `SkillRunnerResult` error union:

- `CODEX_CLI_TIMEOUT` — emitted when the Codex invocation exceeds the configured timeout.
- `WORKSPACE_CONFIGURATION_INVALID` — emitted during startup when `LINKEDIN_POSTER_WORKSPACE_ROOT` is malformed.

It also introduces one internal configuration variable with documented semantics:

- `CODEX_CLI_TIMEOUT_MS` — positive integer, default 120 000. Parsed at runtime in `codex-cli-runner.ts`.

The full shape, invariants, and state transitions are captured in `data-model.md`.

### Contracts (`contracts/`)

Three internal contracts are tightened by this feature. They are documented as markdown specifications, not as code interfaces, because they govern internal invariants, not external APIs.

- `contracts/codex-timeout-error.md` — shape and emission conditions of the `CODEX_CLI_TIMEOUT` error variant.
- `contracts/workspace-validation-error.md` — validation rules for `LINKEDIN_POSTER_WORKSPACE_ROOT`, shape of `WORKSPACE_CONFIGURATION_INVALID`, and startup behavior on failure.
- `contracts/webpreferences-baseline.md` — mandatory `webPreferences` flags and CSP policy for both production and development builds, with the recognised failure modes (blocked navigation, blocked inline script, blocked external script) documented as expected outcomes rather than errors.

### Quickstart (`quickstart.md`)

Documents how a reviewer or a new contributor can verify, in under fifteen minutes, that the hardening is in place on a given build. The steps include running `npm audit`, launching the app in dev, opening the Developer Tools console, attempting to load a blocked external script via a paste in the URL bar, deliberately setting a broken `LINKEDIN_POSTER_WORKSPACE_ROOT` to observe the startup error, and deliberately crashing a Codex invocation to observe the timeout error.

### Agent context update

Run `.specify/scripts/bash/update-agent-context.sh claude` at the end of Phase 1 so the generated agent context file reflects the technical choices above. This will add the new dependency targets and the two typed errors to the agent context without disturbing the manual additions preserved between markers.

## Testing Strategy

Every behavioral change in this feature is introduced under test-first discipline (Constitution IV). The sequence for each sub-area is:

1. **webPreferences hardening**: write `tests/unit/webpreferences-hardening.test.ts` with a stubbed `BrowserWindow` capturing constructor options, assert the four required flags, observe failure, then edit `app/main/index.ts`.
2. **Navigation guards**: write `tests/unit/navigation-guards.test.ts`, observe failure, then wire `will-navigate` and `setWindowOpenHandler` handlers.
3. **CSP injection**: write `tests/unit/csp-injection.test.ts`, observe failure, then implement the environment-aware CSP injection in the renderer HTML (or via an electron-vite plugin, depending on the cleanest integration point — determined during implementation).
4. **Workspace validation**: extend `tests/unit/workspace-service.test.ts` with rejection cases, observe failure, then rewrite `resolveWorkspaceRoot` with validation.
5. **Codex timeout**: extend `tests/unit/codex-cli-runner.test.ts` with a simulated timeout via the injected executor, observe failure, then add the `timeout` option and the SIGTERM mapping in the runner.
6. **Dynamic DDL whitelist**: extend `tests/unit/workshop-service.test.ts` with rejection cases for `ensureColumn`, observe failure, then rewrite with whitelist enforcement.
7. **End-to-end regression**: once all unit tests are green, run `scripts/real-app-audit.mjs` against the hardened build and verify every section passes.
8. **Packaged build smoke**: run `npm run build` and verify it completes without critical warnings.
9. **`npm audit`**: run and require zero vulnerabilities.

All existing tests must keep passing at every step. No test is disabled, skipped, or loosened for this feature.

## Rollout Plan

This feature is implemented on the `002-security-hardening` branch in a single work unit. At the end, the branch is verified against the full success criteria of the spec and then either merged into the main branch or packaged as a pull request — the decision belongs to the `finishing-a-development-branch` phase of superpowers, which runs after `/speckit-implement` completes.

No partial rollout, no feature flag, no environment-gated behavior: the hardening is either fully present or not merged.

## Risks and Mitigations

1. **Electron major upgrade breaks the renderer build** — Mitigation: the `research.md` file captures the known breaking changes of each intervening major before touching package.json. Each breakage is migrated before the upgrade is declared complete.
2. **`better-sqlite3` native module fails to rebuild against the target Electron** — Mitigation: `@electron/rebuild` upgrade is sequenced before the Electron upgrade; a fresh `rebuild:native:electron` cycle is run and verified before running the test suite.
3. **Strict production CSP breaks a legitimate renderer feature** — Mitigation: the CSP is introduced under a dedicated test (`csp-injection.test.ts`), and the real-app audit script exercises every screen after enforcement. Any regression surfaces immediately.
4. **Workspace validation rejects a legitimate custom path** — Mitigation: the unit tests include both valid-path and invalid-path cases, including a mockable filesystem root for cross-platform safety.
5. **Codex timeout fires on an unusually long but legitimate generation** — Mitigation: default is 120 000 ms, far above the observed maximum. The value is configurable via environment variable for users with slow setups, and the default can be revisited at any time without changing code.
6. **`spawnSync` remains synchronous and blocks the main loop during a legitimate long generation** — *Not mitigated by this feature.* The spec asks for a timeout, not for an asynchronous runner. Migrating to async is explicitly deferred. Documented in research.md as a known limitation to revisit in a later chantier.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(empty)* | *(empty)* | *(empty)* |

No constitution violation, no complexity justification required.
