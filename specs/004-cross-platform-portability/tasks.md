---

description: "Task list for feature 004-cross-platform-portability"
---

# Tasks: Cross-platform portability and responsive renderer baseline

**Input**: Design documents from `/specs/004-cross-platform-portability/`
**Prerequisites**: plan.md, spec.md, research.md, contracts/, quickstart.md

**Tests**: included because Constitution IV mandates TDD for every testable behavior, and the plan's Testing Strategy explicitly orders failing-test-first for the cross-OS helper.

**Organization**: tasks are grouped by user story. User Stories 1 and 2 (Windows contributor and Linux contributor) share almost all of the same implementation work (the same `findCodexBinary` helper, the same electron-builder config, the same launcher-script gating, the same placeholder icon strategy), so they are delivered together in Phase 3. User Story 3 (macOS non-regression) is a verification phase on top of the Phase 3 changes. User Story 4 (responsive) and User Story 5 (documentation) each have their own dedicated phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: user story the task belongs to (US1, US2, US3, US4, US5)
- File paths are absolute from repository root

## Path Conventions

- Main process Codex runner: `app/main/domains/execution/`
- New helper: `app/main/domains/execution/find-codex-binary.ts`
- Tests: `tests/unit/`
- Electron-builder config: `package.json > build`
- Launcher scripts: `scripts/`
- Icons: `resources/icons/`
- Renderer styles: `app/renderer/src/styles.css`
- Documentation: `docs/exploitation.md`

---

## Phase 1: Setup (capture baseline)

- [ ] T001 Confirm the working tree is clean on the `004-cross-platform-portability` branch by running `git status` at the repository root. Only `dist-app/`, `dist-launcher/`, and the Phase 1 setup artifacts may be present.
- [ ] T002 Capture baseline gates: `npm audit` (expect 0 vulns), `npm test` (expect 198 passed), `npm run typecheck`, `npm run lint`, `npm run build`, `node scripts/real-app-audit.mjs` (14 steps), `node scripts/verify-hardening.mjs` (6 checks). All must be green. If any is red, stop and fix before continuing.
- [ ] T003 [P] Re-read `.specify/memory/constitution.md` to re-anchor on principles I-VI.

---

## Phase 2: Foundational (cross-OS Codex binary detection helper)

**Purpose**: introduce the `findCodexBinary()` helper with TDD discipline. This is the most load-bearing change of the feature because it alters the runtime behavior of the Codex runner on every platform. Every subsequent phase depends on this helper existing and being fully tested.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete and the existing `codex-cli-runner.test.ts` suite continues to pass alongside the new helper's tests.

### Tests for the helper (TDD — write failing first)

- [ ] T004 Create `/Users/philippe/Dev/LinkedIn-poster/tests/unit/find-codex-binary.test.ts` with cases covering the ten contract scenarios listed in `specs/004-cross-platform-portability/contracts/codex-binary-detection.md`: darwin with PATH hit at `/opt/homebrew/bin`; darwin with fallback to `/opt/homebrew/bin`; darwin with fallback to `/usr/local/bin`; linux with PATH hit; linux with fallback to `$HOME/.local/bin`; win32 with PATH hit; win32 with fallback to `%ProgramFiles%\Codex\bin`; any platform with no binary → returns null; any platform with undefined PATH → does not throw; the `existsSync` mock is the only filesystem source. Each test stubs `platform`, `env`, `existsSync`, and `homedir`. Observe the file failing on import because the helper does not exist.

### Implementation of the helper

- [ ] T005 Create `/Users/philippe/Dev/LinkedIn-poster/app/main/domains/execution/find-codex-binary.ts` exporting `FindCodexBinaryDeps` and `findCodexBinary(deps?)`. Branch on `platform` for the three target platforms. Deduplicate candidate directories before probing. Return the first existing candidate or `null`. No filesystem side effects beyond `existsSync` calls. Run T004 and confirm it passes.

### Runner refactor

- [ ] T006 Refactor `/Users/philippe/Dev/LinkedIn-poster/app/main/domains/execution/codex-cli-runner.ts`: remove `buildCodexCliPath`, import `findCodexBinary` from the new helper, change `defaultExecutor` to resolve the binary path at the start of each invocation and pass the resolved absolute path (or the bare `"codex"` as a last-ditch fallback) as argv[0] to `spawnSync`. Keep the existing `timeout` handling from feature 002 and the `signal: "SIGTERM"` detection untouched. Remove the PATH enrichment previously applied via `env.PATH`.
- [ ] T007 Extend `/Users/philippe/Dev/LinkedIn-poster/tests/unit/codex-cli-runner.test.ts` with a case that mocks `platform = "darwin"` and asserts the Codex invocation uses the refactored path (via the injected executor capturing `args[0]`). The existing cases must continue to pass without modification. Run the suite and confirm green.

