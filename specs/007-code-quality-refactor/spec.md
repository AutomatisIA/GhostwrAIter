# Feature Specification: Code Quality Refactor

**Feature Branch**: `007-code-quality-refactor`
**Created**: 2026-04-12
**Status**: Draft
**Input**: User description: "Code quality refactor — chantier 4 of the LinkedIn Poster roadmap. Six refactor targets bundled in a single feature to clear the technical-debt backlog and unblock the modern eslint-plugin-react-hooks."

## Clarifications

### Session 2026-04-12

- Q: How aggressive should the transitive npm bump chain be if `eslint-plugin-react-hooks@7` requires upgrading `eslint` core or `typescript-eslint` as a side effect? → A: Conditional. Bump everything required as long as no bump invalidates a stabilized feature (CSP, sandbox, IPC validation, hardening, security scripts). If a major transitive bump breaks any of those, US4 is descoped, `eslint-plugin-react-hooks` stays at 6.x, and the situation is recorded as a follow-up in the eslint config comment. This protects features 002-006 from cascading regressions while still attempting the upgrade in good faith.
- Q: Where does the single point of writing to `execution_runs` live? → A: New dedicated file `app/main/domains/execution/execution-runs.repository.ts` exporting a function like `insertExecutionRun(db, payload)`. Separates the low-level persistence concern from the existing `execution.service.ts` which orchestrates the higher-level skill execution logic. Aligns with the existing `*.repository.ts` convention used by `ideas.repository.ts` and `strategy.repository.ts`.
- Q: What is the maximum line count allowed for an individual sub-component extracted from `StrategyScreen.tsx` or `WorkshopScreen.tsx`? → A: Soft cap of 300 lines per sub-component. The 50-line gap above the orchestrator cap (250) accommodates complex forms with multiple grouped fields. If a sub-component still needs to exceed 300 lines after a good-faith decomposition, the file MUST carry an inline justification comment explaining why a further split would harm cohesion.
- Q: Is the TypeScript non-null assertion operator `!` allowed as a fix for the new `noUncheckedIndexedAccess` errors? → A: No. The `!` operator is banned for any new fix introduced to satisfy the activation of `noUncheckedIndexedAccess`. Every fix must be a real type narrowing — early return, explicit length check, optional chaining with fallback, or destructuring with default. The diff review at merge time must confirm zero new `!` operators introduced for this flag. Pre-existing `!` usages elsewhere in the codebase are out of scope and untouched.
- Q: Do the new shared helpers `createId` and `insertExecutionRun` get their own dedicated unit test files, or are they covered indirectly through the existing call-site tests? → A: Dedicated unit test files. Add `tests/unit/create-id.test.ts` (covering prefix preservation, id shape, uniqueness across many calls, the optional `index` parameter behavior) and `tests/unit/execution-runs-repository.test.ts` (covering insert shape, column values, JSON serialization of the payload, and idempotence). Direct tests give an immediate signal when a refactor breaks the helper, instead of producing a confusing failure cascade in unrelated call-site tests.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Maintainer reads either monolithic screen and finds it navigable in seconds (Priority: P2)

A maintainer (Philippe today, an external contributor tomorrow) opens `StrategyScreen.tsx` or `WorkshopScreen.tsx` to fix a bug or modify one section. Today both files are over 500 lines and the maintainer has to scroll for several minutes to locate the relevant section. After this feature, each screen is at most ~250 lines, and each logical section (a strategy form, a workshop step) lives in its own named sub-component file. The maintainer locates the relevant code in under 30 seconds and can edit one section without re-reading the rest.

**Why this priority**: P2 because the screen split is the highest-impact item for long-term maintenance, but it carries the most regression risk and depends on the simpler refactors landing first. The deduplication and tooling upgrades (US1–US4) deliver value immediately and unblock the screens by making them safer to touch.

