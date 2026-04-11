# Quickstart — Verifying Feature 007 End-to-End

This document is the verification sequence to run after every task in `tasks.md` is complete. It validates each user story and every success criterion.

## Prerequisites

- You are on branch `007-code-quality-refactor` with all tasks complete.
- Local gates were green before this branch was opened: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --audit-level=high --omit=dev`.
- The Codex CLI is authenticated locally (only required for `node scripts/real-app-audit.mjs`).

## Step 1 — Verify the deduplication of `createId`

```bash
grep -rn "function createId\b" app/main/
```

Expected: exactly one match, in `app/main/shared/create-id.ts`. The five former inline definitions in `calendar.service.ts`, `strategy.repository.ts`, `workshop.service.ts`, `news-to-post.service.ts`, and `ideas.repository.ts` MUST be gone.

```bash
grep -rn 'from "../../shared/create-id"' app/main/ | wc -l
```

Expected: 5 (one import per former call site). Note: the relative path may vary by file depth — verify by reading each call site.

## Step 2 — Verify the deduplication of `INSERT INTO execution_runs`

```bash
grep -rn "INSERT INTO execution_runs" app/main/
```

Expected: exactly one match, in `app/main/domains/execution/execution-runs.repository.ts`. The three former inline statements in `workshop.service.ts`, `library.service.ts`, and `news-to-post.service.ts` MUST be gone.

```bash
grep -rn "import { insertExecutionRun }" app/main/ | wc -l
```

Expected: 3 (workshop, library, news).

## Step 3 — Verify the new shared helper unit tests pass

```bash
npm test -- create-id execution-runs-repository
```

Expected:

- `tests/unit/create-id.test.ts` — at least 5 cases pass (FR-003a).
- `tests/unit/execution-runs-repository.test.ts` — at least 5 cases pass (FR-007a).

## Step 4 — Verify `noUncheckedIndexedAccess` is active and the typecheck passes

```bash
grep noUncheckedIndexedAccess tsconfig.node.json tsconfig.web.json
```

Expected: both files contain `"noUncheckedIndexedAccess": true`.

```bash
npm run typecheck
```

Expected: exit 0, no errors.

```bash
git diff main -- app/ | grep -E "// @ts-(ignore|expect-error)|\bas const\b|!\\.[a-z]" | head
```

Expected: zero new lines containing `@ts-ignore`, `@ts-expect-error`, or new non-null-assertion `!` operators introduced as a fix for `noUncheckedIndexedAccess`. Note: pre-existing usages elsewhere are out of scope and may still appear in the grep.

## Step 5 — Verify the `eslint-plugin-react-hooks` upgrade

```bash
grep eslint-plugin-react-hooks package.json
```

Expected: version is `^7.x` (UNLESS the conditional descope clause from Clarification Q1 fired, in which case it stays at `^6.x` and a comment in `eslint.config.js` records the reason).

```bash
npm run lint
```

Expected: exit 0.

```bash
grep -rE "useEffect\(\(\) => \{[^}]*set[A-Z]" app/renderer/src/features/ | head
```

Expected: zero matches (assuming the upgrade landed and US4 was not descoped). The 6 former patterns in `IdeasScreen`, `WorkshopScreen`, `ExecutionScreen`, `LibraryScreen`, `CalendarScreen` are all refactored.

## Step 6 — Verify the `StrategyScreen.tsx` decomposition

```bash
wc -l app/renderer/src/features/strategy/StrategyScreen.tsx
ls app/renderer/src/features/strategy/components/ 2>/dev/null
```

Expected:

- `StrategyScreen.tsx` is 250 lines or fewer.
- `app/renderer/src/features/strategy/components/` directory exists and contains at least 4 sub-components.
- Each sub-component is 300 lines or fewer (or carries an inline justification comment if it exceeds).

```bash
npm test -- strategy-screen
```

Expected: every test in `tests/unit/strategy-screen.test.tsx` passes without modification of any assertion text.

## Step 7 — Verify the `WorkshopScreen.tsx` decomposition

```bash
wc -l app/renderer/src/features/workshop/WorkshopScreen.tsx
ls app/renderer/src/features/workshop/components/ 2>/dev/null
```

Expected:

- `WorkshopScreen.tsx` is 250 lines or fewer.
- `app/renderer/src/features/workshop/components/` directory exists and contains at least 4 sub-components.
- Each sub-component is 300 lines or fewer.

```bash
npm test -- workshop-screen
```

Expected: every test passes without modification of any assertion text.

## Step 8 — Run the full regression suite

```bash
npm run rebuild:native:electron
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high --omit=dev
```

Expected: every command exits 0. Test count is at least `344 + 10 = 354` (the 344 baseline from feature 006 plus the 5+5 new cases from `create-id.test.ts` and `execution-runs-repository.test.ts`). It MAY be higher if any selector update in a screen test added a sanity case.

## Step 9 — Run the end-to-end real-app audit

```bash
node scripts/real-app-audit.mjs
```

Expected: 14 steps complete successfully (parcours principal: dashboard, strategie-save, strategie-foundation, idees, atelier-open, atelier-structures, atelier-hooks, atelier-draft, bibliotheque-load, bibliotheque-variant, calendrier, runner, parametres, plus completion). This is the only end-to-end safety net for the screen splits. If a regression slipped into either StrategyScreen or WorkshopScreen, this audit catches it.

## Step 10 — Run the verify-hardening script

```bash
node scripts/verify-hardening.mjs
```

Expected: 6 checks pass (DevTools gating, window.open denial, CSP violation, workspace rejection 2 variants, DevTools defensive close). This validates that the refactor did not regress any of the security hardening from feature 002.

## Step 11 — Verify commit hygiene

```bash
git log main..HEAD --grep="Claude" --oneline
git log main..HEAD --pretty=full | grep -F "Co-Authored-By"
git log --all --grep="Claude" --oneline
git log --all --pretty=full | grep -F "Co-Authored-By"
```

Expected: every command returns no results. SC-008 satisfied.

## Step 12 — Push and observe CI

After merging into `main` and pushing to `origin`, observe the GitHub Actions CI run for the new commit. Expected: all three OS matrix cells (`macos-latest`, `ubuntu-latest`, `windows-latest`) pass on the first attempt. The refactor does not touch any platform-specific code, so no iteration should be needed.

## Sign-off criteria

Feature 007 is considered complete when:

- [x] Steps 1 through 11 all pass locally on macOS.
- [x] Step 12 (post-merge CI on main) reports 3/3 OS green.
- [x] Every FR in `spec.md` is satisfied.
- [x] Every SC in `spec.md` is measurable and measured as satisfied.
- [x] The conditional descope clause from Clarification Q1 either did not fire (US4 landed) or fired and is documented in the commit log + an `eslint.config.js` comment (US4 descoped).
- [x] Every commit on the feature branch is authored solely by Philippe Cohen with no AI-related trailer.