**Checkpoint**: the helper is in place, fully tested, and the runner uses it. Every macOS invariant is preserved.

---

## Phase 3: User Stories 1 + 2 — Windows and Linux contributor enablement (Priority: P1) 🎯 MVP

**Goal**: make `npm install`, `npm run dev`, `npm test`, `npm run build`, `npm run package:win`, and `npm run package:linux` invocable on their respective target operating systems. Deliver electron-builder config, launcher script gating, and placeholder icons.

**Independent test**: on a Windows or Linux host, the five commands above succeed. On macOS, they are either invoked with a platform-specific target (which may fail gracefully on non-native hosts) or not invoked at all, and macOS commands continue to work unchanged.

### electron-builder configuration

- [ ] T008 [P] [US1] Add a `win` section to the `build` block in `/Users/philippe/Dev/LinkedIn-poster/package.json` with `target: ["nsis", "portable"]` and `icon: "resources/icons/icon.ico"` per research decision D1. Do not add code signing. Do not touch the existing `mac` section.
- [ ] T009 [P] [US2] Add a `linux` section to the same `build` block with `target: ["AppImage", "deb"]`, `icon: "resources/icons/icon.png"`, and `category: "Office"` per research decision D2.
- [ ] T010 [US1] Add `package:win` script to `/Users/philippe/Dev/LinkedIn-poster/package.json` that runs `npm run build && electron-builder --win dir` (or the canonical electron-builder Windows invocation). The macOS equivalent `package:mac` stays unchanged.
- [ ] T011 [US2] Add `package:linux` script to the same file that runs `npm run build && electron-builder --linux dir` (or the canonical electron-builder Linux invocation).

### Icon placeholders

- [ ] T012 [US1] Create `/Users/philippe/Dev/LinkedIn-poster/resources/icons/` directory. Generate or commit a 512×512 placeholder PNG source image (plain background + "LP" text). Derive `icon.ico` (multi-resolution, 16/32/48/128/256) from it using `sips` or a cross-OS converter available on the macOS host.
- [ ] T013 [US2] From the same source PNG, produce `icon.png` at 512×512 and place it at `resources/icons/icon.png` for Linux. If the macOS build already references a local `icon.icns`, keep it in the same directory or generate a placeholder `.icns` if absent.
- [ ] T014 [P] [US1] Create `/Users/philippe/Dev/LinkedIn-poster/resources/icons/README.md` explaining that every icon in the directory is a placeholder, who replaces them (designer pass before first public release), and which chantier this work was produced in (chantier 3 / feature 004).

### macOS launcher script gating

- [ ] T015 [P] [US1] Update `/Users/philippe/Dev/LinkedIn-poster/scripts/open-mac-latest.sh` to detect non-Darwin hosts at the top of the script (`if [ "$(uname -s)" != "Darwin" ]`) and print an advisory message "open-mac-latest.sh is macOS-only; use the packaged Windows .exe or Linux AppImage instead" to stderr, then exit with status 0 (non-crash) so scripts calling it conditionally can continue. Preserve the existing macOS behavior below the gate.
- [ ] T016 [P] [US2] Update `/Users/philippe/Dev/LinkedIn-poster/scripts/build-mac-launcher.mjs` to early-exit on `process.platform !== "darwin"` with a similar advisory printed to stderr. Return immediately without attempting to run any macOS-specific command.
- [ ] T017 [P] [US1] Update `/Users/philippe/Dev/LinkedIn-poster/scripts/mac-launcher-lib.mjs` to export a guard function that early-exits on non-Darwin. Ensure existing consumers of the module (notably `build-mac-launcher.mjs` itself) call the guard before anything else.

### Launcher gate tests

- [ ] T018 [US1] Extend `/Users/philippe/Dev/LinkedIn-poster/tests/unit/mac-launcher-lib.test.ts` with a case that stubs `process.platform` to `"linux"` and asserts the library early-exits without throwing or attempting any macOS-specific call. The existing macOS-path cases must continue to pass unchanged.

### Verification for User Stories 1 + 2

