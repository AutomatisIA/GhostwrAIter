---

description: "Task list for feature 003-ipc-validation"
---

# Tasks: Systematic IPC schema validation

**Input**: Design documents from `/specs/003-ipc-validation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: test tasks are included because Constitution IV (`.specify/memory/constitution.md`) mandates TDD for every testable behavior, and the plan explicitly orders test-first sequencing for both the wrapper module and every IPC handler migration.

**Organization**: tasks are grouped by user story. The wrapper module (shared by every story) lives in Phase 2 (Foundational). Phase 3 executes User Story 1 (closing the trust boundary) as a sequence of seven per-handler migrations in the order locked by research decision D10 — each micro-sequence writes the failing test for the handler's channels, adds the schema, migrates the registration, runs the tests, and commits. User Story 4 (preserved renderer ergonomics) follows in Phase 4 and turns the wrapper's envelope into the unchanged `window.linkedinPoster.*` ergonomics via the preload unwrap helper. User Story 2 (single source of truth for types) is Phase 5 and replaces handwritten IPC input types with schema-derived imports after the schemas exist. User Story 3 (per-handler test coverage) is Phase 6 and is a verification pass that asserts every handler file has the four required test cases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: user story the task belongs to (US1, US2, US3, US4)
- File paths are absolute from repository root

## Path Conventions

- Schemas: `app/shared/schemas/`
- Shared types (to be replaced): `app/shared/types/`
- IPC handlers: `app/main/ipc/`
- Preload bridge: `app/preload/index.ts`
- Tests: `tests/unit/`
- Spec helper for Codex fakes: `tests/unit/helpers/fake-codex.ts`

---

## Phase 1: Setup (capture baseline)

**Purpose**: record the current state of the project so any regression introduced during the feature is attributable to a specific task. No code change in this phase.

- [ ] T001 Confirm the working tree is clean on the `003-ipc-validation` branch by running `git status` at the repository root, and stop if any file outside `dist-app/` or `dist-launcher/` is uncommitted that was not introduced by the current speckit artifacts.
- [ ] T002 Capture the baseline dependency-audit output with `npm audit --json > /tmp/003-audit-baseline.json` and confirm it reports zero vulnerabilities at any severity level. If it reports new vulnerabilities compared to feature 002's final state, stop and investigate before continuing.
- [ ] T003 Capture the baseline test output with `npm test` at the repository root. Expected: 132 tests passed across 29 files. If the baseline is not green, stop and resolve before touching anything else.
- [ ] T004 Capture the baseline TypeScript and lint output with `npm run typecheck` and `npm run lint`. Both must be clean.
- [ ] T005 [P] Re-read `.specify/memory/constitution.md` once more to re-anchor on principles I to VI before any code change.

---

## Phase 2: Foundational (wrapper module + envelope + error taxonomy — blocks every user story)

**Purpose**: implement the `registerValidatedHandler` / `registerValidatedTupleHandler` wrapper, the `IpcResult<T>` envelope, the error code taxonomy, and the preload unwrap helper in pure form (the preload integration itself is in Phase 4). Every subsequent phase depends on this wrapper existing and being fully unit-tested.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Tests for the wrapper (TDD — write failing first)

- [ ] T006 Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/register-validated-handler.test.ts` with describe blocks for each contract item in `specs/003-ipc-validation/contracts/validated-handler-wrapper.md`: valid synchronous input, valid asynchronous input, missing field, wrong type, empty-input schema with `undefined`, empty-input schema rejecting a non-undefined value, handler throws a `WorkspaceConfigurationError` (passthrough), handler throws a generic `Error` (IPC_HANDLER_ERROR), tuple schema of length 3 accepting 3 elements, tuple schema rejecting a 2-element and a 4-element input, tuple schema with a nested object element reporting a nested field path in the envelope. Observe the test file failing on import before implementation.

### Implementation of the wrapper module

