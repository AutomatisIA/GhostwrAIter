---

description: "Task list for feature 005 — CI/CD multi-OS pipeline & open-source metadata"
---

# Tasks: CI/CD Multi-OS Pipeline & Open-Source Publication Metadata

**Input**: Design documents from `/specs/005-ci-cd-publish/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, contracts/workflows.md, contracts/metadata.md, quickstart.md

**Tests**: TDD is mandatory per Constitution IV. Every user story's test tasks MUST be completed and observed failing before its implementation tasks begin.

**Organization**: Tasks are grouped by user story. US1 and US2 can be executed in parallel because they touch different test files. US3 depends on US2 (same test file), and US4 + US5 depend on US1 (same test file).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 map to the user stories in spec.md

## Path Conventions

This is an Electron + TypeScript + Vitest project. Paths are relative to repo root `/Users/philippe/Dev/LinkedIn-Poster/`.

- Workflows: `.github/workflows/`
- Community metadata: repo root + `.github/`
- Tests: `tests/unit/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the YAML parser dependency needed by both new test files.

- [ ] T001 Verify working tree is on branch `005-ci-cd-publish`, specs committed, `app/`/`tests/` clean. Run `git status` and confirm only the `specs/005-ci-cd-publish/` subtree is untracked. If anything else differs, stop and reconcile before proceeding.
- [ ] T002 Install the `yaml` package as a devDependency in `package.json` via `npm install --save-dev yaml@^2`. Commit the `package.json` + `package-lock.json` diff as a single atomic change. This is the only new runtime dependency for feature 005 — needed by the two new test files to parse committed `.yml` files.
- [ ] T002b Create `.gitattributes` at repo root (per FR-028) containing exactly two lines: `* text=auto eol=lf` as the default for all text files, and `*.bat text eol=crlf` as the exception for Windows batch files. This normalizes line endings so the Windows CI runner cannot silently introduce CRLF drift that would fail snapshot comparisons on macOS and Linux. No other patterns — keep it minimal.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the two empty test files with their shared helpers so that every user story can extend them independently.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — every US test task assumes these files exist.

- [ ] T003 [P] Create `tests/unit/ci-workflows.test.ts` containing only a top-level `import { parse } from "yaml"` and `import { readFileSync } from "node:fs"`, a `loadWorkflow(name: string)` helper that reads `.github/workflows/${name}` and returns the parsed object, and an empty `describe("github actions workflows", () => { it.todo("contract filled in per user story"); })` block. No real assertions yet.
- [ ] T004 [P] Create `tests/unit/oss-metadata.test.ts` containing `import { existsSync, readFileSync } from "node:fs"`, `import { parse } from "yaml"`, a `readFile(path: string)` helper, and an empty `describe("open-source metadata", () => { it.todo("contract filled in per user story"); })` block. No real assertions yet.
- [ ] T005 Run `npm test -- ci-workflows oss-metadata` and confirm both files are picked up by Vitest with passing `todo` markers (no failures, no errors). This is the green baseline that every TDD cycle below will diverge from.

**Checkpoint**: Foundation ready — user stories can now proceed. US1 and US2 can run in parallel; US3, US4, US5 are serialized by test-file sharing.

---

## Phase 3: User Story 1 — Continuous validation across all supported operating systems (Priority: P1) 🎯 MVP

**Goal**: A committed `.github/workflows/ci.yml` that runs the full gate (typecheck, lint, test, build, audit, + hardening on macOS) on macOS, Ubuntu, and Windows runners for every push and PR to `main`.

**Independent Test**: Run `tests/unit/ci-workflows.test.ts` against the committed `ci.yml` and observe all CI-specific assertions green. After merge, observe the first workflow run on `main` producing three parallel OS jobs.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, observe them FAIL before implementing `ci.yml`.