- [ ] T019 [US1] Run `npm run typecheck` and `npm run lint`. Both must be clean. The new helper and the refactored runner must compile and pass lint.
- [ ] T020 [US1] Run `npm test`. The baseline 198 tests + the new helper test cases + the extended runner and launcher tests must all pass.
- [ ] T021 [US2] Run `npm run build` on the macOS host. The build must still succeed and the packaged bundle under `out/renderer/` must still contain the CSP meta element. `package.json` now referencing icons at `resources/icons/` must not break the macOS build (the macOS build uses `mac` section which is unchanged).
- [ ] T022 [P] [US1] Create a commit `feat(004): add cross-OS Codex binary detection and Windows/Linux build targets` with the helper, the runner refactor, the electron-builder config, the launcher gating, the icons, and their tests.

**Checkpoint**: the code is ready for Windows and Linux builds. The macOS host continues to work. Windows and Linux builds are not yet validated end-to-end but they are code-complete. Chantier 5 will validate via CI.

---

## Phase 4: User Story 3 — macOS non-regression verification (Priority: P1)

**Goal**: prove that the cross-OS refactor has not broken any macOS behavior, by running the full verification battery on the maintainer's macOS machine and comparing against the feature-003 baseline.

**Independent test**: `npm test` reports the same or higher pass count as before, `scripts/real-app-audit.mjs` completes 14 steps, `scripts/verify-hardening.mjs` reports 6/6 checks, the packaged macOS build opens and the canonical journey completes.

- [ ] T023 [US3] Run `npm run rebuild:native:electron` to make sure better-sqlite3 is rebuilt against the Electron ABI (feature 002 known limitation). Then run `node scripts/real-app-audit.mjs` and confirm all 14 steps pass. The Codex invocation must still find the Homebrew-installed binary, confirming the helper's darwin branch matches the pre-feature behavior.
- [ ] T024 [US3] Run `node scripts/verify-hardening.mjs` and confirm all 6 checks pass. The cross-OS refactor must not weaken any feature-002 invariant.
- [ ] T025 [US3] Run `npm run build && npm run package:mac` and confirm the packaged `.app` is produced under `dist-app/mac-arm64/`. Manually launch the `.app` (open it from Finder or via `open`) and click through the seven navigation destinations. Confirm nothing has regressed visually.
- [ ] T026 [US3] Run `./scripts/open-mac-latest.sh` and confirm it still opens the packaged `LinkedIn Poster.app` on macOS, exactly as before. The early-exit gate must only fire on non-Darwin hosts.

**Checkpoint**: macOS is fully non-regressive. The MVP of User Stories 1+2+3 (the three P1 stories) is complete.

---

## Phase 5: User Story 4 — Responsive renderer baseline (Priority: P2)

**Goal**: add a `@media (max-width: 768px)` breakpoint that collapses the 320px sidebar into a stacked top area.

**Independent test**: open the app, resize below 768px, navigate every screen, then resize back to default. No overflow, no missing nav, no layout drift above the breakpoint.

- [ ] T027 [US4] Append a `@media (max-width: 768px)` block at the end of `/Users/philippe/Dev/LinkedIn-poster/app/renderer/src/styles.css` that changes `.shell` from `grid-template-columns: 320px 1fr` to `grid-template-columns: 1fr` and adds `grid-template-rows: auto 1fr`. Reduce `.shell` padding and gap to fit narrow viewports. Compact `.brand` and `.nav-panel` padding. Do NOT touch any existing rule above the breakpoint — all changes live inside the media query block.
- [ ] T028 [US4] Run `npm run dev`, resize the window below 768px via the developer tools viewport simulator, navigate through the seven canonical destinations, confirm the sidebar is stacked above the content and no horizontal overflow occurs. Resize back above 768px and confirm the sidebar-beside-content layout is restored exactly.
- [ ] T029 [US4] Run `npm run build` and inspect `out/renderer/assets/index-*.css` to confirm the new media query block appears in the bundled CSS. Create a commit `feat(004): add responsive baseline media query for narrow viewports`.

**Checkpoint**: the renderer degrades gracefully on narrow windows.

---

## Phase 6: User Story 5 — Cross-platform installation documentation (Priority: P3)

