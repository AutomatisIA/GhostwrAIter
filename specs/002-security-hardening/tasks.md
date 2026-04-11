---

description: "Task list for feature 002-security-hardening"
---

# Tasks: Security hardening and dependency refresh

**Input**: Design documents from `/specs/002-security-hardening/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: test tasks are included because the project constitution (`.specify/memory/constitution.md`, principle IV) mandates TDD for every testable behavior, and the implementation plan explicitly orders test-first sequencing for every behavioral change in this feature.

**Organization**: tasks are grouped by user story. Dependency-refresh work is placed in the Foundational phase because it blocks every other phase of the feature. Verification of non-regression is split: Phase 4 (User Story 2) verifies that the hardening work of Phase 3 did not break existing functionality; Phase 8 (Polish) verifies that the entire shipped feature is clean.

**Revision note (2026-04-11)**: this task list was updated after `/speckit-analyze` to address two MEDIUM findings — finding C1 (TDD coverage gap for the DevTools gating requirement FR-011) and finding C2 (implicit regression coverage for FR-022). A new test task T028 was inserted in Phase 3 and all subsequent task IDs were shifted by one. The new T038 explicitly names the existing skill-runner and codex-cli-runner tests as the FR-022 regression oracle.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: user story the task belongs to (US1, US2, US3, US4, US5)
- File paths are absolute from repository root

## Path Conventions

- Main-process code: `app/main/`
- Preload: `app/preload/`
- Renderer: `app/renderer/`
- Shared types: `app/shared/`
- Unit and component tests: `tests/unit/`
- End-to-end tests: `tests/e2e/`
- Build config: `electron.vite.config.ts`
- Package manifest: `package.json`
- Documentation: `docs/`

---

## Phase 1: Setup (capture baseline)

**Purpose**: record the current state of the project so any regression introduced during the feature is attributable to a specific task. No code change in this phase.

- [ ] T001 Confirm the working tree is clean on the `002-security-hardening` branch by running `git status` at the repository root, and stop the feature if any uncommitted file is present outside `dist-app/` or `dist-launcher/`.
- [ ] T002 Capture the baseline dependency-audit output by running `npm audit --json > /tmp/audit-baseline.json` at the repository root. Keep the file for later comparison.
- [ ] T003 Capture the baseline test output by running `npm test` at the repository root and confirming it is currently green on the `002-security-hardening` starting commit. If it is not, stop and resolve before touching anything else in this feature.
- [ ] T004 Capture the baseline TypeScript and lint output by running `npm run typecheck` and `npm run lint` at the repository root and confirming both are green.
- [ ] T005 [P] Read `.specify/memory/constitution.md` once more to re-anchor on principles I to VI before any code change.

---

## Phase 2: Foundational (dependency refresh — blocks every user story)

**Purpose**: upgrade the entire dependency tree to the latest stable versions, remove the dead dependency, rebuild the native module, and confirm the project still starts, tests, builds and audits clean on the refreshed tree. Every subsequent phase runs on top of this state; do not begin Phase 3 until this phase is green end-to-end.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Removal and patch/minor bumps

- [ ] T006 Remove `drizzle-orm` from `dependencies` in `/Users/philippe/Dev/LinkedIn-poster/package.json`, following research decision D2, and regenerate the lockfile by running `npm install` at the repository root.
- [ ] T007 Upgrade the patch-bump packages (`better-sqlite3`, `react`, `react-dom`, `@testing-library/react`) by running `npm install better-sqlite3@latest react@latest react-dom@latest @testing-library/react@latest` at the repository root. Verify the resolved versions in `/Users/philippe/Dev/LinkedIn-poster/package.json`.
- [ ] T008 Upgrade the minor-bump packages (`react-router-dom`, `zod`, `typescript-eslint`, `@playwright/test`, `playwright`) by running `npm install react-router-dom@latest zod@latest typescript-eslint@latest @playwright/test@latest playwright@latest`. Verify the resolved versions in the manifest.
- [ ] T009 Upgrade the type packages (`@types/node`, `@types/react`, `@types/react-dom`, `@types/better-sqlite3`) by running `npm install -D @types/node@latest @types/react@latest @types/react-dom@latest @types/better-sqlite3@latest`. Align the `@types/node` major with the Node runtime that ships with the target Electron.

### Major bump cluster (Vite, Vitest, plugin-react, TypeScript)

- [ ] T010 Upgrade the Vite/Vitest/plugin-react/TypeScript major cluster **as a single atomic install step** by running `npm install -D vite@latest electron-vite@latest @vitejs/plugin-react@latest vitest@latest typescript@latest` at the repository root, per research decisions D4 and D5. Do NOT split this command into separate installs.
- [ ] T011 Read the electron-vite v5 changelog and update `/Users/philippe/Dev/LinkedIn-poster/electron.vite.config.ts` to resolve any config-shape breaking changes surfaced by the cluster upgrade. Typecheck the file by running `npm run typecheck`.
- [ ] T012 Resolve any TypeScript 6 compilation errors across the project by running `npm run typecheck` and fixing each error at its source file. If a new strictness rule produces more than a few hours of migration work, follow the contingency in research decision D5 and downgrade TypeScript to the latest 5.9.x, documenting the downgrade in `/Users/philippe/Dev/LinkedIn-poster/specs/002-security-hardening/research.md` under a new subsection.
- [ ] T013 Resolve any Vitest 4 test-config breaking changes by running `npm test` and fixing config or test imports as the suite surfaces failures. The failure point is where Vitest 4 differs from 3; do not alter test assertions to paper over real regressions.

### Major bump: ESLint and JSDOM

- [ ] T014 Upgrade ESLint and its React plugins as a single step by running `npm install -D eslint@latest eslint-plugin-react-hooks@latest eslint-plugin-react-refresh@latest jsdom@latest globals@latest` at the repository root, per research decisions D6 and D7.
- [ ] T015 Resolve ESLint 10 config-format breaking changes in `/Users/philippe/Dev/LinkedIn-poster/eslint.config.js` by running `npm run lint` and fixing each error or deprecation. If the React plugins do not yet declare peer compatibility with ESLint 10 at implementation time, follow the contingency in D6 and stay on the latest 9.x, documenting the decision in research.md.

### Major bump: Electron

- [ ] T016 Upgrade Electron by running `npm install -D electron@latest` at the repository root, per research decision D1. Record the resolved version in a brief note added to the research.md decision D1 section, so the team can trace which major was shipped.
- [ ] T017 Read the Electron cumulative breaking-changes document from version 38 to the new version and audit every API in use by `/Users/philippe/Dev/LinkedIn-poster/app/main/index.ts`, `/Users/philippe/Dev/LinkedIn-poster/app/main/db/database.ts`, `/Users/philippe/Dev/LinkedIn-poster/app/main/workspace/workspace.service.ts`, and every file under `/Users/philippe/Dev/LinkedIn-poster/app/main/domains/` for changes. Migrate each affected call site in place.
- [ ] T018 Rebuild the native `better-sqlite3` binary against the new Electron target by running `npm run rebuild:native:electron` at the repository root. If the rebuild fails, follow the `NODE_MODULE_VERSION` runbook in `/Users/philippe/Dev/LinkedIn-poster/docs/exploitation.md`.

### Foundational verification

- [ ] T019 Run `npm audit` at the repository root and confirm zero vulnerabilities at any severity level. If the audit reports a new vulnerability introduced by the upgrade cluster, apply the contingency decision tree in research decision D13 and document the chosen path in research.md.
- [ ] T020 Run `npm test` at the repository root and confirm every existing unit and component suite still passes on the refreshed dependency tree.
- [ ] T021 Run `npm run typecheck` and `npm run lint` at the repository root and confirm both are green.
- [ ] T022 Run `npm run dev` at the repository root, wait for the window to open, navigate through the seven canonical screens (Strategy, Ideas, Workshop, Library, Calendar, Runner, Settings), and confirm there is no console error and no missing screen. Close the app.
- [ ] T023 Run `npm run build` at the repository root and confirm the packaged build succeeds without critical warnings.

**Checkpoint**: the project runs on the latest stable dependency tree, has zero known vulnerabilities, and has no functional regression. User story phases can now begin.

---

## Phase 3: User Story 1 — Clean security baseline before publication (Priority: P1) 🎯 MVP

**Goal**: Harden the Electron runtime configuration, install navigation guards, enforce a Content Security Policy, gate DevTools to development, and clean up the dynamic DDL anti-pattern, so that the published application is not a ready-to-exploit target on day one.

**Independent test**: run every unit test added by this phase, then launch `npm run dev` and manually execute quickstart step 5 (developer-tools console checks for blocked `window.open` and blocked inline script). Every check must pass without weakening the hardening.

### Tests for User Story 1 (TDD — write failing tests first)

- [ ] T024 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/webpreferences-hardening.test.ts` that imports `createWindow` (or the factory the file exposes) from `app/main/index.ts`, stubs `BrowserWindow` to capture constructor options, and asserts the four mandatory flags (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`) per `contracts/webpreferences-baseline.md`. Observe the test failing before implementation.
- [ ] T025 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/navigation-guards.test.ts` that stubs a `BrowserWindow` whose `webContents` records `.on("will-navigate", ...)` and `.setWindowOpenHandler(...)` attachments, fires synthetic navigation events with same-origin, http external, and opaque origins, and asserts the decisions required by `contracts/webpreferences-baseline.md`. Observe the test failing before implementation.
- [ ] T026 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/csp-injection.test.ts` that invokes the renderer HTML transform (or the plugin hook the implementation introduces) in `production` and `development` modes and asserts the presence and shape of the `<meta http-equiv="Content-Security-Policy">` element per research decision D9. Observe the test failing before implementation.
- [ ] T027 [P] [US1] Extend `/Users/philippe/Dev/LinkedIn-poster/tests/unit/workshop-service.test.ts` with cases for `ensureColumn()`: reject an unknown table name, reject an unknown column symbolic key, accept a whitelisted table+column pair. Observe the new cases failing before implementation (they will fail because `ensureColumn()` still accepts arbitrary interpolation).
- [ ] T028 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/devtools-gating.test.ts` that stubs a minimal `BrowserWindow` exposing a `webContents` object with `openDevTools`, `closeDevTools`, and `on` recorded. With `process.env.ELECTRON_RENDERER_URL` unset (production path), assert that `createWindow()` does NOT call `openDevTools`, and that the `devtools-opened` listener attached to `webContents` calls `closeDevTools` when invoked synthetically. With `ELECTRON_RENDERER_URL` set to a fake dev URL, assert that `openDevTools` IS called and the production guard listener is not attached. This satisfies FR-011 under Constitution IV (TDD). Observe the test failing before implementation.

### Implementation for User Story 1

- [ ] T029 [US1] Update the `webPreferences` literal in `createWindow()` inside `/Users/philippe/Dev/LinkedIn-poster/app/main/index.ts` to set `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true` explicitly, per research decision D8 and `contracts/webpreferences-baseline.md`. Run T024 and confirm it now passes.
- [ ] T030 [US1] Add the `will-navigate` handler and the `setWindowOpenHandler` in `/Users/philippe/Dev/LinkedIn-poster/app/main/index.ts`, per research decision D14 and the policy table in `data-model.md` section 6. Compute the allowlist of origins once at window creation, capture it in a closure, import `shell` from Electron for the `openExternal` delegation. Run T025 and confirm it now passes.
- [ ] T031 [US1] Gate the existing `openDevTools` call on `process.env.ELECTRON_RENDERER_URL` in `/Users/philippe/Dev/LinkedIn-poster/app/main/index.ts`. Add a `devtools-opened` listener that calls `closeDevTools` when the renderer URL env var is absent, per research decision D15. Run T028 and confirm it now passes.
- [ ] T032 [US1] Implement the Content-Security-Policy injection by extending `/Users/philippe/Dev/LinkedIn-poster/electron.vite.config.ts` with a renderer-build transform that inserts the production policy (strict) during `production` mode and the development policy (relaxed to permit Vite HMR) during `development` mode, per research decision D9 and `contracts/webpreferences-baseline.md`. The transform should modify the HTML output, not the source template, to avoid polluting the repository index.html. Run T026 and confirm it now passes.
- [ ] T033 [US1] Rewrite `ensureColumn()` in `/Users/philippe/Dev/LinkedIn-poster/app/main/domains/workshop/workshop.service.ts` to validate `table` and the column symbolic key against an explicit allowlist, per research decision D12. Replace every caller in the same file with the symbolic-key form. Run T027 and confirm it now passes.

### Verification for User Story 1

- [ ] T034 [US1] Run `npm test` at the repository root and confirm every test (existing and newly added) is green.
- [ ] T035 [US1] Run `npm run typecheck` and `npm run lint` at the repository root and confirm both are green.
- [ ] T036 [US1] Launch `npm run dev`, open the developer tools console, run `window.open('https://example.com', '_blank')` and confirm the renderer window does not navigate and the default browser receives the request. Then run `const s = document.createElement('script'); s.src = 'https://example.com/attack.js'; document.head.appendChild(s)` and confirm the browser content-policy blocks it with a visible violation message in the console. Close the app.
- [ ] T037 [US1] Create a commit named `feat(002): harden Electron runtime, CSP, navigation, DDL whitelist` with all US1 changes staged, following the conventional-commit style used in the existing repo history.

**Checkpoint**: the security baseline is in place. The Electron window is sandboxed, the CSP is enforced, external navigation is refused, DevTools are production-gated, and the dynamic DDL helper is whitelist-protected.

---

## Phase 4: User Story 2 — No functional regression for existing users (Priority: P1)

**Goal**: prove that the security baseline hardening introduced in Phase 3 has not broken any existing functionality, by running the full automated test suites and the real-application audit script end-to-end on the US1-hardened build.

**Independent test**: every pre-existing test suite passes, the real-application audit script completes without failure, and a manual walkthrough of the canonical seven-step user journey reaches the end with no new error.

### Implementation for User Story 2

- [ ] T038 [US2] Run the full automated test suite by executing `npm test` at the repository root. Confirm every unit, component, and integration test (where present) is green. This task also serves as the regression oracle for FR-022 (strict Codex execution doctrine preserved): the pre-existing suites `tests/unit/skill-runner.service.test.ts` and `tests/unit/codex-cli-runner.test.ts` verify that the runner still refuses invalid, unavailable, and below-contract Codex outputs rather than degrading to a local fallback; if either of those suites reports a new failure, FR-022 is compromised and the hardening must be revisited before proceeding. If any pre-existing test now fails, the failure is attributable to the US1 hardening; diagnose the mismatch, fix either the test or the implementation as appropriate, and re-run until green.
- [ ] T039 [US2] Run the end-to-end test suite by executing `npm run test:e2e` at the repository root. Confirm every Playwright test is green.
- [ ] T040 [US2] Run the real-application audit script by executing `node scripts/real-app-audit.mjs` at the repository root. Confirm every section (strategy, ideas, workshop, library, calendar, runner, settings) passes.
- [ ] T041 [US2] Launch `npm run dev` and manually walk the canonical seven-step journey: fill Strategy → capture an Idea → produce a draft in the Workshop → create a variant in the Library → schedule it in the Calendar → check Runner diagnostics → export from Settings. Confirm every step succeeds and every screen renders without a console error. Close the app.

**Checkpoint**: User Story 1 is verified non-regressive. Publication of an MVP containing US1 + US2 alone would already satisfy the non-negotiable P1 requirements of the spec. The remaining P2 and P3 stories add resilience and documentation on top.

---

## Phase 5: User Story 3 — Graceful handling of a stuck Codex invocation (Priority: P2)

**Goal**: bound the duration of a Codex invocation, so that a hanging Codex CLI cannot freeze the application indefinitely. On timeout, return a typed failure that flows through the existing error-handling paths.

**Independent test**: the unit test that simulates a hung Codex invocation asserts the typed `CODEX_CLI_TIMEOUT` error is returned; a subsequent normal invocation issued from the same runner succeeds without requiring a restart.

### Tests for User Story 3 (TDD — write failing tests first)

- [ ] T042 [US3] Extend `/Users/philippe/Dev/LinkedIn-poster/tests/unit/codex-cli-runner.test.ts` with a case that injects a `CodexCliCommandExecutor` returning `{ status: null, signal: "SIGTERM", stdout: "", stderr: "" }` to simulate the `spawnSync` timeout shape. Assert that the returned `SkillRunnerResult` has `status: "failed"`, `error.code === "CODEX_CLI_TIMEOUT"`, and `error.message` contains the numeric timeout value. Observe the test failing before implementation.
- [ ] T043 [US3] Add a second case to the same test file that issues a second invocation with a normally-returning executor after the timeout case, and asserts the second invocation succeeds. This proves the runner does not carry corrupted state across invocations. Observe the test failing before implementation.

### Implementation for User Story 3

- [ ] T044 [US3] Add `CODEX_CLI_TIMEOUT` to the `SkillRunnerErrorCode` union in `/Users/philippe/Dev/LinkedIn-poster/app/main/domains/execution/skill-runner.service.ts`, per `data-model.md` section 1.
- [ ] T045 [US3] Extend `defaultExecutor` in `/Users/philippe/Dev/LinkedIn-poster/app/main/domains/execution/codex-cli-runner.ts` to read `process.env.CODEX_CLI_TIMEOUT_MS`, parse it as a positive integer with the default 120 000, and pass the value as the `timeout` option to `spawnSync`, per research decision D10 and `data-model.md` section 4.
- [ ] T046 [US3] Extend the `CodexCliCommandExecutor` return shape in the same file to include optional `signal: NodeJS.Signals | null` so the `execute()` method can detect `signal === "SIGTERM" && status === null` and return the `CODEX_CLI_TIMEOUT` typed error exactly as described in `contracts/codex-timeout-error.md`.
- [ ] T047 [US3] Extend `execute()` in the same file with the timeout-detection branch that constructs the typed `CODEX_CLI_TIMEOUT` error with the effective timeout value substituted into the message template. Run T042 and T043 and confirm both now pass.

### Verification for User Story 3

- [ ] T048 [US3] Run `npm test` at the repository root and confirm every test is green, including T042, T043, and the pre-existing codex-cli-runner cases.
- [ ] T049 [US3] Create a commit named `feat(002): bound Codex CLI invocations with a configurable timeout`.

**Checkpoint**: the Codex runner now has a configurable upper bound on invocation duration and emits a typed error that the existing callers handle uniformly.

---

## Phase 6: User Story 4 — Safe workspace configuration (Priority: P2)

**Goal**: validate `LINKEDIN_POSTER_WORKSPACE_ROOT` at startup, reject any malformed or dangerous value with a clear error, and introduce a defensive `assertUnderRoot` helper for future path builders.

**Independent test**: launching the application with various invalid workspace-root values produces a startup error that names the variable and explains the problem, without creating any file; launching with a valid absolute path succeeds as before.

### Tests for User Story 4 (TDD — write failing tests first)

- [ ] T050 [US4] Extend `/Users/philippe/Dev/LinkedIn-poster/tests/unit/workspace-service.test.ts` with the seven validation cases enumerated in `contracts/workspace-validation-error.md` testing notes (absent, empty, relative, traversal, parent not found, parent not writable, valid). Use a real temp directory fixture with `beforeEach`/`afterEach` cleanup, not mocks. Observe the new cases failing before implementation.
- [ ] T051 [US4] Add three `assertUnderRoot` cases to the same test file (candidate inside root, candidate outside root, candidate equal to root) per `contracts/workspace-validation-error.md`. Observe the cases failing before implementation (the helper does not yet exist).

### Implementation for User Story 4

- [ ] T052 [US4] Add the `WorkspaceConfigurationError` exported class to `/Users/philippe/Dev/LinkedIn-poster/app/main/workspace/workspace.service.ts` with the shape defined in `data-model.md` section 2, including the four enumerated `reason` values and per-reason messages from `contracts/workspace-validation-error.md`.
- [ ] T053 [US4] Add the `WorkspacePathEscapeError` exported class to the same file with the shape defined in `data-model.md` section 3.
- [ ] T054 [US4] Rewrite `resolveWorkspaceRoot()` in the same file to apply the five ordered validation rules from research decision D11 and `contracts/workspace-validation-error.md`. Run T050 and confirm it now passes.
- [ ] T055 [US4] Add and export the `assertUnderRoot(candidate, root)` helper in the same file per research decision D11 and `data-model.md` section 3. Run T051 and confirm it now passes.
- [ ] T056 [US4] Update the startup sequence in `/Users/philippe/Dev/LinkedIn-poster/app/main/index.ts` to wrap the `resolveWorkspaceRoot` call in a try/catch that distinguishes `WorkspaceConfigurationError` from other exceptions, logs the error via `electron-log`, and calls `app.exit(1)` on the configuration error path. No silent fallback.

### Verification for User Story 4

- [ ] T057 [US4] Run `npm test` at the repository root and confirm every test is green.
- [ ] T058 [US4] Manually verify by launching `LINKEDIN_POSTER_WORKSPACE_ROOT="./relative" npm run dev` and confirming the terminal prints the expected error with the `NOT_ABSOLUTE` reason, and the application does not start. Then launch `LINKEDIN_POSTER_WORKSPACE_ROOT="/tmp/../etc/linkedin-poster" npm run dev` and confirm the `TRAVERSAL_SEGMENT` error. Then launch `npm run dev` with no variable and confirm the default path is used and the application starts normally.
- [ ] T059 [US4] Create a commit named `feat(002): validate workspace root at startup with typed errors`.

**Checkpoint**: the workspace boundary is enforced at startup. Misconfigured variables cannot cause silent data-loss-adjacent behavior.

---

## Phase 7: User Story 5 — Clear security documentation for the first contributors (Priority: P3)

**Goal**: document the security posture of the hardened application in `docs/exploitation.md` so that a contributor reading the project can understand what is and is not protected without opening a source file.

**Independent test**: a reader who has never seen the project can read the updated `docs/exploitation.md` and correctly answer what the Codex timeout does, how the workspace root is validated, and whether local data is encrypted at rest.

### Implementation for User Story 5

- [ ] T060 [US5] Add a new "Security posture" section at the end of `/Users/philippe/Dev/LinkedIn-poster/docs/exploitation.md`. Describe the Codex timeout behavior, its default value (120 000 ms), and the `CODEX_CLI_TIMEOUT_MS` environment variable for configuration, per FR-023.
- [ ] T061 [US5] In the same section, document the workspace-root validation rules and the four `WorkspaceConfigurationError` reasons with example messages, per FR-024 and `contracts/workspace-validation-error.md`.
- [ ] T062 [US5] In the same section, add a clearly-titled subsection "Local data is not encrypted at rest" that explains the SQLite database, drafts, and execution-log files are stored in plain text and that synchronizing the workspace to a cloud folder uploads this content, per FR-025.
- [ ] T063 [US5] In the same section, add a "Known out-of-scope security concerns" subsection listing the items deferred to later chantiers (systematic IPC schema validation, cryptographic verification of the Codex binary, encryption at rest) with a short rationale each and a forward reference to the open-source roadmap, per FR-026.
- [ ] T064 [US5] Create a commit named `docs(002): document security posture and known limitations`.

**Checkpoint**: the documentation reflects the new security behaviors. A first-time reader can understand the posture without reading code.

---

## Phase 8: Polish — final verification and shipping

**Purpose**: re-run the complete verification battery against the fully-hardened build after all user stories are in place, confirm the whole feature is clean, and mark the branch ready for `finishing-a-development-branch` (the superpowers post-implementation step).

- [ ] T065 Run `npm audit` at the repository root on the final state of the branch and confirm zero vulnerabilities at any severity level (SC-001). If a new vulnerability has appeared between Phase 2 and Phase 8, apply the research D13 contingency and re-run this task.
- [ ] T066 Run `npm test` at the repository root on the final state and confirm every unit and component suite is green.
- [ ] T067 Run `npm run test:e2e` at the repository root on the final state and confirm every Playwright test is green.
- [ ] T068 Run `npm run typecheck` and `npm run lint` at the repository root on the final state and confirm both are green.
- [ ] T069 Run `node scripts/real-app-audit.mjs` at the repository root on the final state and confirm every section passes (SC-006).
- [ ] T070 Run `npm run build` at the repository root on the final state and confirm the packaged build succeeds without critical warnings (SC-006).
- [ ] T071 Run `npm run package:mac` at the repository root on the final state and manually launch the packaged application. Confirm the window opens, every screen renders, the DevTools are NOT opened automatically, and the canonical seven-step journey works end-to-end (SC-002).
- [ ] T072 Walk quickstart steps 5 and 6 from `/Users/philippe/Dev/LinkedIn-poster/specs/002-security-hardening/quickstart.md` on the packaged build: manually verify the `window.open` navigation guard, the CSP enforcement via a deliberate inline-script injection, and the workspace-root rejection with `LINKEDIN_POSTER_WORKSPACE_ROOT="./relative"` (SC-004, SC-005).
- [ ] T073 Optionally walk quickstart step 7 (Codex timeout) if a suitable local setup is available. Confirm the `CODEX_CLI_TIMEOUT` error surfaces with the configured value substituted in the message (SC-003).
- [ ] T074 Update `/Users/philippe/Dev/LinkedIn-poster/specs/002-security-hardening/research.md` decision D1 with the exact shipped Electron version string, and decisions D5 and D6 with any contingency actually taken (TypeScript or ESLint downgrade, if applicable). If no contingency was taken, add a one-line "Shipped as planned" note under those decisions.
- [ ] T075 Run `git status` and `git log --oneline 8f25a6f..HEAD` at the repository root and confirm the branch contains one commit per user story (four to six commits total: dep refresh, US1 hardening, US3 timeout, US4 workspace, US5 docs), each following the conventional-commit style of the repo history.
- [ ] T076 Create a final commit named `chore(002): verify and record security-hardening rollout` with any trailing documentation touches from T074. Keep the commit small; substantive changes belong to their own story commit.

**Checkpoint**: the feature is fully implemented, fully verified, and ready for the superpowers `finishing-a-development-branch` phase.

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependency. Start immediately.
- **Phase 2 (Foundational dependency refresh)**: depends on Phase 1. Blocks every user story phase. Must finish with a green audit and a green test suite before Phase 3 begins.
- **Phase 3 (User Story 1)**: depends on Phase 2. First value-delivering phase.
- **Phase 4 (User Story 2)**: depends on Phase 3. Verifies non-regression of US1. Cannot start before US1 is fully implemented.
- **Phase 5 (User Story 3)**: depends on Phase 2 and does NOT depend on Phase 3 or Phase 4 structurally, but should run sequentially after Phase 4 so the regression window is clean.
- **Phase 6 (User Story 4)**: depends on Phase 2 and does NOT depend on any other user story structurally. Runs after Phase 5 for commit-history tidiness.
- **Phase 7 (User Story 5)**: depends on Phases 3, 5, and 6 because the documentation references behaviors introduced in those phases.
- **Phase 8 (Polish)**: depends on every previous phase.

### Within each user story

- Tests MUST be written and observed failing before the implementation task that satisfies them (Constitution IV).
- Models and error classes before the services that emit them.
- Services before the callers that catch their errors.
- Verification after implementation, before the commit.
- Commit after each complete user story.

### User-story independence note

User Stories 3 and 4 (P2) are structurally independent of User Story 1 (P1). In a multi-developer setting, they could in principle be worked on in parallel after Phase 2 completes. In a solo setting, sequential execution in the order listed above minimizes commit-history churn and makes it trivial to bisect a regression to a single story.

User Story 5 (P3) depends on User Stories 1, 3, and 4 only in the sense that it *describes* them. It could be written speculatively before the implementation, but that would risk documenting behaviors that change during implementation. Running it last is safer.

### Parallel opportunities

- Phase 1: T005 can run in parallel with any other Phase 1 task.
- Phase 2: no `[P]` marker because every install step touches `package.json` and must be sequential to avoid lockfile conflicts.
- Phase 3: the five test-writing tasks T024, T025, T026, T027, T028 are all `[P]` because they touch five different test files. The implementation tasks T029, T030, T031 all touch `app/main/index.ts` and are NOT parallel with each other; T032 touches `electron.vite.config.ts` and IS parallel with T029/T030/T031; T033 touches `workshop.service.ts` and IS parallel with all other implementation tasks in this phase.
- Phases 5, 6, 7: every task inside a phase is sequential because each phase touches a small, self-contained set of files.
- Phase 8: none of the verification tasks are parallel because they all write to the same terminal and compete for the same Electron window.

---

## Parallel example: User Story 1 tests

```bash
# Launch all five US1 test files in parallel (all failing before implementation):
Task: "Create tests/unit/webpreferences-hardening.test.ts (T024)"
Task: "Create tests/unit/navigation-guards.test.ts (T025)"
Task: "Create tests/unit/csp-injection.test.ts (T026)"
Task: "Extend tests/unit/workshop-service.test.ts with ensureColumn cases (T027)"
Task: "Create tests/unit/devtools-gating.test.ts (T028)"
```

Then run `npm test` once and confirm all five new test blocks fail for the right reasons before proceeding to T029.

---

## Implementation Strategy

### MVP first

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational dependency refresh) with zero audit vulnerabilities and all existing tests green.
3. Complete Phase 3 (User Story 1) with all new unit tests green.
4. Complete Phase 4 (User Story 2) with all existing suites and the real-app-audit green against the US1-hardened build.
5. **STOP and validate**: the branch at this point already satisfies the two P1 user stories, which are the non-negotiable requirements for open-source publication. If shipping pressure is high, this is the minimum viable hardening.

### Incremental delivery

6. Complete Phase 5 (User Story 3 — Codex timeout).
7. Complete Phase 6 (User Story 4 — workspace validation).
8. Complete Phase 7 (User Story 5 — documentation).
9. Complete Phase 8 (Polish — final verification battery).
10. Hand off to the superpowers `finishing-a-development-branch` phase.

### Parallel team strategy

This feature is best executed sequentially by a single contributor because every touched file is load-bearing and because the dependency refresh in Phase 2 creates a global state change. If multiple contributors are available, the only meaningful parallelism is between the five US1 test files (T024-T028) and potentially between the test-writing and the (yet-to-start) research review by a second reader. Parallelising the implementation itself is not recommended on a branch this sensitive.

---

## Notes

- `[P]` tasks touch different files and have no incomplete dependencies.
- `[Story]` label maps a task to its user story for traceability.
- Every behavioral change is preceded by a failing test (Constitution IV).
- Commit after each completed user story, not after each task; the commit message maps to the story.
- Stop at any checkpoint to validate the story independently.
- Avoid: vague tasks, implicit cross-story dependencies that break independence, silent hardening weakening to make a test pass, skipping the native-module rebuild step after the Electron upgrade.
