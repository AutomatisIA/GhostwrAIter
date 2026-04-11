---

description: "Task list for feature 007 — code quality refactor"
---

# Tasks: Code Quality Refactor

**Input**: Design documents from `/specs/007-code-quality-refactor/`
**Prerequisites**: plan.md, spec.md (5 clarifications integrated), research.md (D1–D6 with risk-ordered execution), data-model.md, contracts/{create-id,execution-runs-repository}.md, quickstart.md

**Tests**: TDD is mandatory per Constitution IV. The two new shared helpers get dedicated test files written FIRST. The existing screen tests are the safety net for the screen splits and MUST pass at every commit during the split.

**Organization**: Tasks are grouped by user story but executed in **risk order per Research D6**, NOT in priority order: US2 → US3 → US4 → US5 → US1a (Strategy split) → US1b (Workshop split). The deduplications go first because they create the shared helpers; the screen splits go last because they carry the highest regression risk and benefit from all the prior cleanup landing first.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1/US2/US3/US4/US5 maps to user stories from spec.md (US1 covers both screen splits, distinguished by Phase 7 / Phase 8)
- All paths are relative to repo root `/Users/philippe/Dev/LinkedIn-Poster/`

## Path Conventions

- New shared helpers: `app/main/shared/create-id.ts`, `app/main/domains/execution/execution-runs.repository.ts`
- New tests: `tests/unit/create-id.test.ts`, `tests/unit/execution-runs-repository.test.ts`
- Screen sub-components: `app/renderer/src/features/strategy/components/`, `app/renderer/src/features/workshop/components/`

---

## Phase 1: Setup

- [X] T001 Verify working tree is on branch `007-code-quality-refactor`. Run `git status` and confirm only `specs/007-code-quality-refactor/` is untracked. The CLAUDE.md modification from `/speckit-plan` is expected.

---

## Phase 2: Foundational

**Purpose**: None. The two shared helpers from US2 and US3 could be considered foundational but they belong to their own user stories and ship independently. No other shared infrastructure is needed before US2 starts.

**Checkpoint**: Phase 1 done → US2 starts.

---

## Phase 3: User Story 2 — Single helper for identifier generation (Priority: P1, executed FIRST per D6)

**Goal**: Consolidate the 5 inline `createId` definitions into one shared module with a dedicated unit test. Smallest, lowest-risk refactor — does not touch any UI code.

**Independent Test**: `npm test -- create-id` passes 5 cases, then a grep for `function createId\b` over `app/main/` returns exactly one match.

### Test-first cycle

- [X] T002 [US2] Create `tests/unit/create-id.test.ts` with the 5 cases listed in `contracts/create-id.md` §"Test fixtures expected": prefix preservation, id shape, uniqueness across 100 calls, optional `index` parameter behavior, no collision between with-and-without index variants. Import via `import { createId } from "../../app/main/shared/create-id";`.
- [X] T003 [US2] Run `npm test -- create-id` and confirm every test fails because the module does not exist yet.

### Implementation

- [X] T004 [US2] Create `app/main/shared/create-id.ts` exporting `function createId(prefix: string, index?: number): string`. Implement byte-for-byte the most expressive variant from the 5 existing inline copies. Reference: `app/main/domains/strategy/strategy.repository.ts:51` (variant with optional `index`) is the source-of-truth for the signature; `app/main/domains/workshop/workshop.service.ts:19` is the source-of-truth for the no-index format. The implementation MUST satisfy both.
- [X] T005 [US2] Run `npm test -- create-id` and confirm all 5 cases now pass.

### Migration of the 5 call sites (parallelizable across files)

- [X] T006 [P] [US2] Replace the inline `function createId` in `app/main/domains/calendar/calendar.service.ts:4` with `import { createId } from "../../shared/create-id";`.
- [X] T007 [P] [US2] Replace the inline `function createId` in `app/main/domains/strategy/strategy.repository.ts:51` with the same import (path adjusted: `from "../../shared/create-id"`).
- [X] T008 [P] [US2] Replace the inline `function createId` in `app/main/domains/workshop/workshop.service.ts:19` with the same import.
- [X] T009 [P] [US2] Replace the inline `function createId` in `app/main/domains/news/news-to-post.service.ts:10` with the same import.
- [X] T010 [P] [US2] Replace the inline `function createId` in `app/main/domains/ideas/ideas.repository.ts:4` with the same import.