**Independent Test**: Open `app/renderer/src/features/strategy/StrategyScreen.tsx` and `app/renderer/src/features/workshop/WorkshopScreen.tsx`. Each must be under 250 lines. The corresponding `components/` directory must contain at least four named sub-components per screen. Every existing test under `tests/unit/strategy-*.test.tsx` and `tests/unit/workshop-*.test.tsx` must pass without modification of any assertion text.

**Acceptance Scenarios**:

1. **Given** the maintainer opens `StrategyScreen.tsx` after the refactor, **When** they scroll the file from top to bottom, **Then** they see an orchestrator under 250 lines that delegates each editorial section (profile, offers, ICPs, pillars, voice rules) to a named sub-component, and they can navigate to any section's file in one click.
2. **Given** the maintainer opens `WorkshopScreen.tsx` after the refactor, **When** they scroll the file, **Then** they see an orchestrator under 250 lines that delegates each editorial step (idea, structure, hook, draft, variant) to a named sub-component.
3. **Given** the existing strategy and workshop unit tests, **When** the test suite runs after the refactor, **Then** every test passes without any change to assertion strings — only the test file's import paths may need updating if a screen was renamed (which it is not in this feature).
4. **Given** an end-to-end manual exercise of both screens (saving a strategy bundle, generating a draft through the workshop), **When** the user follows the same workflow they used before the refactor, **Then** every visible behavior is identical: same DOM structure, same button labels, same loading sequences, same error messages.

---

### User Story 2 — Single helper for identifier generation (Priority: P1)

A developer adding a new entity that needs an identifier finds exactly one `createId(prefix, index?)` helper, imports it, and uses it without having to choose between five copies that each live next to a different service. The function signature accepts the optional `index` parameter that the strategy repository today uses for deterministic ordering.

**Why this priority**: P1 because it is the smallest, lowest-risk refactor in the feature. It is the foundation everything else builds on, and it removes a clear "obviously wrong" duplication that confuses any new contributor reading the codebase. P1 also lets it ship even if higher-risk targets get descoped.

**Independent Test**: A single shared module (typical location `app/main/shared/create-id.ts`) exists. A grep for `function createId\b` over `app/main/` returns exactly one definition. The five previous inline copies are deleted from `calendar.service.ts`, `strategy.repository.ts`, `workshop.service.ts`, `news-to-post.service.ts`, and `ideas.repository.ts`.

**Acceptance Scenarios**:

1. **Given** a fresh checkout after the refactor, **When** a developer searches for `function createId` across `app/main/`, **Then** they find exactly one definition.
2. **Given** the consolidated helper, **When** a caller invokes `createId("draft")`, **Then** the returned identifier has the same shape, prefix, and uniqueness guarantees as before the refactor (typically `<prefix>_<timestamp>_<random>`).
3. **Given** the consolidated helper, **When** the strategy repository invokes `createId("offer", 2)`, **Then** the returned identifier respects the deterministic ordering behavior the original strategy variant provided.
4. **Given** the existing test suite, **When** `npm test` runs after the refactor, **Then** every previously passing test still passes — no test asserts the absolute value of an id, only its prefix and uniqueness, so the byte-for-byte output guarantee is preserved.

---

### User Story 3 — Single point of writing to the execution_runs table (Priority: P1)

A developer adding a new skill or service that needs to record a Codex invocation finds exactly one repository or service method that writes to the `execution_runs` table. They call it from their service without having to copy a `db.prepare("INSERT INTO execution_runs ...")` block from another file.

**Why this priority**: P1 because the duplication of an SQL `INSERT` statement across three services is the riskiest type of duplication: a schema change requires touching three files in lockstep, and a typo in one of them silently breaks observability for that service. Centralizing the write closes a real source of future incidents.

**Independent Test**: A grep for `INSERT INTO execution_runs` across `app/main/` returns exactly one match. The three former inline copies in `workshop.service.ts`, `library.service.ts`, and `news-to-post.service.ts` are deleted. Every existing test that exercises a Codex invocation still passes, and the rows written to `execution_runs` after a real run have the same shape and content as before.

**Acceptance Scenarios**:

