# Data Model — Feature 007: Code Quality Refactor

This feature introduces no new persistent data, no schema migration, no IPC channel, no new database table. The "data model" here is the **refactor diff** — which file moves where, which symbol is consolidated, which test gates apply.

## Refactor entities

### `createId` shared helper

- **Before**: 5 inline definitions in `app/main/domains/calendar/calendar.service.ts:4`, `app/main/domains/strategy/strategy.repository.ts:51`, `app/main/domains/workshop/workshop.service.ts:19`, `app/main/domains/news/news-to-post.service.ts:10`, `app/main/domains/ideas/ideas.repository.ts:4`. Four are byte-for-byte identical; the fifth (strategy) accepts an optional `index = 0` parameter for deterministic ordering.
- **After**: 1 file `app/main/shared/create-id.ts` exporting `function createId(prefix: string, index?: number): string`. The five inline definitions are deleted, replaced by `import { createId } from "../../shared/create-id";` (path adjusted per call-site depth).
- **Behavior contract**: byte-for-byte identical to today's most expressive variant. Same id format, same uniqueness guarantees, same prefix preservation. The optional `index` parameter behaves like the strategy variant when supplied and like the simpler variant when omitted.
- **Test contract**: `tests/unit/create-id.test.ts` covers prefix preservation, id shape, uniqueness across many calls, the optional `index` parameter behavior, and no collision between with-and-without index variants.

### `execution_runs` write helper

- **Before**: 3 inline `INSERT INTO execution_runs (...)` statements in `app/main/domains/workshop/workshop.service.ts:743` (private method `recordExecutionRun`), `app/main/domains/library/library.service.ts:124`, `app/main/domains/news/news-to-post.service.ts:86`. The three copies write the same column set with the same values.
- **After**: 1 file `app/main/domains/execution/execution-runs.repository.ts` exporting `function insertExecutionRun(db: Database.Database, payload: ExecutionRunPayload): void`. The three inline statements are deleted, replaced by import + call. The existing `app/main/domains/execution/execution.service.ts` is NOT extended (per Clarification Q2).
- **Behavior contract**: same column set, same column order, same type coercion, same ISO timestamp format, same JSON serialisation of any structured payload (`SkillRunnerInvocation`, `SkillRunnerResult`). One INSERT per call, no dedup, no transaction grouping.
- **Test contract**: `tests/unit/execution-runs-repository.test.ts` covers single-row insert, column value preservation, ISO timestamp format, JSON serialisation, no accidental dedup.

### `noUncheckedIndexedAccess` activation

- **Before**: `tsconfig.node.json` and `tsconfig.web.json` have `strict: true` but no `noUncheckedIndexedAccess`. The audit measured ~20 latent type errors that the flag would surface, mostly in `workshop.service.ts` (lines 245-253 cluster) and a few other services.
- **After**: Both tsconfig files have `"noUncheckedIndexedAccess": true`. Every newly-flagged error is fixed in place using one of the four allowed narrowing patterns: early return, explicit length check, optional chaining with fallback, or destructuring with default. No `// @ts-ignore`, no `// @ts-expect-error`, no `!` operator added (per Clarification Q4 and FR-010).
- **Behavior contract**: the runtime semantics of every fixed line are unchanged. Each fix is a defensive narrowing that handles the previously-unhandled "index out of range" case. If the previous code would have crashed at runtime with a TypeError, the new code now either skips the broken case (early return) or substitutes a fallback value. The visible behavior at the user level is preserved because the previously-crashing path was unreachable in practice (otherwise it would have been a known bug); the fix is purely a hardening.
- **Test contract**: `npm run typecheck` exits 0. The full existing test suite passes without modification. The diff carries zero new `@ts-ignore`, `@ts-expect-error`, or `!` operators.

### `eslint-plugin-react-hooks` upgrade

- **Before**: `package.json` pins `eslint-plugin-react-hooks` at `^6.1.1`. Six `useEffect(() => { setSomething(...); }, [...])` patterns exist across five screens (Calendar 2, Workshop 1, Ideas 1, Library 1, Execution 1). The `set-state-in-effect` rule from 7.x would flag every one of them.
- **After**: `eslint-plugin-react-hooks` at `^7.x`. The six identified patterns plus any additional violations the upgrade flags are refactored to compliant patterns. The conditional descope clause from Clarification Q1 may revert this entity to its "before" state if a transitive bump breaks a stabilized feature.
- **Behavior contract**: every screen's user-observable behavior is preserved. Loading sequences, form pre-fills, fetch-on-mount, focus order — all identical. The lint rule is the only thing that changes; the runtime is unchanged.
- **Test contract**: `npm run lint` exits 0. The existing screen tests pass without modification of assertion text. The diff carries zero new `eslint-disable` comments related to react-hooks rules (per FR-016).