- [ ] T030 [US5] Add a new "Installation cross-platform" section at the end of `/Users/philippe/Dev/LinkedIn-poster/docs/exploitation.md` containing three subsections (macOS, Windows, Linux), each with: prerequisites, install command, development command, test command, packaging command, and expected artifact location. Follow the same French voice as the rest of the document.
- [ ] T031 [US5] In the same section, add an explicit "Limitation de validation" subsection acknowledging that the Windows and Linux builds have not been validated end-to-end in the session that introduced the feature, and pointing to Chantier 5 (CI/CD) for the future GitHub Actions matrix job that will deliver automated cross-OS validation. Create a commit `docs(004): add cross-platform installation guide to exploitation.md`.

**Checkpoint**: documentation reflects the new cross-OS reality.

---

## Phase 7: Polish — final verification and shipping

- [ ] T032 Run `npm audit` one final time on the branch. Confirm zero vulnerabilities (FR-020, SC-006).
- [ ] T033 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. All must pass.
- [ ] T034 Run `node scripts/real-app-audit.mjs` one final time. Confirm 14 steps pass.
- [ ] T035 Run `node scripts/verify-hardening.mjs` one final time. Confirm 6 checks pass (feature 002 posture).
- [ ] T036 Verify the final commit shape: `git log --oneline main..HEAD` should show at most five to six commits (helper + cross-OS infra, responsive, docs, final). Adjust commit messages if any is unclear.
- [ ] T037 Create a final polish commit `chore(004): record final verification and close cross-platform-portability feature` with any trailing updates to research.md noting the as-shipped electron-builder target list and icon strategy.

**Checkpoint**: feature 004 is fully implemented, fully verified on macOS, and ready for the superpowers `finishing-a-development-branch` phase. Windows and Linux end-to-end validation is deferred to Chantier 5 as documented.

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1**: no dependency.
- **Phase 2 (foundational helper)**: depends on Phase 1. Blocks every user story.
- **Phase 3 (US1 + US2)**: depends on Phase 2. The helper must exist and be tested before the runner refactor can rely on it.
- **Phase 4 (US3 verification)**: depends on Phase 3. Can only verify non-regression after the refactor is in place.
- **Phase 5 (US4 responsive)**: depends on Phase 2 (no code collision but same baseline). Can run in parallel with Phase 3 in a multi-contributor setting.
- **Phase 6 (US5 docs)**: depends on Phases 3, 4, 5 because the documentation references what those phases produced.
- **Phase 7 (Polish)**: depends on every previous phase.

### Within each user story

- Tests before implementation (Constitution IV).
- Schemas/helpers before runners.
- Runners before verification.
- Commit after each completed logical unit.

### Parallel opportunities

- **Phase 1**: T003 [P] can run in parallel with T001/T002.
- **Phase 3**: T008/T009 (package.json sections) are in the same file — NOT parallel. T010/T011 are also same-file — NOT parallel with T008/T009. T012/T013 (icon files) are different files — parallel. T014 [P] is a new file. T015/T016/T017 (launcher scripts) are different files — parallel. T022 (commit) is sequential after everything else in the phase.
- **Phase 5**: all sequential.
- **Phase 6**: both tasks touch the same file — sequential.

---

## Parallel example: Phase 3 icon generation

```bash
# Generate placeholder icons in parallel (different files):
Task: "Create resources/icons/icon.ico from source PNG (T012)"
Task: "Create resources/icons/icon.png at 512x512 (T013)"
Task: "Create resources/icons/README.md documenting placeholder strategy (T014)"
Task: "Gate scripts/open-mac-latest.sh on non-Darwin (T015)"
Task: "Gate scripts/build-mac-launcher.mjs on non-Darwin (T016)"
Task: "Gate scripts/mac-launcher-lib.mjs on non-Darwin (T017)"
```

---

## Implementation Strategy

### MVP first (Phases 1 + 2 + 3 + 4)

1. Setup and baseline capture.
2. Foundational helper with TDD.
3. Cross-OS infrastructure (runner refactor, build targets, launcher gating, icons).
4. macOS non-regression verification.

At this point the three P1 user stories are delivered. If shipping pressure is high, this is the minimum viable portability contribution.

### Incremental delivery

5. Responsive breakpoint (US4 P2).
6. Documentation (US5 P3).
7. Polish.

---

## Notes

- `[P]` tasks touch different files and have no incomplete dependencies.
- `[Story]` label maps a task to its user story for traceability. US1 and US2 share many tasks because the code is identical; each task is labeled with the most representative story but serves both.
- Every behavioral change is preceded by a failing test (Constitution IV).
- Commit after each completed logical unit.
- Avoid: weakening macOS tests to make Windows/Linux code paths pass, removing the Codex Homebrew fallback, shipping without placeholder icons (which would break the build on every platform).