1. **Given** the codebase after the refactor, **When** a developer searches for `INSERT INTO execution_runs`, **Then** they find exactly one occurrence in a shared repository or service module.
2. **Given** any of the three former call sites (workshop draft generation, library variant creation, news-to-post transformation), **When** the service runs a Codex invocation, **Then** a row is inserted into `execution_runs` via the shared call, with the same column values as before the refactor.
3. **Given** the existing test suite, **When** the unit and integration tests run, **Then** every test that verifies execution-run persistence still passes without modification of assertion text.
4. **Given** a real-app audit run after the refactor, **When** the parcours principal exercises the workshop, library, and news flows, **Then** the audit's 14 steps still report success exactly as before.

---

### User Story 4 — Type checker catches unchecked indexed access (Priority: P1)

A developer who writes `const first = items[0]; first.foo;` without first checking that `items` is non-empty receives a compile-time error from TypeScript instead of a runtime crash in production. The same protection applies to record indexing (`record[key]`) where the key may not exist.

**Why this priority**: P1 because it converts a class of latent runtime bugs into compile-time errors that the developer fixes immediately. The audit measured ~20 such cases on `main`, mostly in `workshop.service.ts`. Each one is a potential `TypeError: Cannot read properties of undefined` waiting for the right input shape.

**Independent Test**: Both tsconfig files (`tsconfig.node.json` and `tsconfig.web.json`) have `"noUncheckedIndexedAccess": true`. `npm run typecheck` exits 0. A grep over `app/main/` and `app/renderer/src/` does not find any new `// @ts-ignore` or `// @ts-expect-error` comment that was added to silence this specific flag.

**Acceptance Scenarios**:

1. **Given** the activated flag, **When** a developer accidentally writes `const first = arr[0]; first.x;` on a possibly-empty array, **Then** the TypeScript compiler refuses the code with `Object is possibly 'undefined'`.
2. **Given** the activated flag, **When** `npm run typecheck` runs after the fixes, **Then** it exits 0 with no errors.
3. **Given** the activated flag, **When** the existing test suite runs, **Then** every test still passes — the fixes are pure type narrowing additions (early return, optional chaining, explicit narrowing), not behavior changes.

---

### User Story 5 — Hooks linter catches state-in-effect anti-patterns (Priority: P1)

A developer writing a new screen that calls `setState` directly inside a `useEffect` body receives an immediate lint error from `eslint-plugin-react-hooks@7` and rewrites the pattern toward `useMemo` or an event handler instead. The existing six occurrences of this anti-pattern across five screens are gone before the upgrade lands.

**Why this priority**: P1 because the upgrade itself is fast (one `npm install`) but it depends on the prerequisite refactor of the six existing patterns. Without the prerequisite, the upgrade leaves the build red. Once shipped, every future PR that introduces a similar pattern is caught at lint time, not in production.

**Independent Test**: The `package.json` `devDependencies` section pins `eslint-plugin-react-hooks` at `^7.x`. `npm run lint` exits 0. A grep across `app/renderer/src/features/` for `useEffect\(\(\) => \{[^}]*set[A-Z]` returns no matches.

**Acceptance Scenarios**:

1. **Given** the upgraded plugin, **When** a developer writes `useEffect(() => { setLoading(false); }, [data])`, **Then** the lint reports `set-state-in-effect` and refuses the file.
2. **Given** the six refactored existing patterns, **When** the user exercises the affected screens (Calendar, Workshop, Ideas, Library, Execution), **Then** every screen behaves identically to before the refactor: same loading sequences, same form pre-fills, same fetch-on-mount behavior.
3. **Given** the existing test suite, **When** the renderer unit tests run, **Then** every test still passes without modification of assertion text.
4. **Given** the lint configuration, **When** any other rule introduced by the 7.x release flags additional patterns in the codebase, **Then** those patterns are also fixed in the same feature — the upgrade lands clean, not with newly suppressed rules.

---

### Edge Cases

