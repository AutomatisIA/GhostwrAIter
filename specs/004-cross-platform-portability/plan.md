# Implementation Plan: Cross-platform portability and responsive renderer baseline

**Branch**: `004-cross-platform-portability` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-cross-platform-portability/spec.md`

## Summary

Unblock Windows and Linux contribution by extending electron-builder with `win` and `linux` targets, adding `package:win` and `package:linux` npm scripts, refactoring the hardcoded Homebrew-only Codex binary detection into a platform-branched helper, making the macOS-only launcher scripts skip gracefully on other operating systems, and adding a single responsive CSS breakpoint that collapses the fixed 320-pixel sidebar below 768 pixels of viewport width. The maintainer cannot validate the Windows and Linux builds end-to-end in this session (macOS host); the guarantee of this feature is that **every automated check on macOS stays green** and the code is ready for chantier 5's CI/CD pipeline to validate the other two platforms.

## Technical Context

**Language/Version**: TypeScript 6.0.2 + Vite 7.3.2 + electron-vite 5.0.0 + Electron 41.2.0. Same toolchain as feature 003.

**Primary dependency added**: none. The spec mandates no new runtime dependency (FR-021). Cross-OS detection uses `process.platform`, `node:child_process` (`spawnSync` already in use) and `node:path`.

**Storage**: no change.

**Testing**: Vitest 4.1.4 for unit tests. Platform-specific code paths are tested by mocking `process.platform` and the `child_process.spawnSync` executor, not by running on three hosts.

**Target Platform**: macOS Apple Silicon today (validated end-to-end via `scripts/real-app-audit.mjs` + `scripts/verify-hardening.mjs`). Windows and Linux code is shipped ready-for-CI but not validated end-to-end in this session per the spec's operational limitation.

**Project Type**: single-process Electron desktop application. Unchanged from feature 003.

**Performance Goals**: no perceivable change. Cross-OS detection adds at most a handful of filesystem probes at Codex availability check time (one-off, not on hot path).

**Constraints**: preserve every invariant from features 002 and 003. No new runtime dependency. No build-time toolchain change. Strict Codex execution doctrine preserved: when no binary is found on any platform, `isAvailable()` returns false and the runner refuses to execute.

**Scale/Scope**: ~10 files touched (`package.json`, `app/main/domains/execution/codex-cli-runner.ts`, 3 mac-launcher scripts, `app/renderer/src/styles.css`, 1 new helper `app/main/domains/execution/find-codex-binary.ts` or similar, 1 new test file, `docs/exploitation.md`, optionally a resources directory for placeholder icons).

## Constitution Check

Evaluated against `.specify/memory/constitution.md` v1.0.0:

| Principle | Status | Notes |
|---|---|---|
| I. Local-First and Confidential by Default | ✅ Pass | Feature makes local execution possible on more operating systems; no remote dependency introduced. |
| II. Workflow Before Prompting | ✅ Pass | No change to the editorial workflow. |
| III. Specialized Skills with Structured I/O | ✅ Pass | No change to skill contracts. The Codex runner's I/O envelope is unchanged; only the path to the binary changes. |
| IV. Test-First Development Is Mandatory | ⚠ Required discipline | Cross-OS detection, launcher-script gating and responsive breakpoint each need a failing test before implementation. Details in the Testing Strategy section below. |
| V. Human Validation Over Autonomous Publishing | ✅ Pass | No change. |
| VI. Simplicity for MVP, Extensibility for the System | ✅ Pass | Adds one detection helper, extends one CSS file with one media query, extends one manifest with two build sections. No new abstraction. |

**Gate result**: pass. Complexity Tracking table empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-cross-platform-portability/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — 5 decisions
├── data-model.md        # Skipped (no new entity)
├── contracts/
│   └── codex-binary-detection.md    # The one internal contract worth documenting
├── quickstart.md        # Phase 1 output — how to install on each OS
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output (later)
```

### Source Code (repository root)

Files **touched** by this feature:

```text
package.json
  — build.win: NSIS + portable target with icon
  — build.linux: AppImage + deb target with icon
  — scripts: package:win, package:linux added

app/main/domains/execution/find-codex-binary.ts   (NEW)
  — findCodexBinary(env?, platform?) → string | null
  — platform-branched lookup with PATH + conventional dirs
  — unit-testable with mocked platform and filesystem

app/main/domains/execution/codex-cli-runner.ts
  — buildCodexCliPath() refactored to call findCodexBinary()
  — executor still uses spawnSync, no change to the shape
  — isAvailable() path search via the new helper

scripts/open-mac-latest.sh
  — early-exit with advisory on non-Darwin
  — keep the existing macOS behavior intact

scripts/build-mac-launcher.mjs
  — early-exit with advisory on non-darwin
  — keep existing macOS behavior

scripts/mac-launcher-lib.mjs
  — host-OS detection and graceful skip

app/renderer/src/styles.css
  — @media (max-width: 768px) block
  — sidebar column collapse to full-width stacked
  — breakpoint only, no mobile-first redesign

resources/icons/
  — icon.png (512x512 placeholder) for Linux AppImage/deb
  — icon.ico (multi-resolution) for Windows NSIS
  — existing macOS .icns kept or placeholder-generated
  — README.md explaining these are placeholders and the designer will replace them

docs/exploitation.md
  — new "Installation cross-platform" section with macOS, Windows, Linux
  — acknowledgement that Windows/Linux builds are CI-validated in chantier 5

tests/unit/find-codex-binary.test.ts   (NEW)
  — 6-10 cases mocking platform + filesystem
  — darwin: PATH + Homebrew fallbacks (preserves existing behavior)
  — linux: PATH + /usr/local/bin + /usr/bin + $HOME/.local/bin
  — win32: PATH + %ProgramFiles% + %LOCALAPPDATA%\Programs, codex.exe extension
  — fallback to null when nothing found
```