- [ ] T006 [US1] Extend `tests/unit/ci-workflows.test.ts` with a `describe("ci.yml", ...)` block that loads the workflow via `loadWorkflow("ci.yml")` and asserts every invariant from `specs/005-ci-cd-publish/contracts/workflows.md` §`ci.yml`: triggers are `push.branches: [main]` + `pull_request.branches: [main]` only; exactly one job; `strategy.matrix.os` is exactly `["macos-latest", "ubuntu-latest", "windows-latest"]` (any order); `strategy.fail-fast === false`; `runs-on: ${{ matrix.os }}`; ordered steps contain `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: '20'` and `cache: 'npm'`, then `npm ci`, `npm run rebuild:native:electron`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --audit-level=high --omit=dev`; the `verify-hardening` step exists and is gated by `if: runner.os == 'macOS'`; no step references `secrets.` (whole file scan); no occurrence of the literal `continue-on-error`; top-level `permissions` block with `contents: read`.
- [ ] T007 [US1] Run `npm test -- ci-workflows` and confirm the new `describe("ci.yml")` block fails because the YAML file does not exist yet. Record the failure output (paste the relevant summary into the commit message for this task).

### Implementation for User Story 1

- [ ] T008 [US1] Create `.github/workflows/ci.yml` implementing every invariant asserted by T006. Use `actions/checkout@v4`, `actions/setup-node@v4` (node 20, cache npm), one job with the 3-OS matrix and `fail-fast: false`, the 9-step ordered command sequence, the conditional `verify-hardening` step gated on `runner.os == 'macOS'`, top-level `permissions: contents: read`, and nothing else. No `continue-on-error`, no non-whitelisted actions, no secrets beyond `GITHUB_TOKEN` (not needed for this workflow).
- [ ] T009 [US1] Run `npm test -- ci-workflows` and confirm the `describe("ci.yml")` block is now green. Every other test file in the suite MUST still pass — run `npm test` in full to confirm no regression.

**Checkpoint**: User Story 1 is independently testable via the new unit test. End-to-end CI validation on real runners happens during Phase Polish after merge.

---

## Phase 4: User Story 2 — Repository presents all metadata required of a public MIT open-source project (Priority: P1)

**Goal**: LICENSE, README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md at repo root; bug_report.md, feature_request.md, config.yml under `.github/ISSUE_TEMPLATE/`; PULL_REQUEST_TEMPLATE.md under `.github/`. Each satisfies the contract in `contracts/metadata.md`.

**Independent Test**: Run `tests/unit/oss-metadata.test.ts` and observe all metadata-specific assertions green. After push, GitHub's community profile checker reports all items green.

**⚠️ Note**: US2 can start in parallel with US1 (different test files). US3 cannot start until US2 is complete (same test file).

### Tests for User Story 2 ⚠️

- [ ] T010 [US2] Extend `tests/unit/oss-metadata.test.ts` with `describe()` blocks for every file in `contracts/metadata.md` EXCEPT `.github/dependabot.yml` (reserved for US3): LICENSE, README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, and `.gitattributes` (per FR-028). Each block asserts every invariant listed in the contract (presence, minimum length, required substrings, front-matter fields). When asserting the `labels` front-matter field of bug_report.md and feature_request.md, accept BOTH the scalar form (`labels: bug`) and the array form (`labels: [bug]`) — read the parsed front matter and check that the string `bug` (or `enhancement`) appears anywhere in the labels value, whether it is a string or an array. The `.gitattributes` assertion checks that the file exists and contains the literal substrings `* text=auto eol=lf` and `*.bat text eol=crlf`.
- [ ] T011 [US2] Run `npm test -- oss-metadata` and confirm all US2 describe blocks fail because the files do not exist yet. Capture the failure summary.

### Implementation for User Story 2

- [ ] T012 [P] [US2] Create `LICENSE` at repo root. Exact copyright line `Copyright (c) 2026 Philippe Cohen <contact@AutomatisIA.fr>`. Standard MIT License text (permission paragraph + warranty disclaimer). No extra content.
- [ ] T013 [P] [US2] Create `README.md` at repo root. Top heading `# LinkedIn Poster`, one-paragraph description mentioning "local-first Electron editorial cockpit for LinkedIn", `## Stack` section listing Electron/TypeScript/React/Vite/SQLite, `## Prerequisites` section mentioning Node.js 20, `## Installation` section with `### macOS`, `### Windows`, `### Linux` subsections each showing `git clone` + `npm ci` + `npm run dev` minimal path, a link to `docs/exploitation.md` for operational depth, `## License` section stating MIT with link to `./LICENSE`, `## Contributing` section linking to `./CONTRIBUTING.md`. No placeholders, no emojis unrequested.
- [ ] T014 [P] [US2] Create `CONTRIBUTING.md` at repo root. Sections covering: Getting started (clone + `npm ci`), Running tests (`npm test`), Commit convention (Conventional Commits, cite the format), Test-Driven Development (reference Constitution IV and point readers at `.specify/memory/constitution.md`), Pull request process, Spec-kit workflow (link to `specs/` and briefly describe the specify→clarify→plan→tasks→analyze→implement flow).
- [ ] T015 [P] [US2] Create `CODE_OF_CONDUCT.md` at repo root. Use the exact Contributor Covenant v2.1 text from `https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md`. Replace any template placeholder for contact with `contact@AutomatisIA.fr`. The string `Contributor Covenant` and `version 2.1` (or `v2.1`) MUST appear literally.
- [ ] T016 [P] [US2] Create `SECURITY.md` at repo root. Include `## Reporting a Vulnerability` section naming `contact@AutomatisIA.fr` and GitHub Security Advisories as private channels, an explicit response-time commitment (e.g., "acknowledged within 72 hours"), a `## Current Security Posture` section summarizing the hardening from feature 002 (sandbox + contextIsolation + CSP + navigation guards + workspace path validation), and a link to `docs/exploitation.md` for the known-limitations list.
- [ ] T017 [P] [US2] Create `.github/ISSUE_TEMPLATE/bug_report.md` with YAML front matter `name: Bug report`, `about: Report a bug so we can fix it`, `labels: bug`, and body sections: "Operating system", "Application version", "Steps to reproduce", "Expected behavior", "Actual behavior", "Logs".
- [ ] T018 [P] [US2] Create `.github/ISSUE_TEMPLATE/feature_request.md` with YAML front matter `name: Feature request`, `about: Propose an improvement`, `labels: enhancement`, and body sections: "Use case", "Proposed solution", "Alternatives considered", "Additional context".
- [ ] T019 [P] [US2] Create `.github/ISSUE_TEMPLATE/config.yml` with `blank_issues_enabled: false` and a `contact_links` entry pointing at `SECURITY.md` for security reports. This forces contributors to pick a template and routes security issues privately.
- [ ] T020 [P] [US2] Create `.github/PULL_REQUEST_TEMPLATE.md` with a markdown checklist covering: Description of the change, Linked user story / FR, Tests added, Screenshots (or explicit "N/A"), Manual verification performed, "No regression on macOS (`scripts/real-app-audit.mjs` + `scripts/verify-hardening.mjs`)".
- [ ] T021 [US2] Run `npm test -- oss-metadata` and confirm every US2 describe block is now green. The `dependabot.yml` block remains failing (T010 explicitly excluded it) — that is expected until US3.