- [ ] T007 Create `/Users/philippe/Dev/LinkedIn-poster/app/main/ipc/register-validated-handler.ts` exporting the `IpcResult<T>`, `IpcError`, `ValidatedIpcHandler<TInput, TOutput>`, and `ValidatedIpcTupleHandler<TArgs, TOutput>` types from `specs/003-ipc-validation/data-model.md`. Export also the `IpcRegistrar` type (compatible with the one already declared in every existing IPC handler file).
- [ ] T008 Implement `registerValidatedHandler(ipcRegistrar, channel, schema, handler)` in the same file, per `contracts/validated-handler-wrapper.md`. Use `schema.safeParse()` to avoid throwing on validation, catch thrown values from the user-supplied handler, classify the thrown value against the `KNOWN_ERROR_CODE_MAP`, and return the correct envelope variant. Log via `electron-log` at `warn` for validation failures and `error` for handler failures, with the channel name, the error code, and a truncated (80 char max) error message — never the payload content.
- [ ] T009 Implement `registerValidatedTupleHandler(ipcRegistrar, channel, tupleSchema, handler)` in the same file. Assemble positional arguments into an array, run `tupleSchema.safeParse(array)`, on success spread the parsed tuple into the handler as positional arguments, on failure return the `IPC_INPUT_INVALID` envelope with the tuple-index path (`"[3]"` or `"[3].text"` for nested elements).
- [ ] T010 Declare the `KNOWN_ERROR_CODE_MAP` as a `ReadonlyMap<string, string>` exported from the same file, with `"WorkspaceConfigurationError" → "WORKSPACE_CONFIGURATION_INVALID"` and `"WorkspacePathEscapeError" → "WORKSPACE_PATH_ESCAPE"` as initial entries, per `contracts/error-code-taxonomy.md`.
- [ ] T011 Implement the preload `unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T>` helper as a pure function exported from the same wrapper module (or a co-located `app/main/ipc/ipc-result-envelope.ts` if cleaner). The function returns `result.data` on success, throws a new `Error` on failure with `error.name === result.error.code` and `error.message` equal to `result.error.message` (suffixed with `"(field: <field>)"` when `field` is present).
- [ ] T012 Run `/Users/philippe/Dev/LinkedIn-poster/tests/unit/register-validated-handler.test.ts` and confirm every case added in T006 now passes.

### Foundational verification

- [ ] T013 Run the full existing test suite with `npm test` and confirm the 132 pre-existing tests still pass alongside the new wrapper tests. Expected total: 132 + new cases.
- [ ] T014 Run `npm run typecheck` and `npm run lint`. Both must remain clean. If the wrapper's generic types produce any TypeScript error at a call site that does not yet exist, this is acceptable — the call sites are introduced in Phase 3.

**Checkpoint**: the wrapper module is in place, fully tested, and the unwrap helper is ready to be wired into the preload. No handler has migrated yet.

---

## Phase 3: User Story 1 — Closed trust boundary at the IPC seam (Priority: P1) 🎯 MVP

**Goal**: wire every IPC channel through the wrapper so that every input is validated, every failure flows through the typed envelope, and no malformed payload can reach a business service or crash the main process.

**Independent test**: run the per-handler test files. A valid payload produces `{ ok: true }`, a missing field produces `IPC_INPUT_INVALID`, a wrong type produces `IPC_INPUT_INVALID`, a throwing handler produces `IPC_HANDLER_ERROR` (or a passthrough code when applicable). The main process never crashes.

The migration order follows research decision D10: calendar → settings → execution → library → ideas → workshop → strategy. Each of the seven micro-sequences below writes the failing test file first, adds the schema file, migrates the handler file, runs the tests, and commits. Strategy is last because it is the only file with a pre-existing test file and its migration extends that test.

### 3.1 calendar-ipc (smallest, migration template)