### Verification

- [X] T011 [US2] Run `npm test` (full suite) and confirm every existing test still passes. Run `grep -rn "function createId\b" app/main/` and confirm exactly ONE match (in `shared/create-id.ts`).

**Checkpoint**: US2 complete. The shared helper exists, all 5 call sites use it, no existing test was modified, no test was broken.

---

## Phase 4: User Story 3 — Single point of writing to `execution_runs` (Priority: P1, executed second per D6)

**Goal**: Consolidate the 3 inline `INSERT INTO execution_runs` statements into one shared repository module with a dedicated unit test. Touches a SQL write path so requires more care than US2.

**Independent Test**: `npm test -- execution-runs-repository` passes 5 cases, then a grep for `INSERT INTO execution_runs` over `app/main/` returns exactly one match.

### Read source of truth

- [X] T012 [US3] Read the three existing inline INSERT statements verbatim and document the exact column set, column order, and value types as comments in `specs/007-code-quality-refactor/contracts/execution-runs-repository.md` §"Public function" if any field differs from what the contract currently lists. The three locations are: `app/main/domains/workshop/workshop.service.ts:743` (private method `recordExecutionRun`), `app/main/domains/library/library.service.ts:124`, `app/main/domains/news/news-to-post.service.ts:86`.

### Test-first cycle

- [X] T013 [US3] Create `tests/unit/execution-runs-repository.test.ts` with the 5 cases listed in `contracts/execution-runs-repository.md` §"Test fixtures expected": single-row insert, column value preservation, ISO timestamp format, JSON serialisation of structured payload, no accidental dedup. Use an in-memory `better-sqlite3` database with the schema applied via the existing `createExecutionTables` (or equivalent) helper.
- [X] T014 [US3] Run `npm test -- execution-runs-repository` and confirm every test fails because the module does not exist yet.

### Implementation

- [X] T015 [US3] Create `app/main/domains/execution/execution-runs.repository.ts` exporting `function insertExecutionRun(db: Database.Database, payload: ExecutionRunPayload): void` per the contract. Use a prepared statement for performance. Do NOT wrap in a transaction (per the contract). Do NOT add `INSERT OR IGNORE` or any dedup logic (per the contract).
- [X] T016 [US3] Run `npm test -- execution-runs-repository` and confirm all 5 cases now pass.

### Migration of the 3 call sites (sequential because they touch services with their own tests)

- [X] T017 [US3] Replace the inline INSERT in `app/main/domains/workshop/workshop.service.ts:743`. Keep the existing private `recordExecutionRun` method's name and signature; replace its body with a single call to `insertExecutionRun(this.db, { ... })`. Run `npm test -- workshop-service` and confirm every existing test still passes without modification.
- [X] T018 [US3] Replace the inline INSERT in `app/main/domains/library/library.service.ts:124`. Run `npm test -- library-service` and confirm every existing test still passes.
- [X] T019 [US3] Replace the inline INSERT in `app/main/domains/news/news-to-post.service.ts:86`. Run `npm test -- news-to-post.service` and confirm every existing test still passes.

### Verification

- [X] T020 [US3] Run `npm test` (full suite) and confirm every existing test still passes. Run `grep -rn "INSERT INTO execution_runs" app/main/` and confirm exactly ONE match (in `execution-runs.repository.ts`).

**Checkpoint**: US3 complete. Single SQL write helper, all 3 services delegate to it, no existing test was modified.

---

## Phase 5: User Story 4 — Activate `noUncheckedIndexedAccess` (Priority: P1, executed third per D6)

**Goal**: Activate the strict flag in both tsconfig files and fix every newly-flagged error using a real type narrowing. The audit measured ~20 errors mostly in `workshop.service.ts`. No `@ts-ignore`, `@ts-expect-error`, or `!` operator allowed (per Clarification Q4).

**Independent Test**: Both tsconfig files contain `"noUncheckedIndexedAccess": true`. `npm run typecheck` exits 0. The diff carries zero new escape-hatch comments or `!` operators introduced for this fix.

### Activation

- [X] T021 [US4] Add `"noUncheckedIndexedAccess": true` to the `compilerOptions` block of `tsconfig.node.json`.
- [X] T022 [US4] Add the same line to `tsconfig.web.json`.
- [X] T023 [US4] Run `npm run typecheck` and capture the list of errors. Count them and confirm the count is in the range [10, 30] expected by the audit. Save the error list to `/tmp/007-noUncheckedIndexedAccess-errors.log` for reference during the fix loop.