### `StrategyScreen.tsx` decomposition

- **Before**: `app/renderer/src/features/strategy/StrategyScreen.tsx` is 690 lines. It manages the profile, offers, ICPs, pillars, and voice rules in one component. The state and persistence logic are all in one place.
- **After**: `StrategyScreen.tsx` is ≤ 250 lines, an orchestrator. At least four sub-components live under `app/renderer/src/features/strategy/components/`, one per logical section. Each sub-component is ≤ 300 lines (per Clarification Q3); sub-components that exceed 300 lines must carry an inline justification comment. A new hook (e.g., `app/renderer/src/features/strategy/hooks/useStrategyBundle.ts`) MAY be extracted to share state and persistence between the orchestrator and the sub-components.
- **Behavior contract**: byte-for-byte identical user-observable behavior. Same form fields in the same order, same labels, same buttons, same loading sequences, same error messages, same persistence-on-save semantics.
- **Test contract**: `tests/unit/strategy-screen.test.tsx` passes without modification of assertion text. Selector queries (e.g., `screen.getByRole(...)`) MAY be updated to traverse the new sub-component nesting, but the expected values stay the same. `node scripts/real-app-audit.mjs` still completes 14 steps successfully.

### `WorkshopScreen.tsx` decomposition

- **Before**: `app/renderer/src/features/workshop/WorkshopScreen.tsx` is 548 lines. It orchestrates the idea → structure → hook → draft → variant editorial pipeline.
- **After**: `WorkshopScreen.tsx` is ≤ 250 lines, an orchestrator. At least four sub-components live under `app/renderer/src/features/workshop/components/`, one per editorial step. Each sub-component is ≤ 300 lines. A new hook (e.g., `app/renderer/src/features/workshop/hooks/useWorkshopFlow.ts`) MAY be extracted to share the flow state between the orchestrator and the sub-components.
- **Behavior contract**: byte-for-byte identical. Same step transitions, same loading states, same Codex invocation triggers, same error display.
- **Test contract**: `tests/unit/workshop-screen.test.tsx` passes without modification of assertion text. Selector queries MAY be updated. The `real-app-audit` workshop steps (atelier-open, atelier-structures, atelier-hooks, atelier-draft) all still pass.

## Refactor matrix

| Target | Files removed/modified | Files added | Tests touched |
|---|---|---|---|
| createId dedup | 5 modified | 1 new (`app/main/shared/create-id.ts`) | 1 new (`create-id.test.ts`); existing service tests untouched |
| execution_runs dedup | 3 modified | 1 new (`execution-runs.repository.ts`) | 1 new (`execution-runs-repository.test.ts`); existing service tests untouched |
| noUncheckedIndexedAccess | 2 tsconfig + ~10 service files | 0 | 0 (existing tests pass after fixes) |
| react-hooks 7 upgrade | 5 screen files + package.json | 0 | 0 (existing screen tests pass after refactor) |
| StrategyScreen split | 1 modified (`StrategyScreen.tsx`) | 4-5 new (`components/*.tsx`) + maybe 1 hook | 1 (`strategy-screen.test.tsx`, selector updates only) |
| WorkshopScreen split | 1 modified (`WorkshopScreen.tsx`) | 4-5 new (`components/*.tsx`) + maybe 1 hook | 1 (`workshop-screen.test.tsx`, selector updates only) |

## Lifecycle and ownership

| Artifact | Created by | Modified by | Read by |
|---|---|---|---|
| `app/main/shared/create-id.ts` | feature 007 | future features that need a new id helper variant | every service that creates an entity id |
| `app/main/domains/execution/execution-runs.repository.ts` | feature 007 | future features that change the `execution_runs` schema | workshop, library, news services |
| `app/renderer/src/features/strategy/components/*.tsx` | feature 007 | future features that change the strategy UX | only by `StrategyScreen.tsx` |
| `app/renderer/src/features/workshop/components/*.tsx` | feature 007 | future features that change the workshop UX | only by `WorkshopScreen.tsx` |

No artifact has a database identity. No artifact participates in a state machine. The lifecycle is purely "code organisation that evolves with the feature roadmap".