**Checkpoint**: User Story 2 is independently testable. A visitor arriving at the repository sees all community-profile files.

---

## Phase 5: User Story 3 — Automated dependency refresh without manual CVE hunting (Priority: P2)

**Goal**: `.github/dependabot.yml` configured per D7 (two npm groups + monthly github-actions) produces weekly grouped PRs.

**Dependency**: US2 must be complete (same test file).

### Tests for User Story 3 ⚠️

- [ ] T022 [US3] Extend `tests/unit/oss-metadata.test.ts` with a `describe(".github/dependabot.yml", ...)` block that parses the YAML file and asserts: `version === 2`; exactly two entries under `updates`; first entry has `package-ecosystem: "npm"`, `directory: "/"`, `schedule.interval: "weekly"`, `labels` includes `"dependencies"`, `ignore` contains a wildcard major-ignore entry, `groups` has exactly two groups named `production-dependencies` and `development-dependencies` with correct `dependency-type` + `update-types: ["minor", "patch"]`; second entry has `package-ecosystem: "github-actions"`, `directory: "/"`, `schedule.interval: "monthly"`, `labels` includes `"dependencies"`, `ignore` contains a wildcard major-ignore entry.
- [ ] T023 [US3] Run `npm test -- oss-metadata` and confirm the new `dependabot.yml` block fails because the file does not exist yet.