- **A new test starts asserting an absolute id value**: this is a red flag and the test is wrong. Tests must only assert id prefix + uniqueness, never the raw timestamp + random suffix. The refactor does not modify any test, so this case should not appear, but it is documented for the planning phase.
- **A `noUncheckedIndexedAccess` fix accidentally narrows a return type**: an early return inserted to satisfy the flag changes the function's return path. The fix is to use an explicit type narrowing (e.g., `if (items.length === 0) throw new Error(...)`) that preserves the contract.
- **`eslint-plugin-react-hooks@7` flags a pattern outside the six identified ones**: the scope explicitly includes ALL violations detected by the upgrade, not just the six. If the audit missed one, it is fixed in the same feature.
- **A sub-component split changes the React reconciliation order**: the new components may render in a different order than the original inline JSX, which can cause subtle flicker or focus loss. The fix is to wrap each split section in the same parent element that the original used.
- **A sub-component split shares state with its sibling that used to live in the parent's local scope**: the shared state lifts to a `useXxxFlow` hook (Workshop) or a `useStrategyBundle` hook (Strategy) so the sub-components stay pure.
- **The `recordExecutionRun` consolidation changes the timestamp granularity**: the three former inline copies all use `new Date().toISOString()`, so the consolidated helper uses the same. The columns must remain identical down to the timezone format.
- **A test relies on a specific call signature of an inline `createId`**: the consolidated helper has the most expressive signature (with the optional `index` parameter), so any call site that previously used the simpler signature still compiles.

## Requirements *(mandatory)*

### Functional Requirements

#### US1 — `createId` deduplication

- **FR-001**: Exactly one `createId(prefix: string, index?: number): string` function MUST exist anywhere under `app/main/`. The five existing inline definitions in `calendar.service.ts`, `strategy.repository.ts`, `workshop.service.ts`, `news-to-post.service.ts`, and `ideas.repository.ts` MUST be deleted.
- **FR-002**: The shared helper's behavior MUST be byte-for-byte identical to the existing copies for any input that the existing copies handle. Specifically, for callers that pass only a prefix, the returned id MUST follow the same `<prefix>_<timestamp>_<random>` shape (or the equivalent shape used today). For callers that pass `index`, the returned id MUST respect the deterministic-ordering behavior the strategy repository's variant provides today.
- **FR-003**: All five former call sites MUST import the helper from the new shared location. No call site MUST continue to define its own private `createId`.
- **FR-003a**: A new unit test file `tests/unit/create-id.test.ts` MUST exist and cover at least: (a) the prefix is preserved verbatim in the output, (b) the id shape is `<prefix>_<timestamp>_<random>` (or whatever shape the consolidated helper adopts, byte-for-byte aligned with the existing copies), (c) calling the helper 100 times with the same prefix returns 100 distinct ids, (d) the optional `index` parameter is honored when supplied (deterministic ordering behavior preserved from the strategy variant), (e) calling with `index` does not collide with calling without `index`.

#### US2 — `execution_runs` write consolidation

- **FR-004**: Exactly one location in `app/main/` MUST execute `INSERT INTO execution_runs (...)`. That location is `app/main/domains/execution/execution-runs.repository.ts`, a new dedicated file that exports a function (typical signature `insertExecutionRun(db, payload)`) consumed by every caller. The three existing inline copies in `workshop.service.ts`, `library.service.ts`, and `news-to-post.service.ts` MUST be deleted. The existing `execution.service.ts` is NOT extended for this purpose — the persistence concern stays in the new repository file, separate from the orchestration concern.
- **FR-005**: The consolidated write helper MUST insert the same column set with the same values that the three former copies inserted today. Column order, type coercion, timestamp format, and JSON serialization of any structured payload MUST be preserved.
- **FR-006**: All three former call sites MUST go through the consolidated helper. No service MUST keep its own private SQL string for this table.
- **FR-007**: The existing tests that exercise execution-run persistence (`workshop-service.test.ts`, `library-service.test.ts`, `news-to-post-service.test.ts`, and any IPC integration test that touches `execution_runs`) MUST continue to pass without modification.
- **FR-007a**: A new unit test file `tests/unit/execution-runs-repository.test.ts` MUST exist and cover at least: (a) the function inserts exactly one row per call, (b) every column from the input payload appears in the inserted row with the same value, (c) the timestamp column uses the same ISO format as the previous inline copies, (d) any structured payload (e.g., the SkillRunnerInvocation or SkillRunnerResult) is JSON-serialised consistently, (e) calling the function twice with the same payload produces two distinct rows (no accidental dedup at the helper level).