- [ ] T015 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/app/shared/schemas/calendar.ts` with `scheduleDraftInputSchema` describing a `{ draftId: string(1-), plannedDate: string (ISO 8601 date), status: enum }` and export `ScheduleDraftInput` as `z.infer<typeof scheduleDraftInputSchema>`. Values of `status` must match the existing `CalendarItemStatus` enum from `app/shared/types/calendar.ts`. Do not import anything from `electron`, `node:*`, or `app/main/**`.
- [ ] T016 [US1] Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/calendar-ipc.test.ts` following the exact pattern of `tests/unit/strategy-ipc.test.ts`. Add test cases for `calendar:list-items` (no input, valid) and `calendar:schedule-draft` (valid payload, missing `draftId`, wrong-type `plannedDate`, service throws). Observe every case failing on import because `calendar-ipc.ts` has not been migrated yet.
- [ ] T017 [US1] Migrate `/Users/philippe/Dev/LinkedIn-poster/app/main/ipc/calendar-ipc.ts` to use `registerValidatedHandler` for both channels. `calendar:list-items` uses an `emptyInputSchema` (defined inline or re-exported from a shared `app/shared/schemas/common.ts`). `calendar:schedule-draft` uses `scheduleDraftInputSchema`. Run T016 and confirm it passes.
- [ ] T018 [US1] Run the full `npm test` to confirm no pre-existing test regressed. Then create a commit `feat(003): validate calendar IPC handlers with zod schemas` covering calendar-ipc.ts, calendar.ts schema, calendar-ipc.test.ts.

### 3.2 settings-ipc (empty-input schema pattern)

- [ ] T019 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/app/shared/schemas/settings.ts` with an exported `emptyInputSchema = z.undefined()` and a header comment documenting the convention for no-input channels. If the same schema is used by execution, consider putting it in `app/shared/schemas/common.ts` instead and re-exporting — decide at implementation time based on cleanliness.
- [ ] T020 [US1] Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/settings-ipc.test.ts` covering `settings:export-workspace` and `settings:purge-execution-logs`, both no-input. Assert valid (no argument) path, wrong-type (passing a non-undefined argument) path, and handler-throws path. Observe failing.
- [ ] T021 [US1] Migrate `/Users/philippe/Dev/LinkedIn-poster/app/main/ipc/settings-ipc.ts` to use `registerValidatedHandler` with `emptyInputSchema` for both channels. Run T020 and confirm it passes.
- [ ] T022 [US1] Run `npm test` to confirm no regression and create a commit `feat(003): validate settings IPC handlers with empty-input schema`.

### 3.3 execution-ipc (empty-input schema pattern, reuse)

- [ ] T023 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/app/shared/schemas/execution.ts` that re-exports `emptyInputSchema` from `settings.ts` (or `common.ts`) with a header comment identifying it as the empty-input marker. No new schema logic.
- [ ] T024 [US1] Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/execution-ipc.test.ts` covering `execution:list-runs` and `execution:get-diagnostics`, both no-input. Four cases: valid, wrong-type, handler-throws, verify the envelope shape on success.
- [ ] T025 [US1] Migrate `/Users/philippe/Dev/LinkedIn-poster/app/main/ipc/execution-ipc.ts` to use `registerValidatedHandler` with `emptyInputSchema` for both channels. Run T024 and confirm it passes.
- [ ] T026 [US1] Run `npm test` and create a commit `feat(003): validate execution IPC handlers`.

### 3.4 library-ipc

- [ ] T027 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/app/shared/schemas/library.ts` with `searchLibraryInputSchema` matching the existing `LibrarySearchInput` shape in `app/shared/types/library.ts` (query, pillar, status filters), plus a `draftIdSchema` for the `library:create-variant-from-draft` channel. Export derived types via `z.infer`.
- [ ] T028 [US1] Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/library-ipc.test.ts` covering `library:list-entries` (no input), `library:search-entries` (object input, valid + missing + wrong-type cases), and `library:create-variant-from-draft` (scalar input, valid + wrong-type + handler-throws). Observe failing.
- [ ] T029 [US1] Migrate `/Users/philippe/Dev/LinkedIn-poster/app/main/ipc/library-ipc.ts` to use `registerValidatedHandler` with the appropriate schema for each channel. Run T028 and confirm it passes.
- [ ] T030 [US1] Run `npm test` and create a commit `feat(003): validate library IPC handlers`.

### 3.5 ideas-ipc

- [ ] T031 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/app/shared/schemas/ideas.ts` with `ideaInputSchema` matching the existing `IdeaInput` shape (`title`, `angle`, `pillarLabel`, all non-empty strings) and `newsSourceInputSchema` matching the existing `NewsSourceInput` shape. Export derived types.
- [ ] T032 [US1] Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/ideas-ipc.test.ts` covering `ideas:list` (no input), `ideas:create` (object input), `ideas:create-from-news-source` (object input), and `ideas:generate-from-strategy` (no input). For each channel with input, cover valid + missing field + wrong type + handler-throws. Observe failing.
- [ ] T033 [US1] Migrate `/Users/philippe/Dev/LinkedIn-poster/app/main/ipc/ideas-ipc.ts` to use `registerValidatedHandler` for each channel. Run T032 and confirm it passes.
- [ ] T034 [US1] Run `npm test` and create a commit `feat(003): validate ideas IPC handlers`.

### 3.6 workshop-ipc (tuple schemas — most complex)

- [ ] T035 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/app/shared/schemas/workshop.ts` with: `postTypologySchema` as `z.enum([...])` matching the eight values in `app/shared/types/workshop.ts` `PostTypology`; `postObjectiveSchema` as `z.enum([...])` matching `PostObjective`; `hookOptionSchema` as `{ id, family, text, score: number(0-1) }`; `ideaIdSchema`, `draftIdSchema`, `structureKeySchema`, `structureLabelSchema`, `hookIdSchema`, `hookTextSchema`, `variantTypeSchema` as appropriately constrained string enums or non-empty strings. Then define the three tuple schemas: `suggestedStructuresTuple = z.tuple([ideaIdSchema, postTypologySchema, postObjectiveSchema])`, `generateHooksTuple = z.tuple([ideaIdSchema, postTypologySchema, structureKeySchema])`, `generateFinalDraftTuple = z.tuple([ideaIdSchema, postTypologySchema, postObjectiveSchema, structureKeySchema, structureLabelSchema, hookIdSchema, hookTextSchema, z.array(hookOptionSchema)])`. Finally, `createVariantTuple = z.tuple([draftIdSchema, variantTypeSchema])`.
- [ ] T036 [US1] Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/workshop-ipc.test.ts` covering each of the 7 workshop channels. The tuple-based channels (`workshop:get-suggested-structures`, `workshop:generate-hooks`, `workshop:generate-final-draft`) need cases for the wrong tuple length, a wrong type at a specific position (including a nested invalid field inside the hooks array for `generate-final-draft`), and a valid tuple. The single-input channels (`workshop:get-session-by-idea-id`, `workshop:generate-from-idea`, `workshop:correct-draft`, `workshop:create-variant`) need the standard four cases. Observe failing.
- [ ] T037 [US1] Migrate `/Users/philippe/Dev/LinkedIn-poster/app/main/ipc/workshop-ipc.ts` to use `registerValidatedHandler` for scalar/object channels and `registerValidatedTupleHandler` for the three tuple-based channels. Preserve the exact positional calling convention expected by the preload bridge. Run T036 and confirm it passes.
- [ ] T038 [US1] Run `npm test` and create a commit `feat(003): validate workshop IPC handlers with tuple schemas for positional channels`.

### 3.7 strategy-ipc (already tested, migration + test extension)

- [ ] T039 [US1] Verify `/Users/philippe/Dev/LinkedIn-poster/app/shared/schemas/strategy.ts` is still complete and correctly covers the current `StrategyBundleInput` shape. If any field has drifted since feature 001, update the schema to match. No new schema file needed.
- [ ] T040 [US1] **Extend first, migrate second** (Constitution IV TDD ordering): edit `/Users/philippe/Dev/LinkedIn-poster/tests/unit/strategy-ipc.test.ts` to (a) rewrap the two pre-existing `expect(result).toMatchObject(...)` assertions at the "persists a strategy bundle through the handler and reloads it" and "generates an editorial foundation summary from the active strategy" tests so they read `result.data.profile`, `result.data.offers`, `result.data.pillars`, and `result.data.summaryMarkdown` instead of reading those fields on the raw `result` — because after migration the handler will return the `{ ok: true, data: ... }` envelope; (b) add a new test case for `strategy:save-bundle` with a missing required field (e.g., `profile.name` omitted) asserting `result.ok === false` and `result.error.code === "IPC_INPUT_INVALID"`; (c) add a new test case with a wrong-type field (e.g., `profile.positioning` as a number) asserting the same envelope shape; (d) add a new test case for `strategy:generate-foundation` where the injected fake skill runner throws a plain `Error`, asserting `result.ok === false` and `result.error.code === "IPC_HANDLER_ERROR"`. Run the test file against the **still-unmigrated** strategy-ipc.ts and observe: the two rewrapped cases fail because `result.data` is undefined on the raw service response, and the three new cases fail for the same root reason. This is the failing-test step of TDD.
- [ ] T041 [US1] Migrate `/Users/philippe/Dev/LinkedIn-poster/app/main/ipc/strategy-ipc.ts` to use `registerValidatedHandler` for all three channels: `strategy:get-active-bundle` (empty input schema), `strategy:save-bundle` (`strategyBundleInputSchema`), `strategy:generate-foundation` (empty input schema). Run `tests/unit/strategy-ipc.test.ts` and confirm every case now passes: the rewrapped pre-existing cases see the envelope's `data` field, the missing-field and wrong-type cases see `IPC_INPUT_INVALID`, and the throwing-handler case sees `IPC_HANDLER_ERROR`.
- [ ] T042 [US1] Run `npm test` at the repository root and create a commit `feat(003): validate strategy IPC handlers and extend coverage`.

### Verification for User Story 1

- [ ] T043 [US1] Run `grep -n "ipcRegistrar.handle" app/main/ipc/*.ts` and confirm that every occurrence is either the `registerValidatedHandler` or `registerValidatedTupleHandler` helper, NOT the raw `ipcRegistrar.handle(...)`. No exception. If any raw call remains, migrate it or justify with an explicit written comment.
- [ ] T044 [US1] Run `npm test`, `npm run typecheck`, and `npm run lint`. All three must be clean. The test count should be the pre-003 total plus the new IPC handler test cases.

**Checkpoint**: the trust boundary is closed. Every channel validates its input through a zod schema. The main process is safe from malformed payloads regardless of what the renderer sends. The MVP value of US1 is delivered.

---

## Phase 4: User Story 4 — Preserved renderer ergonomics (Priority: P1)

**Goal**: the `window.linkedinPoster.*` API surface continues to behave exactly as before. The preload unwraps the envelope and presents either `data` or a thrown typed `Error` to the renderer.

**Independent test**: the full renderer component test suite and `scripts/real-app-audit.mjs` continue to pass without any React screen being modified.

- [ ] T045 [US4] Update `/Users/philippe/Dev/LinkedIn-poster/app/preload/index.ts` to import the `unwrap` helper from the wrapper module. Pipe every `ipcRenderer.invoke(...)` call through `unwrap(...)`. This affects every method in every domain section (strategy, ideas, workshop, library, calendar, execution, settings) — 28 methods in total. The signatures visible to the renderer (argument order, return shape) do not change.
- [ ] T046 [US4] Run `npm run build` and confirm the preload compiles under the existing CJS target for sandbox compatibility (the format decided in feature 002). Inspect `dist-electron/preload/index.cjs` and verify the `unwrap` helper is inlined or imported correctly.
- [ ] T047 [US4] Run `npm test` and confirm every pre-existing renderer component test still passes. No screen source modification. If a test breaks, the cause is a preload behavior change that needs investigation — stop and diagnose.
- [ ] T048 [US4] Run `node scripts/real-app-audit.mjs` end-to-end. The canonical seven-step journey must pass on the packaged build with no typed error surfaced during a legitimate interaction. The envelope is invisible to the user.
- [ ] T049 [US4] Run `node scripts/verify-hardening.mjs` and confirm the six feature-002 checks still pass. The envelope and the unwrap helper must not weaken the sandbox, CSP, navigation guards, DevTools gating, or workspace validation.
- [ ] T050 [US4] Create a commit `feat(003): unwrap IPC result envelope in preload while preserving window.linkedinPoster ergonomics`.

**Checkpoint**: the renderer API surface is identical. The canonical journey is regression-free. Feature 002 hardening is intact.

---

## Phase 5: User Story 2 — Single source of truth for IPC input types (Priority: P2)

**Goal**: every TypeScript type describing an IPC input is derived from the corresponding zod schema via `z.infer`, not handwritten separately.

**Independent test**: a `grep` over `app/shared/types/` finds zero handwritten IPC input types that duplicate a schema-derived equivalent. A search over callers confirms every call site imports the type from the schema file.

- [ ] T051 [US2] Enumerate the IPC input types currently declared in `app/shared/types/ideas.ts`, `app/shared/types/workshop.ts`, `app/shared/types/library.ts`, `app/shared/types/calendar.ts`, `app/shared/types/settings.ts`, `app/shared/types/execution.ts`, and `app/shared/types/strategy.ts`. For each type that describes an IPC input (e.g., `IdeaInput`, `NewsSourceInput`, `ScheduleDraftInput`, `StrategyBundleInput`, `LibrarySearchInput`), identify every importing file via `grep`.
- [ ] T052 [US2] Replace each handwritten IPC input type with a re-export from the corresponding schema file (`export type Foo = z.infer<typeof fooSchema>`), ensuring every importer continues to compile without code modification. If a type has no non-IPC consumer left after the replacement, delete the re-export entirely — the type is now imported directly from `app/shared/schemas/<domain>.ts`.
- [ ] T053 [US2] Run `npm run typecheck` and confirm every call site compiles. Any residual TypeScript error points to either a type import that needs updating, or a schema that does not yet cover the full shape of the handwritten type — fix whichever is wrong.
- [ ] T054 [US2] Run `npm test`, `npm run lint`, and `npm run build`. All three must be clean.
- [ ] T055 [US2] Create a commit `refactor(003): derive IPC input types from zod schemas as the single source of truth`.

**Checkpoint**: types and schemas cannot drift anymore. Renaming a schema field produces a compile error at every call site.

---

## Phase 6: User Story 3 — Per-handler unit test coverage audit (Priority: P2)

**Goal**: every IPC handler file has a dedicated unit test file covering at minimum a valid path, a missing-field path, a wrong-type path, and a handler-error path.

**Independent test**: a contributor can run `npx vitest run tests/unit/<domain>-ipc.test.ts` for any of the seven handlers, observe all cases pass in under a second, and use the pattern to add a new case without reading any documentation.

- [ ] T056 [US3] Audit each of the seven IPC test files (`strategy-ipc.test.ts`, `ideas-ipc.test.ts`, `workshop-ipc.test.ts`, `library-ipc.test.ts`, `calendar-ipc.test.ts`, `execution-ipc.test.ts`, `settings-ipc.test.ts`). For each test file, list the channels it exercises and the cases it covers. Verify that every channel has at minimum one valid case, one validation-failure case, and one handler-error case. If any file is missing a case, add it now.
- [ ] T057 [US3] Run each IPC test file in isolation (`npx vitest run tests/unit/calendar-ipc.test.ts`, etc.) and confirm each file completes in under one second. If any file is slow, identify the cause (unnecessary Electron launch, unnecessary Codex call, slow fixture) and fix it.
- [ ] T058 [US3] Run `npm test` one more time to confirm the full suite is green with the added cases from T056.
- [ ] T059 [US3] If T056 added new cases, create a commit `test(003): complete per-handler IPC test coverage audit`. If no new case was needed, skip the commit and note the audit in the Phase 7 polish commit instead.

**Checkpoint**: every handler file is individually testable in isolation. A future contributor can do test-first on any handler without launching Electron or Codex.

---

## Phase 7: Polish — final verification and shipping

**Purpose**: re-run the complete verification battery on the final state, record any contingencies, and prepare the branch for the superpowers `finishing-a-development-branch` phase.

- [ ] T060 Run `npm audit` and confirm zero vulnerabilities at any severity level (FR-020, SC-006).
- [ ] T061 Run `npm test` on the final state and confirm every unit and component suite is green. The total count should be the pre-feature 132 plus every case added by this feature.
- [ ] T062 Run `npm run typecheck` and `npm run lint`. Both must be clean.
- [ ] T063 Run `npm run build` and confirm the packaged build succeeds without critical warnings, including the renderer bundle with its CSP meta element unchanged.
- [ ] T064 Run `node scripts/real-app-audit.mjs` end-to-end on the final state and confirm every step passes (SC-005, FR-017).
- [ ] T065 Run `node scripts/verify-hardening.mjs` and confirm every one of the six feature-002 hardening checks still passes (FR-019, SC-006).
- [ ] T066 Walk quickstart step 6 from `/Users/philippe/Dev/LinkedIn-poster/specs/003-ipc-validation/quickstart.md`: launch `npm run dev`, open the developer console, paste the invalid `ideas.createIdea({title:"",angle:"",pillarLabel:""})` invocation, and confirm a thrown Error with `name === "IPC_INPUT_INVALID"`. Repeat with the invalid `calendar.scheduleDraft` invocation and confirm the same pattern.
- [ ] T067 Run `git log --oneline 29ebbca..HEAD` at the repository root and confirm the branch contains one commit per handler migration (7 handler commits), one preload commit, one type-dedup commit, and optionally one audit commit, plus the Phase 2 foundational commit. Total expected: 9 to 11 commits.
- [ ] T068 Create a final commit `chore(003): record final verification and close ipc-validation feature` with any trailing documentation updates (for example, a note in `specs/003-ipc-validation/research.md` if any implementation deviated from the plan).

**Checkpoint**: the feature is fully implemented, fully verified, and ready for the superpowers `finishing-a-development-branch` phase.

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependency. Start immediately.
- **Phase 2 (Foundational wrapper)**: depends on Phase 1. Blocks every user story phase. Must finish with the wrapper fully tested before Phase 3 begins.
- **Phase 3 (User Story 1 — migrations)**: depends on Phase 2. Each sub-section (calendar → settings → execution → library → ideas → workshop → strategy) is itself sequential but independent of the others.
- **Phase 4 (User Story 4 — preload unwrap)**: depends on Phase 2 (for the unwrap helper) and Phase 3 (because the preload must not be switched to unwrap before at least one channel returns an envelope). In practice, Phase 4 runs AFTER Phase 3 is complete.
- **Phase 5 (User Story 2 — type dedup)**: depends on Phase 3 (every schema file must exist before its types can be inferred elsewhere).
- **Phase 6 (User Story 3 — test audit)**: depends on Phase 3 (the test files must exist before they can be audited).
- **Phase 7 (Polish)**: depends on every previous phase.

### Within each user story

- Tests MUST be written and observed failing before the implementation task that satisfies them (Constitution IV).
- Schemas before handler migration.
- Handler migration before type dedup.
- Verification after each handler, before the commit.
- Commit after each complete handler sub-section.

### Parallel opportunities

- **Phase 1**: T005 can run in parallel with any other Phase 1 task.
- **Phase 2**: the wrapper tasks are sequential within the file (`register-validated-handler.ts` is a single file).
- **Phase 3**: the seven schema files (T015, T019, T023, T027, T031, T035, and T039 verification) are in different files and can be written in parallel. The seven test files are also parallel among themselves. The seven handler migrations are NOT parallel with each other's test file within the same domain, but ARE parallel across domains. If working with multiple agents, the seven sub-sections can run concurrently.
- **Phase 4**: not parallelizable — single preload file, verification commands share the terminal.
- **Phase 5**: not parallelizable — the replacement edits touch multiple files but produce compile feedback that is easier to read sequentially.
- **Phase 6**: the seven test file audits can run in parallel.
- **Phase 7**: not parallelizable — verification commands share the terminal and the Electron window.

---

## Parallel example: Phase 3 schema creation

```bash
# Launch all seven schema files in parallel (different files, independent):
Task: "Create app/shared/schemas/calendar.ts (T015)"
Task: "Create app/shared/schemas/settings.ts (T019)"
Task: "Create app/shared/schemas/execution.ts (T023)"
Task: "Create app/shared/schemas/library.ts (T027)"
Task: "Create app/shared/schemas/ideas.ts (T031)"
Task: "Create app/shared/schemas/workshop.ts (T035)"
Task: "Verify app/shared/schemas/strategy.ts completeness (T039)"
```

Each task is independent: different file, no cross-dependencies. The migration tasks that follow (T017, T021, T025, T029, T033, T037, T040) depend on their own schema file being ready, not on each other.

---

## Implementation Strategy

### MVP first (User Story 1 alone)

1. Complete Phase 1 (Setup) — baseline green.
2. Complete Phase 2 (Foundational wrapper) — wrapper tested in isolation.
3. Complete Phase 3 (User Story 1 — all seven handler migrations with their test files).
4. **STOP and validate**: at this point the trust boundary is closed and every channel is validated. If shipping pressure is high, this is the minimum viable deliverable that satisfies FR-001 to FR-012. The preload still passes through raw envelopes to the renderer, which will cause every screen to break — so this MVP is not actually shippable on its own, but it is the biggest value increment in the feature.

### Incremental delivery

5. Complete Phase 4 (User Story 4 — preload unwrap) — this is the step that makes the renderer usable again, and together with Phase 3 forms the actual shippable increment.
6. Complete Phase 5 (User Story 2 — type dedup) — cleanliness and future-proofing.
7. Complete Phase 6 (User Story 3 — test audit) — verification of per-handler coverage.
8. Complete Phase 7 (Polish — final verification battery).
9. Hand off to the superpowers `finishing-a-development-branch` phase.

### Parallel team strategy

With multiple contributors, the seven sub-sections of Phase 3 can be worked on in parallel by different developers after Phase 2 completes. Each sub-section is a single handler file + its schema + its test, with no cross-dependencies. Reassembly happens at Phase 4 (preload) where all seven channels must already be migrated.

For a solo session, sequential execution in the order listed above minimizes commit-history churn and makes it trivial to bisect a regression to a single handler file.

---

## Notes

- `[P]` tasks touch different files and have no incomplete dependencies.
- `[Story]` label maps a task to its user story for traceability.
- Every behavioral change is preceded by a failing test (Constitution IV).
- Commit after each completed handler sub-section, not after each task; the commit message maps to the handler file being migrated.
- Stop at any checkpoint to validate the story independently.
- Avoid: vague tasks, weakening the existing tests to accommodate the new envelope, skipping the preload commit which is what makes the renderer functional, skipping the real-app-audit step which is what makes the renderer regression verifiable.