### Implementation for User Story 3

- [ ] T024 [US3] Create `.github/dependabot.yml` implementing every invariant asserted by T022. Include comments explaining the grouping rationale (D7). Ensure the file parses as valid YAML via `node -e "require('yaml').parse(require('fs').readFileSync('.github/dependabot.yml', 'utf-8'))"` before committing.
- [ ] T025 [US3] Run `npm test -- oss-metadata` and confirm every block is now green.

**Checkpoint**: User Story 3 is independently testable. Automated dependency monitoring configuration is in place; actual Dependabot runs are observed post-merge during Phase Polish.

---

## Phase 6: User Story 4 — Packaged artifacts for every supported OS produced from a single tag (Priority: P2)

**Goal**: `.github/workflows/package.yml` triggered by tag push matching `v*` produces `.app` on macOS, NSIS + portable on Windows, AppImage + `.deb` on Linux, uploaded as GitHub Actions artifacts.

**Dependency**: US1 must be complete (same test file).

### Tests for User Story 4 ⚠️

- [ ] T026 [US4] Extend `tests/unit/ci-workflows.test.ts` with a `describe("package.yml", ...)` block that asserts every invariant from `contracts/workflows.md` §`package.yml`: trigger is `push.tags` matching `v*` only; no `workflow_dispatch`, no branches; 3-OS matrix with `fail-fast: false`; ordered steps checkout → setup-node 20 → `npm ci` → `npm run rebuild:native:electron` → conditional packaging step per OS (`npm run package:mac` / `npm run package:win` / `npm run package:linux`) → `actions/upload-artifact@v4` with name `linkedin-poster-${{ github.ref_name }}-${{ matrix.os }}` and `if-no-files-found: error`; no `secrets.*` references; no `continue-on-error`; no code-signing keywords (`codesign`, `notarize`, `CSC_`, `APPLE_`, `WIN_CSC_`); top-level `permissions: contents: read`.
- [ ] T027 [US4] Run `npm test -- ci-workflows` and confirm the new `describe("package.yml")` block fails because the YAML file does not exist.

### Implementation for User Story 4

- [ ] T028 [US4] Create `.github/workflows/package.yml` implementing every invariant asserted by T026. Use `if: matrix.os == 'macos-latest'` / `'windows-latest'` / `'ubuntu-latest'` to gate the three packaging commands. Ensure `if-no-files-found: error` on the upload step so silent packaging failures are caught immediately.
- [ ] T029 [US4] Run `npm test -- ci-workflows` and confirm both `describe("ci.yml")` and `describe("package.yml")` blocks are green. Run the full `npm test` to confirm no regression.

**Checkpoint**: User Story 4 is testable via unit test. Actual tag-triggered packaging runs are verified post-merge in Phase Polish.

---

## Phase 7: User Story 5 — One-click draft release ready for human review (Priority: P3)

**Goal**: `.github/workflows/release.yml` triggered by `workflow_run` (successful `package.yml`) or manual `workflow_dispatch` produces a draft GitHub Release with all artifacts attached. Never publishes automatically.

**Dependency**: US4 must be complete (same test file + consumes package.yml artifacts).

### Tests for User Story 5 ⚠️

- [ ] T030 [US5] Extend `tests/unit/ci-workflows.test.ts` with a `describe("release.yml", ...)` block asserting: trigger is `workflow_run` referencing `package.yml` with `types: [completed]` AND `workflow_dispatch` with at least one input (`tag`); NO `push.tags` trigger anywhere in the file; one job with `runs-on: ubuntu-latest`; for the `workflow_run` path a condition `if: github.event.workflow_run.conclusion == 'success'`; steps include `actions/checkout@v4`, `actions/download-artifact@v4`, and a release step (`softprops/action-gh-release@v2` or `actions/create-release@v1`) whose configuration includes `draft: true` literally; the only secret referenced anywhere in the file is `secrets.GITHUB_TOKEN`; top-level `permissions: contents: write`; no `continue-on-error`.
- [ ] T031 [US5] Run `npm test -- ci-workflows` and confirm the new `describe("release.yml")` block fails because the YAML file does not exist.