Files **NOT touched**:

- `app/main/index.ts` — already uses `process.platform !== "darwin"` correctly for quit-on-all-closed; no change needed.
- `app/main/workspace/workspace.service.ts` — uses `path.join` and `path.resolve` already; no `process.cwd()` on bundled-asset paths.
- Any file under `app/main/ipc/` — IPC validation from feature 003 is unchanged.
- Any Codex skill prompt — feature 003.5 scope.
- Any React component — renderer logic unchanged, only one CSS file is touched.

**Structure decision**: one new module (`find-codex-binary.ts`) because the platform-detection logic is a well-defined unit that deserves its own file and its own test. Everything else stays in its current file.

## Testing Strategy

TDD discipline (Constitution IV). Order:

1. **Write `tests/unit/find-codex-binary.test.ts`** with cases for each of `darwin`, `linux`, `win32`, and "no binary found anywhere". Each case stubs `process.platform`, the PATH env var, and a filesystem existence check. Observe the test file failing because the helper does not exist.
2. **Create `app/main/domains/execution/find-codex-binary.ts`** with the helper that the tests expect. Observe tests pass.
3. **Extend `tests/unit/codex-cli-runner.test.ts`** with one case that asserts `buildCodexCliPath()` on the current platform (Darwin) still produces the same joined PATH string as before, to protect against regression of the existing macOS behavior. Observe failing if the refactor has broken it. Refactor `codex-cli-runner.ts` to call `findCodexBinary()` from the helper until the case passes.
4. **For the macOS launcher scripts**: the gating logic is a 3-line change in each file. A dedicated unit test would be heavier than the code itself; the verification is done by running the script on macOS (existing behavior unchanged) and by manual inspection of the early-exit branch. A small vitest case in `tests/unit/mac-launcher-lib.test.ts` (which already exists) is extended to assert the early-exit path when `process.platform` is mocked to "linux".
5. **For the responsive breakpoint**: the verification is visual and semi-manual. A lightweight snapshot or assertion on the generated CSS (via an integration check against `out/renderer/assets/index-*.css`) is sufficient for the automated side. Manual verification uses `npm run dev` + dev tools viewport resize.
6. **Macro verification**: after every implementation step, run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `scripts/real-app-audit.mjs`, `scripts/verify-hardening.mjs`. Every macOS check must stay green throughout.

## Risks and Mitigations

### Risk 1 — Native better-sqlite3 rebuild on non-macOS

**Concern**: `npm run rebuild:native:electron` runs `electron-rebuild` which compiles better-sqlite3 against the current Electron target using the host toolchain (node-gyp). On Windows, this requires Visual Studio Build Tools; on Linux, it requires gcc/g++ and python. On macOS, Xcode command-line tools are needed. These are outside the project's scope but need to be documented.

**Mitigation**: the new "Installation cross-platform" section in `docs/exploitation.md` lists the toolchain prerequisite for each OS explicitly. better-sqlite3 typically ships prebuilt binaries for common platforms, so the rebuild may not even fire on a fresh install; this is noted as "usually automatic" in the docs.

### Risk 2 — electron-builder icon reference errors

**Concern**: electron-builder fails the build if the icon file referenced in `package.json` does not exist. Placeholder icons must be committed to avoid a broken-on-clone state.

**Mitigation**: commit placeholder icon files under `resources/icons/`. Use simple generated PNG/ICO files (via `sips` or `iconutil` on macOS during this session). Document in a `resources/icons/README.md` that these are placeholders and should be replaced by a designer in a later chantier.

### Risk 3 — Responsive CSS breaking the existing desktop layout

**Concern**: media queries can silently change the desktop layout if the specificity is wrong. A careless breakpoint might break the 7-screen canonical journey above 768px as well.

**Mitigation**: the breakpoint is scoped to `@media (max-width: 768px)` only, which only applies below that width. The desktop layout (above 768px) is left untouched. After implementation, the real-app-audit (which runs the app at default window size 1440x960) verifies the desktop layout is unchanged.

### Risk 4 — Codex binary detection misses a macOS corner case

**Concern**: the refactor from hardcoded paths to `findCodexBinary()` could miss a macOS path the current code covers.

**Mitigation**: the unit test for darwin mode asserts the exact list of paths the current code produces (`[PATH entries, "/opt/homebrew/bin", "/usr/local/bin"]`). The refactored helper must produce the same result on darwin.

### Risk 5 — Windows-specific path separators in test assertions

**Concern**: when mocking `process.platform === "win32"`, the helper must join paths with backslashes on Windows but the test runs on macOS. Test assertions must use `path.join` (which on macOS returns forward slashes) to avoid false assertion failures.

**Mitigation**: tests use the Node `path` module's platform-aware joiners. The helper itself uses `path.join` so it produces the host's separator, which is correct at runtime but may look "wrong" in a macOS-hosted test of win32 branches. Document this in the test comments and assert on the path segments rather than the full joined string.

## Rollout Plan

Single work unit on the `004-cross-platform-portability` branch. One commit per concern: helper + tests, runner refactor, launcher scripts gating, electron-builder config + icons, responsive CSS, documentation. Final polish commit. No partial rollout, no feature flag.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(empty)* | *(empty)* | *(empty)* |