#### US3 — `noUncheckedIndexedAccess` activation

- **FR-008**: Both `tsconfig.node.json` and `tsconfig.web.json` MUST have `"noUncheckedIndexedAccess": true` in their `compilerOptions`.
- **FR-009**: `npm run typecheck` MUST exit with status 0 after the flag is activated and after every newly-flagged error is fixed.
- **FR-010**: Each fix MUST use a real type narrowing — one of: early return, explicit length check, optional chaining with fallback, or destructuring with default. Three escape hatches are explicitly BANNED for any fix added to satisfy the activation of `noUncheckedIndexedAccess`: (1) `// @ts-ignore` comments, (2) `// @ts-expect-error` comments, (3) the TypeScript non-null assertion operator `!` (e.g., `arr[0]!.foo`). A grep over the feature's diff for new occurrences of any of these three patterns introduced as part of an `noUncheckedIndexedAccess` fix MUST return zero matches. Pre-existing usages elsewhere in the codebase remain untouched.
- **FR-011**: The pre-existing latent baseline of ~180 errors revealed by standalone tsconfig invocations (versus the project-references invocation used by `npm run typecheck`) is OUT OF SCOPE for this feature and MUST NOT be touched. This feature handles only the delta added by the new flag on top of the project-references baseline.

#### US4 — `eslint-plugin-react-hooks` upgrade

- **FR-012**: `package.json` `devDependencies` MUST list `eslint-plugin-react-hooks` at version `^7.x` (latest stable available at the time of merge), UNLESS the conditional descope clause from Clarification Q1 fires. The descope clause fires when the 7.x upgrade requires a transitive major bump of `eslint` core or `typescript-eslint` AND that transitive bump causes a regression on a stabilized feature (CSP, sandbox, IPC validation, hardening, security scripts) that cannot be fixed within the feature's scope. If the descope fires, `eslint-plugin-react-hooks` stays at the existing 6.x version, US4 is marked descoped in the feature commit log, and a comment is added to `eslint.config.js` recording the reason and the follow-up trigger.
- **FR-013**: `npm run lint` MUST exit with status 0 after the upgrade.
- **FR-014**: All six existing `useEffect(() => { setSomething(...); }, [...])` patterns identified by the audit (one each in `IdeasScreen.tsx`, `WorkshopScreen.tsx`, `ExecutionScreen.tsx`, `LibraryScreen.tsx`, and two in `CalendarScreen.tsx`) MUST be refactored to a pattern that the new rule accepts. The refactor MUST preserve the user-observable behavior of each screen.
- **FR-015**: Any additional violation that the 7.x release introduces beyond the six identified ones MUST also be fixed in the same feature. The plugin upgrade MUST NOT land with newly suppressed rules.
- **FR-016**: No `// eslint-disable-next-line react-hooks/<rule>` comment MAY be added to silence a violation flagged by the upgrade. A grep for new `eslint-disable` comments in the feature diff MUST return zero matches related to react-hooks rules.

#### US5 — `StrategyScreen.tsx` decomposition

- **FR-017**: `app/renderer/src/features/strategy/StrategyScreen.tsx` MUST be 250 lines or fewer after the refactor.
- **FR-018**: At least four sub-components MUST exist under `app/renderer/src/features/strategy/components/`, one per editorial section (profile, offers, ICPs, pillars, voice rules). The exact naming and partitioning is left to the implementation as long as each section is its own file. Each sub-component MUST be 300 lines or fewer; a sub-component that exceeds 300 lines MUST carry an inline justification comment explaining why a further split would harm cohesion.
- **FR-019**: The orchestrator `StrategyScreen.tsx` MUST delegate the rendering of each section to its sub-component and MUST NOT contain inline JSX for any section's form fields.
- **FR-020**: All existing tests under `tests/unit/strategy-*.test.tsx` MUST continue to pass without modification of assertion text. If a test relied on an inline DOM structure that the split changes, the test is allowed to update its query selector but not its expected value.
- **FR-021**: The user-observable behavior of the strategy screen MUST be byte-for-byte identical: same form fields in the same order, same labels, same buttons, same loading sequences, same error messages, same persistence behavior on save.