### Implementation for User Story 5

- [ ] T032 [US5] Create `.github/workflows/release.yml` implementing every invariant asserted by T030. Use `softprops/action-gh-release@v2` with `draft: true`, `files:` pointing at the downloaded artifacts, `tag_name` derived from `github.event.workflow_run.head_branch` on the workflow_run path or `github.event.inputs.tag` on the workflow_dispatch path. Handle both trigger paths with appropriate `if` guards.
- [ ] T033 [US5] Run `npm test -- ci-workflows` and confirm all three workflow describe blocks are green. Run the full `npm test` to confirm no regression.

**Checkpoint**: All user stories are independently testable via unit tests. Workflow runtime behavior is validated post-merge in Phase Polish.

---

## Phase 8: Polish & Cross-Cutting Verification

**Purpose**: Validate the complete feature against every local gate and the quickstart checklist.

- [ ] T034 Run `npm run rebuild:native:electron` to ensure `better-sqlite3` targets the Electron ABI, then run in sequence: `npm run typecheck`, `npm run lint`, `npm test`. Confirm the final test count is 215 + N where N is the exact count added by T006, T010, T022, T026, T030 (record N in the verification log).
- [ ] T035 Run `npm run build` and confirm it produces a clean build with no errors.
- [ ] T036 Run `npm audit --audit-level=high --omit=dev` and confirm 0 high-or-critical vulnerabilities. This is the canonical CI gate from Clarification Q3 — if it fails locally, it will fail in CI too.
- [ ] T037 Run `npm run real-app-audit` and confirm all 14 steps pass (Chantier 4 / feature 004 gate).
- [ ] T038 Run `npm run verify-hardening` and confirm all 6 checks pass (Chantier 1 / feature 002 gate).
- [ ] T039 Execute `specs/005-ci-cd-publish/quickstart.md` Step 1 locally: `npm test -- ci-workflows oss-metadata`. All tests must be green.
- [ ] T040 Review the entire feature diff (`git diff main --stat`) and confirm: no changes to `app/`, no changes to `tests/unit/*` except the two new files, no changes to `package.json` except adding the `yaml` devDependency, all new files match the contracts in `specs/005-ci-cd-publish/contracts/`.
- [ ] T041 Commit the feature as a single logical squash or as granular per-phase commits. Use commit messages prefixed `feat(005): ...` per Conventional Commits (documented in CONTRIBUTING.md). Do NOT push to `main` yet — merge + push is a manual post-implementation step that executes quickstart.md Steps 2+.
- [ ] T042 After merge to main, execute quickstart.md Steps 2 through 11 (first CI run observation, deliberate-failure test, package workflow tag test, release workflow dispatch test, branch protection configuration, community profile verification, 60-second README test, Dependabot trigger, final regression gate). Record outcomes in the commit log or a follow-up verification note.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies — starts immediately.
- **Phase 2 Foundational**: Depends on Phase 1 completion. BLOCKS all user stories.
- **Phase 3 US1** and **Phase 4 US2**: Both depend on Phase 2. Can proceed in PARALLEL (different test files: `ci-workflows.test.ts` vs `oss-metadata.test.ts`).
- **Phase 5 US3**: Depends on Phase 4 US2 being complete (same test file `oss-metadata.test.ts`).
- **Phase 6 US4**: Depends on Phase 3 US1 being complete (same test file `ci-workflows.test.ts`).
- **Phase 7 US5**: Depends on Phase 6 US4 being complete (same test file + consumes `package.yml` semantics).
- **Phase 8 Polish**: Depends on every previous phase.

### Within Each User Story

