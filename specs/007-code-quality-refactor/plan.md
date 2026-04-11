# Implementation Plan: Code Quality Refactor

**Branch**: `007-code-quality-refactor` | **Date**: 2026-04-12 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-code-quality-refactor/spec.md`

## Summary

Six refactor targets bundled in a single feature to clear the technical-debt backlog: deduplicate `createId()` (5 copies → 1 shared module), centralise the `INSERT INTO execution_runs` statement (3 copies → 1 dedicated repository file), activate `noUncheckedIndexedAccess` and fix the ~20 newly-flagged latent bugs without using any escape hatch (no `@ts-ignore`, no `@ts-expect-error`, no non-null assertion `!`), upgrade `eslint-plugin-react-hooks` from 6.1.1 to 7.x and refactor the 6 existing `setState`-in-effect anti-patterns plus any new violations the upgrade flags, and decompose `StrategyScreen.tsx` (690 lines) and `WorkshopScreen.tsx` (548 lines) into orchestrators ≤ 250 lines each plus per-section / per-step sub-components ≤ 300 lines each. Two new dedicated unit test files (`create-id.test.ts` and `execution-runs-repository.test.ts`) lock the shared helpers' contracts. The feature ships pure refactor — every change is byte-for-byte preserved at the user-observable behavior level. The conditional descope clause from Clarification Q1 protects features 002-006 from cascading regressions: if `eslint-plugin-react-hooks@7` requires a transitive major bump that breaks a stabilized feature, US4 is descoped and the plugin stays at 6.x.

## Technical Context

**Language/Version**: TypeScript 6.0.2 (no version change). React 19.2.5 (no version change). Electron 41.2.0 (no version change). Node 20 runtime (no version change).
**Primary Dependencies**: No new runtime dependencies. The only devDep change is `eslint-plugin-react-hooks` 6.1.1 → 7.x with possible transitive bumps of `eslint` core or `typescript-eslint` per Clarification Q1 (conditional descope policy).
**Storage**: No schema change to SQLite. The `execution_runs` table receives the same column set with the same types, only via a single shared write helper instead of three inline copies. No migration. No new index.
**Testing**: Vitest 4.1.4 (no change). Two new test files added: `tests/unit/create-id.test.ts` (≥ 5 cases per FR-003a) and `tests/unit/execution-runs-repository.test.ts` (≥ 5 cases per FR-007a). The existing `tests/unit/strategy-screen.test.tsx` and `tests/unit/workshop-screen.test.tsx` are the safety net for the screen splits and MUST pass without modification of any assertion text per FR-020 and FR-025.
**Target Platform**: Same as before — local Electron desktop on macOS, Linux, Windows runners in CI. No platform-specific code added or removed.
**Project Type**: Electron desktop application. The refactor touches the main process (services and repositories under `app/main/domains/`) and the renderer (the two screen files and their new sub-components under `app/renderer/src/features/`). Preload and IPC schemas are explicitly frozen by FR-028.
**Performance Goals**: SC-001 — locating any specific section of `StrategyScreen.tsx` or `WorkshopScreen.tsx` takes under 30 seconds for a maintainer (vs scrolling through 600+ lines today). This is a developer-velocity metric, not a runtime metric. Runtime performance must not regress.
**Constraints**: Byte-for-byte preservation of user-observable behavior (every refactor preserves the runtime semantics). No new npm dependency outside `eslint-plugin-react-hooks`. No `Co-Authored-By` trailer in any commit (FR-031, session feedback rule). No modification of IPC schemas (FR-028) or `SKILL.md` content (FR-029). No `// @ts-ignore`, `// @ts-expect-error`, or `!` operator added to satisfy `noUncheckedIndexedAccess` (FR-010 + Clarification Q4).
**Scale/Scope**: 5 sites consolidated for `createId`, 3 sites consolidated for `execution_runs`, ~20 type-narrowing fixes for `noUncheckedIndexedAccess`, 6+ React hook patterns refactored for `react-hooks@7`, 2 screens decomposed into 8-10 sub-components total. Estimated effort: 10-18 hours of focused work.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|---|---|---|
| **I — Local-First and Confidential by Default** | ✅ PASS | No remote service introduced. The refactor stays within the existing local Electron + SQLite + Codex CLI architecture. No telemetry, no remote logging, no new credential. |
| **II — Workflow Before Prompting** | ✅ PASS (N/A) | The feature does not introduce any new editorial workflow step. It reorganises existing code without changing the user-facing workflow. |
| **III — Specialized Skills with Structured I/O** | ✅ PASS (N/A) | No skill is added, removed, renamed, or contractually changed. `SKILL.md` files are explicitly frozen by FR-029. The runner contract on `SkillRunnerInvocation` and `SkillRunnerResult` remains unchanged. |
| **IV — Test-First Development Is Mandatory** | ✅ PASS — strengthened | The two new shared helpers (`create-id` and `execution-runs-repository`) get dedicated unit test files written BEFORE the implementation per Clarification Q5. The existing `strategy-screen.test.tsx` and `workshop-screen.test.tsx` are the safety net for the riskier screen splits — the rule is that they must pass at every commit during the split. The refactor of inline patterns for `react-hooks@7` is preceded by a manual exercise of each affected screen to lock the visible behavior; if a behavior is not yet covered by a test, a test is added before the refactor. |
| **V — Human Validation Over Autonomous Publishing** | ✅ PASS (N/A) | The feature does not touch any publishing path. Codex output handling, draft generation, and the calendar all remain unchanged. The refactor reorganises the code that orchestrates these flows but never bypasses the maintainer's review. |
| **VI — Simplicity for MVP, Extensibility for the System** | ✅ PASS — strengthened | The feature DELETES code (5 copies of `createId`, 3 copies of `INSERT execution_runs`) and CONSOLIDATES it. Net code volume decreases. No new abstraction layer is introduced — the new helper modules are minimal, plain functions, no factories, no DI containers, no class hierarchies. The screen splits replace one big component with several smaller named components, which is the simplest possible decomposition. |