#### US6 — `WorkshopScreen.tsx` decomposition

- **FR-022**: `app/renderer/src/features/workshop/WorkshopScreen.tsx` MUST be 250 lines or fewer after the refactor.
- **FR-023**: At least four sub-components MUST exist under `app/renderer/src/features/workshop/components/`, one per editorial step (idea, structure, hook, draft, variant). The exact naming and partitioning is left to the implementation. Each sub-component MUST be 300 lines or fewer; a sub-component that exceeds 300 lines MUST carry an inline justification comment explaining why a further split would harm cohesion.
- **FR-024**: The orchestrator `WorkshopScreen.tsx` MUST delegate the rendering of each step to its sub-component and MUST NOT contain inline JSX for any step's form fields.
- **FR-025**: All existing tests under `tests/unit/workshop-*.test.tsx` MUST continue to pass without modification of assertion text. The same selector-update tolerance as FR-020 applies.
- **FR-026**: The user-observable behavior of the workshop screen MUST be byte-for-byte identical, including the order of step transitions, the loading states, the Codex invocation triggers, and the error display.

#### Non-regression and identity guardrails

- **FR-027**: This feature MUST NOT introduce any regression on the existing gates: at least 344 unit tests passing, zero `npm audit --audit-level=high --omit=dev` vulnerabilities, typecheck/lint/build clean, the 14-step real-app audit succeeding, the six-check verify-hardening script succeeding on macOS, and the 3-OS GitHub Actions CI staying green on `main`.
- **FR-028**: This feature MUST NOT change any IPC schema introduced by feature 003. The zod schemas under `app/shared/schemas/` and the IPC handler signatures under `app/main/ipc/` remain frozen.
- **FR-029**: This feature MUST NOT modify any `skills/linkedin-*/SKILL.md` content. The prompts migrated by feature 006 remain frozen and editorial iteration is post-ship work.
- **FR-030**: This feature MUST NOT add any new npm dependency beyond the upgrade of `eslint-plugin-react-hooks`. No new helper library, no new test framework, no new runtime dependency.
- **FR-031**: Every commit produced for this feature MUST be authored by `Philippe Cohen <contact@AutomatisIA.fr>` with no `Co-Authored-By` trailer and no mention of any AI assistant in the commit messages or PR descriptions.

### Key Entities *(none — pure refactor, no new data shape)*

This feature introduces no new persistent data, no new IPC channel, no new database table. The only structural changes are: (a) one new shared module file for `createId`, (b) one new shared module file (or one extended existing service) for the `execution_runs` write, (c) sub-component files under `features/strategy/components/` and `features/workshop/components/`. Every other change is a removal or an in-place edit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After this feature is merged, a maintainer can locate any specific section of `StrategyScreen.tsx` or `WorkshopScreen.tsx` in under 30 seconds, versus the current baseline of "scroll through 600+ lines and use Ctrl-F to find a section header".
- **SC-002**: A grep for `function createId` over `app/main/` returns exactly one match (down from five).
- **SC-003**: A grep for `INSERT INTO execution_runs` over `app/main/` returns exactly one match (down from three).
- **SC-004**: `app/renderer/src/features/strategy/StrategyScreen.tsx` is 250 lines or fewer (down from 690), and `app/renderer/src/features/workshop/WorkshopScreen.tsx` is 250 lines or fewer (down from 548).
- **SC-005**: Both tsconfig files contain `"noUncheckedIndexedAccess": true`. `npm run typecheck` exits 0. The test count is at least 344 (the baseline from feature 006); it MAY grow if a new test is added to lock a behavior before a refactor.
- **SC-006**: `eslint-plugin-react-hooks` is at version 7.x. `npm run lint` exits 0. A grep for `useEffect\(\(\) => \{[^}]*set[A-Z]` over `app/renderer/src/features/` returns zero matches.
- **SC-007**: All gates from FR-027 still pass: 344+ tests, zero high-severity production vulnerabilities, clean typecheck/lint/build, 14-step real-app audit, six-check verify-hardening, 3-OS CI on main.
- **SC-008**: A `git log --all --grep="Claude" --oneline` over the entire history at HEAD returns zero matches, and every commit on the feature branch is authored by `Philippe Cohen <contact@AutomatisIA.fr>` with no `Co-Authored-By` trailer.