- TDD ordering is strict: T00X-test → observe failure → T00Y-implementation → observe green.
- Test tasks that touch the same test file cannot be parallelized between stories (US1/US4/US5 share `ci-workflows.test.ts`, US2/US3 share `oss-metadata.test.ts`).
- Implementation tasks creating different files (T012–T020 in US2) ARE parallelizable and marked [P].

### Parallel Opportunities

- **US1 and US2 in parallel**: two contributors (or two spec-kit agent runs) can work simultaneously on US1 and US2 without any file conflict.
- **Within US2**: T012 through T020 create nine different files and are all marked [P].
- **Phase 1**: T001 and T002 are strictly sequential (T002 depends on the clean state verified by T001).
- **Phase 2**: T003 and T004 are [P] (different files).

---

## Parallel Example — US1 and US2 concurrent execution

```bash
# After Phase 2 is green:

# Agent A picks up US1 test task
Agent A: T006 — extend ci-workflows.test.ts with ci.yml describe block
Agent A: T007 — observe failure
Agent A: T008 — create .github/workflows/ci.yml
Agent A: T009 — observe green

# Agent B picks up US2 test task (in parallel)
Agent B: T010 — extend oss-metadata.test.ts with US2 describe blocks
Agent B: T011 — observe failure
Agent B: T012..T020 — create metadata files [all parallelizable within this batch]
Agent B: T021 — observe green
```

---

## Parallel Example — Within US2

```bash
# After T010 and T011 observe failure:

Task: "Create LICENSE at repo root (T012)"
Task: "Create README.md at repo root (T013)"
Task: "Create CONTRIBUTING.md at repo root (T014)"
Task: "Create CODE_OF_CONDUCT.md at repo root (T015)"
Task: "Create SECURITY.md at repo root (T016)"
Task: "Create .github/ISSUE_TEMPLATE/bug_report.md (T017)"
Task: "Create .github/ISSUE_TEMPLATE/feature_request.md (T018)"
Task: "Create .github/ISSUE_TEMPLATE/config.yml (T019)"
Task: "Create .github/PULL_REQUEST_TEMPLATE.md (T020)"

# All 9 tasks can run simultaneously — different files, no ordering constraint.
```

---

## Implementation Strategy

### MVP First (US1 + US2 — both P1)

1. Phase 1 Setup (T001, T002)
2. Phase 2 Foundational (T003, T004, T005)
3. US1 (T006–T009) and US2 (T010–T021) in parallel
4. **STOP and VALIDATE**: `npm test` green, new files exist, community profile would pass GitHub's checker if pushed.
5. This is the minimum publishable state: the repository gates every PR on 3 OS and meets GitHub's community standards.

### Incremental Delivery

1. MVP (US1 + US2) → publishable.
2. US3 (Dependabot) → automates dependency CVE detection.
3. US4 (package.yml) → enables binary distribution from tags.
4. US5 (release.yml) → one-click draft releases.
5. Polish → full regression gate + quickstart validation + merge + CI observation.

### Single-Contributor Sequential Path

For a single contributor executing sequentially (no parallelism):

1. T001 → T002 → T003 → T004 → T005
2. T006 → T007 → T008 → T009 (US1)
3. T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 (US2)
4. T022 → T023 → T024 → T025 (US3)
5. T026 → T027 → T028 → T029 (US4)
6. T030 → T031 → T032 → T033 (US5)
7. T034 → T035 → T036 → T037 → T038 → T039 → T040 → T041 → T042 (Polish)

Total: 42 tasks.

---

## Notes

- **[P] tasks** = different files, no ordering dependency with other [P] tasks in the same batch.
- **[Story] label** maps every task to its user story for traceability.
- **TDD gate** (Constitution IV): every implementation task must be preceded by a test task AND an observed-failure task.
- **File-sharing constraint**: the two test files are the only non-trivial serialization points. Plan parallelism around them.
- **No changes to `app/`**: this feature is infrastructure-only. Any task that touches `app/` source code is out of scope and must be rejected.
- **No secrets**: every workflow contract explicitly excludes secrets except `GITHUB_TOKEN`. Adding a secret requires a spec amendment.
- Commit after each phase or logical group. Never commit with failing tests.