### Fix loop

- [X] T024 [US4] Fix the cluster of errors in `app/main/domains/workshop/workshop.service.ts` (lines around 245–253 per the audit). For each error, use one of the four allowed narrowing patterns: early return, explicit length check, optional chaining with fallback, or destructuring with default. Do NOT use `!`, `// @ts-ignore`, or `// @ts-expect-error`.
- [X] T025 [US4] Fix any remaining errors in `app/main/` services and IPC files. Group fixes by file. After each file is fixed, run `npx tsc --noEmit -- <file>` (or just `npm run typecheck`) to confirm no new errors slipped in.
- [X] T026 [US4] If any error appears in `app/renderer/src/`, fix it the same way. The audit measured 0 errors on the web side but the actual count after activation may differ.

### Verification

- [X] T027 [US4] Run `npm run typecheck` and confirm exit 0.
- [X] T028 [US4] Run `npm test` (full suite) and confirm every existing test still passes. The fixes are pure type narrowings — no behavior change is allowed.
- [X] T029 [US4] Run `git diff main -- app/ | grep -E "// @ts-(ignore|expect-error)|\\b[a-zA-Z_][a-zA-Z0-9_]*!\\."` and confirm zero new lines containing escape hatches or non-null assertions introduced as a fix for this flag. (Pre-existing usages elsewhere may still appear; the test is whether the diff INTRODUCES new ones.)

**Checkpoint**: US4 complete. Both tsconfig flags active, all newly-flagged errors fixed with real narrowings, no escape hatches.

---

## Phase 6: User Story 5 — Upgrade `eslint-plugin-react-hooks` to 7.x (Priority: P1, executed fourth per D6)

**Goal**: Refactor the 6 known `setState`-in-effect patterns FIRST (while still on the held 6.x), then upgrade the plugin, then fix any additional violations the upgrade flags. The conditional descope clause from Clarification Q1 may revert this US if a transitive bump breaks a stabilized feature.

**Independent Test**: `package.json` lists `eslint-plugin-react-hooks` at `^7.x` (UNLESS descope fired), `npm run lint` exits 0, and a grep for `useEffect\(\(\) => \{[^}]*set[A-Z]` over `app/renderer/src/features/` returns zero matches.

### Phase 6a — Refactor the 6 known patterns BEFORE the upgrade

This sub-phase happens while still on `eslint-plugin-react-hooks@6.1.1` so the lint stays green throughout. Each refactor preserves the user-observable behavior of its screen.

- [X] T030 [US5] Refactor the `useEffect(() => { setForm((f) => ({ ...f, draftId: draftIdFromUrl })); }, [draftIdFromUrl])` pattern in `app/renderer/src/features/calendar/CalendarScreen.tsx:36`. Replace with derived state: compute `form.draftId` from `draftIdFromUrl` directly via `useMemo` or a lazy initial state, eliminating the effect.
- [X] T031 [US5] Refactor the `useEffect(() => { loadAll().catch().finally(setLoading); }, [])` pattern in `app/renderer/src/features/calendar/CalendarScreen.tsx:54`. Replace with a fetch-on-mount pattern accepted by react-hooks 7.x (typically: either a `useEffect` whose body returns a cleanup function and uses a mounted flag, or a call inside an event handler triggered on mount via a data-fetching library convention).
- [X] T032 [US5] Refactor the setState-in-effect pattern in `app/renderer/src/features/ideas/IdeasScreen.tsx`. Read the file to identify the exact pattern, then apply the appropriate fix (derived state via `useMemo`, event handler, or mounted-flag wrapper).
- [X] T033 [US5] Refactor the setState-in-effect pattern in `app/renderer/src/features/workshop/WorkshopScreen.tsx`. Same approach. Note: this file will be fully decomposed in Phase 7b, so the fix may end up moving to a sub-component — that is acceptable as long as the post-decomposition file passes the lint rule.
- [X] T034 [US5] Refactor the setState-in-effect pattern in `app/renderer/src/features/execution/ExecutionScreen.tsx`. Same approach.
- [X] T035 [US5] Refactor the setState-in-effect pattern in `app/renderer/src/features/library/LibraryScreen.tsx`. Same approach.
- [X] T036 [US5] Run `npm test` (full screen tests in particular) and confirm every existing test still passes. The 6 patterns are gone but the user-observable behavior is identical.
- [X] T037 [US5] Run `npm run lint` and confirm it still exits 0 (we are still on 6.x, but the patterns we removed should leave no lint warning).