## Out of Scope

The following items are explicitly excluded from this feature and are deferred to future work:

- **Additional strict TypeScript flags** (`exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`). These may be evaluated in a future "chantier 4-bis" if the maintainer judges them worth the effort. They are NOT part of this feature.
- **The latent baseline of ~180 typecheck errors revealed by standalone tsconfig invocations**. This is a separate investigation: `npm run typecheck` (via project references) currently reports 0 errors while the standalone invocation reports ~180. The discrepancy is a real bug in either the project references resolution or the typecheck pipeline, and resolving it is its own feature. This feature handles only the delta added by `noUncheckedIndexedAccess` on top of the existing project-references baseline.
- **Refactor of the smaller screens** (`LibraryScreen.tsx` 179 lines, `CalendarScreen.tsx` 180 lines, `IdeasScreen.tsx` 243 lines). They are within an acceptable size range and do not justify the complexity of a split now. The 6 setState-in-effect patterns inside them are still fixed by US4, but their structure is not reorganized.
- **UX improvements of the split screens** (loading states, error display polish, accessibility, dark mode polish). These belong to chantier 6 (UX debt).
- **Architectural reorganization** beyond the two explicit deduplications. No service is split into multiple files, no new layer is introduced, no domain boundary is moved.
- **New functional tests** beyond what is strictly necessary to lock a behavior before a risky refactor. The feature is a refactor, not a feature increment.
- **i18n, accessibility, dark mode, responsive** — all handled elsewhere.

## Assumptions

- The five `createId` copies are byte-for-byte equivalent in behavior modulo the optional `index` parameter that the strategy variant has. The audit will be re-confirmed during planning to make sure no fifth corner case sneaked in.
- The three `INSERT INTO execution_runs` copies write the same column set in the same order. The audit will inspect the actual SQL strings during planning to confirm.
- The `eslint-plugin-react-hooks@7` upgrade is non-breaking for the rest of the toolchain (eslint 9.x core, the typescript-eslint preset). If the upgrade requires a parallel bump of `eslint` itself or `typescript-eslint`, that bump is included in this feature as a transitive consequence and is not considered out of scope.
- The strategy and workshop tests under `tests/unit/strategy-*.test.tsx` and `tests/unit/workshop-*.test.tsx` exercise behavior at the screen level (rendering and interaction), not at the inline-JSX level. If a test happens to query a specific class name or DOM ancestor that the split would change, the test query selector may be updated but the expected value (assertion text) stays identical.
- The maintainer (Philippe) is willing to invest one focused work block of approximately 10 to 18 hours total for this feature, distributed across the 6 user stories. Phase planning will sequence them so that the cheap, low-risk items (US2 createId, US3 execution_runs, US4 noUncheckedIndexedAccess) land first and unblock the riskier screen splits.
- The `npm run real-app-audit` script (14 steps, end-to-end via Playwright + Electron) is the only safety net for the screen splits because the existing unit tests cover the screens at a coarse granularity. Running this audit before AND after each screen split is part of the implementation discipline.
- The CI pipeline from feature 005 will run on every push and will catch any cross-OS regression introduced by the refactor. The maintainer relies on this CI as a backstop, not as a substitute for the local gates.