**Result**: ✅ All six principles satisfied. No violations. Complexity Tracking section will remain empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-code-quality-refactor/
├── plan.md              # This file
├── spec.md              # Feature spec with 5 clarifications integrated
├── research.md          # Phase 0 decisions (D1–D6)
├── data-model.md        # Refactor diff entities (which file moves where)
├── contracts/
│   ├── create-id.md                       # Shared helper API contract
│   └── execution-runs-repository.md       # Shared write helper API contract
├── checklists/
│   └── requirements.md                    # Spec quality checklist (already PASS)
├── quickstart.md        # Verification sequence after merge
└── tasks.md             # Phase 2 output (from /speckit-tasks)
```

### Source Code (repository root)

```text
app/main/
├── shared/
│   └── create-id.ts                            # NEW — single createId implementation
├── domains/
│   ├── execution/
│   │   ├── execution-runs.repository.ts        # NEW — single insertExecutionRun
│   │   ├── execution.service.ts                # UNCHANGED (per Clarification Q2)
│   │   └── ...
│   ├── workshop/workshop.service.ts            # MODIFIED — imports createId, calls insertExecutionRun, fixes noUncheckedIndexedAccess narrowings
│   ├── library/library.service.ts              # MODIFIED — calls insertExecutionRun
│   ├── news/news-to-post.service.ts            # MODIFIED — imports createId, calls insertExecutionRun
│   ├── calendar/calendar.service.ts            # MODIFIED — imports createId
│   ├── ideas/ideas.repository.ts               # MODIFIED — imports createId
│   └── strategy/strategy.repository.ts         # MODIFIED — imports createId

app/renderer/src/features/
├── strategy/
│   ├── StrategyScreen.tsx                      # MODIFIED — orchestrator ≤ 250 lines
│   └── components/                             # NEW — at least 4 sub-components
│       ├── ProfileSection.tsx                  # ≤ 300 lines
│       ├── OffersSection.tsx                   # ≤ 300 lines
│       ├── IcpsSection.tsx                     # ≤ 300 lines
│       ├── PillarsSection.tsx                  # ≤ 300 lines
│       └── VoiceRulesSection.tsx               # ≤ 300 lines (optional 5th)
├── workshop/
│   ├── WorkshopScreen.tsx                      # MODIFIED — orchestrator ≤ 250 lines
│   └── components/                             # NEW — at least 4 sub-components
│       ├── IdeaPanel.tsx                       # ≤ 300 lines
│       ├── StructurePanel.tsx                  # ≤ 300 lines
│       ├── HookPanel.tsx                       # ≤ 300 lines
│       ├── DraftPanel.tsx                      # ≤ 300 lines
│       └── VariantPanel.tsx                    # ≤ 300 lines (optional 5th)
├── calendar/CalendarScreen.tsx                 # MODIFIED — refactor 2 setState-in-effect patterns
├── ideas/IdeasScreen.tsx                       # MODIFIED — refactor 1 setState-in-effect pattern
├── library/LibraryScreen.tsx                   # MODIFIED — refactor 1 setState-in-effect pattern
└── execution/ExecutionScreen.tsx               # MODIFIED — refactor 1 setState-in-effect pattern

tests/unit/
├── create-id.test.ts                           # NEW — ≥ 5 cases per FR-003a
├── execution-runs-repository.test.ts           # NEW — ≥ 5 cases per FR-007a
├── workshop-service.test.ts                    # MAY BE UPDATED — only if a noUncheckedIndexedAccess narrowing changes a return path
├── strategy-screen.test.tsx                    # UNCHANGED assertion text
├── workshop-screen.test.tsx                    # UNCHANGED assertion text
├── calendar-screen.test.tsx                    # MAY BE UPDATED — only selector queries, never assertion text
├── ideas-screen.test.tsx                       # MAY BE UPDATED — only selector queries
├── library-screen.test.tsx                     # MAY BE UPDATED — only selector queries
└── (existing files untouched)

tsconfig.node.json                              # MODIFIED — adds noUncheckedIndexedAccess: true
tsconfig.web.json                               # MODIFIED — adds noUncheckedIndexedAccess: true
package.json                                    # MODIFIED — bumps eslint-plugin-react-hooks
```

**Structure Decision**: The shared helpers live in two distinct locations: `app/main/shared/create-id.ts` for the trans-domain identifier helper (no domain ownership), and `app/main/domains/execution/execution-runs.repository.ts` for the persistence helper (clear domain ownership: the execution domain). This split was decided in Clarification Q2. The screen sub-components live next to their parent screen under `features/<screen>/components/` rather than in a shared `components/` directory, because they are tightly coupled to their parent's domain logic and reusing them across features is explicitly out of scope for this refactor.

## Complexity Tracking

> No Constitution Check violations. Section left empty per template instructions.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | *(none)* | *(none)* |