### Phase 6b — Upgrade and fix any additional violations

- [X] T038 [US5] Run `npm install --save-dev eslint-plugin-react-hooks@^7` to upgrade the plugin. Capture the npm output to identify any transitive bumps required (e.g., `eslint` major bump, `typescript-eslint` bump).
- [X] T039 [US5] Run `npm run lint` and capture the new violations introduced by the 7.x release (beyond the 6 already fixed). For each new violation, refactor it using the same patterns from Phase 6a. Do NOT add `// eslint-disable-next-line` comments (per FR-016).
- [X] T040 [US5] Run `npm test` (full suite) and confirm every existing test still passes.

### Phase 6c — Conditional descope check

- [X] T041 [US5] Run `node scripts/verify-hardening.mjs` and confirm 6/6 checks still pass. If any check regresses, the conditional descope clause from Clarification Q1 fires: revert the npm install (`git checkout package.json package-lock.json`), keep the 6 setState-in-effect refactors from Phase 6a (they are improvements that don't depend on the upgrade), add a comment to `eslint.config.js` documenting why `eslint-plugin-react-hooks` stays at 6.x, and mark T041 + T042 + T043 as descoped in the commit message.
- [X] T042 [US5] Run `node scripts/real-app-audit.mjs` and confirm 14 steps still complete successfully. Same conditional-descope rule as T041.
- [X] T043 [US5] If neither T041 nor T042 triggered the descope, the upgrade is committed-able. Run `npm run lint` one more time and confirm exit 0.

**Checkpoint**: US5 complete. Either `eslint-plugin-react-hooks@7.x` is in place with all violations fixed, OR US5 is descoped and the plugin stays at 6.x with the 6 manual refactors retained.

---

## Phase 7: User Story 1a — Decompose `StrategyScreen.tsx` (Priority: P2, executed fifth per D6)

**Goal**: Reduce `StrategyScreen.tsx` from 690 lines to ≤ 250 lines by extracting at least 4 sub-components under `features/strategy/components/`. Each sub-component is ≤ 300 lines (per Clarification Q3). Byte-for-byte preservation of the user-observable behavior.

**Independent Test**: `wc -l app/renderer/src/features/strategy/StrategyScreen.tsx` reports ≤ 250. The `components/` directory contains ≥ 4 sub-components. `npm test -- strategy-screen` passes without modification of any assertion text.

### Lock the baseline

- [X] T044 [US1] Read `tests/unit/strategy-screen.test.tsx` to inventory which DOM elements, queries, and assertions the test relies on. The split MUST preserve every selector path, or update queries to walk through the new sub-component nesting without changing assertion values.
- [X] T045 [US1] Run `npm test -- strategy-screen` and confirm every test currently passes. This is the baseline that every commit during the split must preserve.

### Extract sub-components

- [X] T046 [US1] Create `app/renderer/src/features/strategy/components/ProfileSection.tsx` containing the JSX and local handlers for the profile section (name, positioning, bio, expertise summary). Wire it into the parent via props for the relevant slice of state and a callback for changes. Run `npm test -- strategy-screen` after the move and confirm no regression.
- [X] T047 [US1] Create `app/renderer/src/features/strategy/components/OffersSection.tsx` for the offers list. Same wiring + post-extract test pass.
- [X] T048 [US1] Create `app/renderer/src/features/strategy/components/IcpsSection.tsx` for the ICPs list.
- [X] T049 [US1] Create `app/renderer/src/features/strategy/components/PillarsSection.tsx` for the editorial pillars.
- [X] T050 [US1] Create `app/renderer/src/features/strategy/components/VoiceRulesSection.tsx` for the voice rules.

### Optionally extract a shared hook

- [X] T051 [US1] If the sub-components and the orchestrator share substantial state (e.g., the loaded strategy bundle, the persistence-on-save logic), extract `app/renderer/src/features/strategy/hooks/useStrategyBundle.ts` to host the state and the load/save side effects. The orchestrator and the sub-components both consume the hook. This task is OPTIONAL — skip it if the prop drilling is shallow enough that a hook adds more complexity than it removes.

### Slim down the orchestrator

- [X] T052 [US1] Reduce `app/renderer/src/features/strategy/StrategyScreen.tsx` to an orchestrator that imports and renders the sub-components, ≤ 250 lines. Verify with `wc -l app/renderer/src/features/strategy/StrategyScreen.tsx`.

### Verify

- [X] T053 [US1] Run `npm test -- strategy-screen` and confirm every test still passes. Selector queries in the test file MAY be updated to traverse the new sub-component nesting; assertion text MUST stay identical.
- [X] T054 [US1] Run the FULL `node scripts/real-app-audit.mjs` (14 steps) and confirm exit 0. Per Analyze finding M1, the full audit is run after the StrategyScreen split (not just the strategy-related steps) so a regression there is caught and isolated before the WorkshopScreen split begins. Cost ~30 seconds, value: precise blame attribution.
- [X] T055 [US1] Verify each new sub-component file is ≤ 300 lines via `wc -l app/renderer/src/features/strategy/components/*.tsx`. Any file that exceeds 300 lines must contain an inline justification comment (per Clarification Q3).

**Checkpoint**: US1a complete. Strategy screen decomposed, all gates green.

---

## Phase 8: User Story 1b — Decompose `WorkshopScreen.tsx` (Priority: P2, executed sixth and last per D6)

**Goal**: Reduce `WorkshopScreen.tsx` from 548 lines to ≤ 250 lines by extracting at least 4 sub-components under `features/workshop/components/`. Same constraints as US1a. This is the highest-risk refactor of the feature — it goes last so any failure is isolated and easy to revert.

**Independent Test**: `wc -l app/renderer/src/features/workshop/WorkshopScreen.tsx` reports ≤ 250. The `components/` directory contains ≥ 4 sub-components. `npm test -- workshop-screen` passes without modification of any assertion text. `node scripts/real-app-audit.mjs` succeeds on the workshop steps.

### Lock the baseline

- [X] T056 [US1] Read `tests/unit/workshop-screen.test.tsx` to inventory the test contract. Document any selector that depends on the current monolithic DOM structure.
- [X] T057 [US1] Run `npm test -- workshop-screen` and confirm the baseline passes.

### Extract sub-components

- [X] T058 [US1] Create `app/renderer/src/features/workshop/components/IdeaPanel.tsx` containing the idea-display-and-context panel. Wire it via props.
- [X] T059 [US1] Create `app/renderer/src/features/workshop/components/StructurePanel.tsx` for the structure-selection step.
- [X] T060 [US1] Create `app/renderer/src/features/workshop/components/HookPanel.tsx` for the hook-engineering step.
- [X] T061 [US1] Create `app/renderer/src/features/workshop/components/DraftPanel.tsx` for the draft-generation step.
- [X] T062 [US1] Create `app/renderer/src/features/workshop/components/VariantPanel.tsx` for the variant-creation step.

### Optionally extract a shared hook

- [X] T063 [US1] If the sub-components share substantial state (the idea, the selected structure, the chosen hook, the generated draft), extract `app/renderer/src/features/workshop/hooks/useWorkshopFlow.ts`. Optional — same trade-off rule as T051.

### Slim down the orchestrator

- [X] T064 [US1] Reduce `app/renderer/src/features/workshop/WorkshopScreen.tsx` to an orchestrator ≤ 250 lines.

### Verify

- [X] T065 [US1] Run `npm test -- workshop-screen` and confirm every test still passes.
- [X] T066 [US1] Run the FULL `node scripts/real-app-audit.mjs` (14 steps) and confirm exit 0. Per Analyze finding M1. This is the most important safety net for this user story because WorkshopScreen orchestrates the largest editorial flow (atelier-open, atelier-structures, atelier-hooks, atelier-draft).
- [X] T067 [US1] Verify each new sub-component file is ≤ 300 lines.

**Checkpoint**: US1b complete. Workshop screen decomposed, all gates green. The feature is functionally done; only the polish phase remains.

---

## Phase 9: Polish — Regression gates + commits + merge

- [X] T068 Run the full local regression sequence in this order: `npm run rebuild:native:electron`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --audit-level=high --omit=dev`. Every command MUST exit 0. The test count MUST be at least `344 + 10 = 354` (the 344 baseline from feature 006 plus the 5 cases of `create-id.test.ts` and the 5 cases of `execution-runs-repository.test.ts`). It MAY be higher if any test was added during the screen splits.
- [X] T069 Run `node scripts/real-app-audit.mjs` and confirm 14 steps complete successfully (exit 0).
- [X] T070 Run `node scripts/verify-hardening.mjs` and confirm 6/6 checks pass (exit 0).
- [X] T071 Verify commit hygiene: run all four commands and confirm zero results: `git log main..HEAD --grep="Claude" --oneline`, `git log main..HEAD --pretty=full | grep -F "Co-Authored-By"`, `git log --all --grep="Claude" --oneline`, `git log --all --pretty=full | grep -F "Co-Authored-By"`.
- [X] T072 Verify the diff scope with five distinct assertions:
  - **Overall scope**: `git diff main --stat` should show modifications to the 5 createId call sites, the 3 execution_runs call sites, the 2 tsconfig files, the package.json (eslint-plugin-react-hooks bump), the 5 screens with setState refactors (Calendar, Ideas, Workshop, Execution, Library), the 2 large screens (Strategy, Workshop) shrunk to ≤ 250 lines, plus the new files: `create-id.ts`, `execution-runs.repository.ts`, `create-id.test.ts`, `execution-runs-repository.test.ts`, and the sub-components under `features/strategy/components/` and `features/workshop/components/`. No file outside this scope should be touched.
  - **FR-016 verification**: `git diff main -- 'app/renderer/**' | grep -E 'eslint-disable.*react-hooks' | wc -l` MUST return 0 (no new eslint-disable comments related to react-hooks rules introduced anywhere in the renderer diff).
  - **FR-028 verification (IPC frozen)**: `git diff main --stat -- app/shared/schemas/ app/main/ipc/ | grep . | wc -l` MUST return 0 (no modification to IPC schemas or handlers).
  - **FR-029 verification (SKILL.md frozen)**: `git diff main --stat -- 'skills/linkedin-*/SKILL.md' | grep . | wc -l` MUST return 0 (no modification to any skill prompt file).
  - **FR-030 verification (no new npm dep beyond eslint-plugin-react-hooks)**: `git diff main -- package.json | grep -E '^\\+\\s+"' | grep -v 'eslint-plugin-react-hooks'` MUST return 0 lines (the only new or upgraded `package.json` `"name": "version"` line is the react-hooks plugin one; if the conditional descope from Q1 fired, even that line is absent).
- [X] T073 Stage and commit the feature work as a small number of logical commits authored by `Philippe Cohen <contact@AutomatisIA.fr>` with conventional-commit subjects and **no `Co-Authored-By` trailer**. Suggested commit groups: (a) `docs(007): add spec-kit artifacts for code quality refactor`, (b) `refactor(007): extract createId helper and new unit tests`, (c) `refactor(007): extract execution_runs repository and new unit tests`, (d) `refactor(007): activate noUncheckedIndexedAccess and fix narrowings`, (e) `refactor(007): refactor setState-in-effect patterns and upgrade react-hooks plugin`, (f) `refactor(007): decompose StrategyScreen into sub-components`, (g) `refactor(007): decompose WorkshopScreen into sub-components`, (h) `chore(007): mark tasks complete in tasks.md`. Mark every task `[X]` in `tasks.md` before commit (h).
- [ ] T074 Switch to `main`, fast-forward merge `007-code-quality-refactor`, push `main` to `origin`. After the push, observe the GitHub Actions CI run on `main` and confirm all three OS matrix cells stay green. The refactor does not touch any platform-specific code, so CI should pass without iteration.

---

## Dependencies & Execution Order

### Phase Dependencies (per Research D6 — risk-ordered, NOT priority-ordered)

- **Phase 1 Setup**: no dependency, starts immediately.
- **Phase 2 Foundational**: empty.
- **Phase 3 US2 (createId)**: depends on Phase 1.
- **Phase 4 US3 (execution_runs)**: depends on Phase 3 (the createId helper is now available; the workshop service will use it from line 19 area which is also where the recordExecutionRun method lives, so doing US2 first reduces conflict surface).
- **Phase 5 US4 (noUncheckedIndexedAccess)**: depends on Phase 4 (the workshop.service.ts that contains both the createId site and the recordExecutionRun method is also the file with the most type narrowings to fix; doing the reorganizations first means fewer overlapping line ranges).
- **Phase 6 US5 (react-hooks 7)**: depends on Phase 5 (the lint upgrade may produce additional type-checker errors that interact with the new flag; doing the type checker first ensures the lint sees a clean type baseline).
- **Phase 7 US1a (StrategyScreen split)**: depends on Phase 6 (the lint rules from 7.x apply to every new sub-component file created during the split, so the upgrade must land first).
- **Phase 8 US1b (WorkshopScreen split)**: depends on Phase 7 (sequential — the pattern learned from the strategy split applies to the workshop split, and doing the highest-risk refactor LAST means a problem there is isolated).
- **Phase 9 Polish**: depends on every previous phase.

### Within each user story

- **US2**: T002 (test) → T003 (failure) → T004 (impl) → T005 (verify) → T006-T010 (parallel migrations) → T011 (verify suite).
- **US3**: T012 (read) → T013 (test) → T014 (failure) → T015 (impl) → T016 (verify) → T017-T019 (sequential migrations) → T020 (verify suite).
- **US4**: T021-T022 (activate) → T023 (capture) → T024-T026 (fix) → T027-T029 (verify).
- **US5**: T030-T035 (refactor 6 patterns on 6.x) → T036-T037 (verify pre-upgrade) → T038 (upgrade) → T039 (fix new) → T040 (verify) → T041-T043 (descope check).
- **US1a (Strategy)**: T044-T045 (lock baseline) → T046-T050 (extract sub-components) → T051 (optional hook) → T052 (slim orchestrator) → T053-T055 (verify).
- **US1b (Workshop)**: T056-T057 (lock baseline) → T058-T062 (extract sub-components) → T063 (optional hook) → T064 (slim orchestrator) → T065-T067 (verify).

### Parallel Opportunities

- **US2 migrations T006-T010**: 5 different files, no ordering constraint, fully parallelizable.
- **US3 migrations T017-T019**: serialised because each touches a different file but with associated tests that should pass at every commit.
- **Within US1a and US1b**: each sub-component extraction is sequential because they all touch the parent `StrategyScreen.tsx` / `WorkshopScreen.tsx` (removing JSX from the parent). No parallelism possible inside one screen.

### Across user stories

The risk-ordered execution from D6 SERIALISES the user stories. Even though some stories (e.g., US4 + US5) touch different files and could theoretically run in parallel, the discipline of the refactor is to land each user story fully before starting the next, so a regression at any point is bounded to one story.

---

## Implementation Strategy

### Sequential single-contributor path (recommended)

Total: **74 tasks** in the order T001 → T002 → ... → T074. Estimated effort: **10-18 hours** of focused work spread over 2-3 sessions, with checkpoints after each user story.

### Conditional descope at T041/T042

If `verify-hardening` or `real-app-audit` regresses after the `eslint-plugin-react-hooks@7` upgrade, US5 is descoped per Clarification Q1. The 6 manual refactors from Phase 6a are kept (they are improvements that don't depend on the plugin version), the npm install is reverted, and a comment is added to `eslint.config.js`. The feature still ships with US2, US3, US4, US1a, US1b complete.

### Suggested commit cadence

One commit per user story group (8 commits total per T073). This gives a clean git history where each commit is a self-contained, reviewable refactor. If any commit fails CI, only that user story has to be revisited, not the whole feature.

---

## Notes

- **[P] tasks** = different files, no ordering constraint with other [P] tasks in the same batch.
- **TDD gate** (Constitution IV): every new shared helper has its dedicated test file written before its implementation. Every existing test on a screen serves as a safety net for the screen split — it must pass at every commit during the split.
- **Risk-ordered execution** (Research D6): the user stories are NOT executed in priority order. They are executed in increasing order of risk, smallest and safest first. This is documented in the dependency graph above and is the rule that the task list enforces.
- **No Claude trailer** (FR-031): every commit MUST be authored by Philippe Cohen alone. T071 verifies this gate before merge.
- **Conditional descope** (Clarification Q1): if US5 fires the descope, T041 and T042 explicitly call out the revert procedure. The feature is allowed to ship with US5 descoped, with `eslint-plugin-react-hooks` staying at 6.x, as long as the situation is documented in the commit log and `eslint.config.js`.
- **Test count expectation**: 344 baseline + 5 (create-id) + 5 (execution-runs-repository) = at least 354. T068 asserts this.
