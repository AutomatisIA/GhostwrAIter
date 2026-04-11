---

description: "Task list for feature 006 — editorial quality evaluation infrastructure"
---

# Tasks: Editorial Quality Evaluation Infrastructure

**Input**: Design documents from `/specs/006-editorial-quality-evaluation/`
**Prerequisites**: plan.md, spec.md (5 clarifications integrated), research.md (D1–D9), data-model.md, contracts/{skill-prompt-loader,editorial-doctrine,grading-grid,eval-report}.md, quickstart.md

**Tests**: TDD is mandatory per Constitution IV. Every test task is followed by an observation-of-failure task before the corresponding implementation begins.

**Organization**: Tasks are grouped by user story. US1 (prompt extraction) and US2 (bench harness with grading grid) are both P1; US2's unit tests for the doctrine parser and grader are independent of US1, but the bench wiring (the script that actually invokes skills) depends on US1 because it uses the runner. US3 (playbook) is P2.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1/US2/US3 maps to user stories from spec.md
- All paths are relative to repo root `/Users/philippe/Dev/LinkedIn-Poster/`

## Path Conventions

- Runner + new modules: `app/main/domains/execution/`
- Skill prompt files: `skills/linkedin-<name>/SKILL.md`
- Bench: `scripts/eval-editorial-quality.mjs` + `scripts/eval-editorial-fixtures.mjs` + `scripts/eval-editorial-grader.mjs`
- Doctrine: `docs/editorial-doctrine.md`
- Playbook: `docs/editorial-iteration-playbook.md`
- Tests: `tests/unit/`
- Reports: `dist-eval/` (gitignored)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch state verification + gitignore for the report output directory.

- [X] T001 Verify working tree is on branch `006-editorial-quality-evaluation`. Run `git status` and confirm only the `specs/006-editorial-quality-evaluation/` subtree is untracked. Stop and reconcile if anything else differs. The CLAUDE.md modification from `/speckit-plan` is expected and counts as part of the feature.
- [X] T002 Add `dist-eval/` to `.gitignore` so evaluation reports never enter the repository. The line goes after the existing build-output entries (`dist-electron/`, `out/`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nothing is strictly foundational for both user stories at the same time. US1 and US2 are mostly independent at the unit-test level. The "foundational" work here is the CLAUDE.md context update produced by `/speckit-plan` (already done) and the gitignore line in T002. No further blocking work.

**⚠️ CRITICAL**: Do not skip T002 — without it, accidentally committing a `dist-eval/eval-report-*.json` file would violate the "no large generated artifacts in git" convention.

**Checkpoint**: Foundation ready. US1 and US2 can both start. Recommend executing US1 first because US2's bench-wiring task depends on the loader being in place; the doctrine and grader tasks of US2 can run in parallel with US1 once the loader is at least implemented.

---

## Phase 3: User Story 1 — Edit a Codex skill prompt without recompiling (Priority: P1) 🎯 MVP unblocker

**Goal**: Migrate the eight inline Codex prompts from `codex-cli-runner.ts:buildSkillPrompt()` to `skills/linkedin-<name>/SKILL.md` files, expose a `SkillPromptLoader` injectable on the runner, and verify that editing a `SKILL.md` takes effect on the very next invocation without recompiling Electron.

**Independent Test**: Run `tests/unit/skill-prompt-loader.test.ts` and `tests/unit/codex-cli-runner.test.ts`. Both must pass. The runner test passes because the migrated prompt content is byte-for-byte identical to today's inline content (FR-002).

### Tests for User Story 1 ⚠️

> Write these tests FIRST. Observe failure before any production code.

- [X] T003 [US1] Create `tests/unit/skill-prompt-loader.test.ts` containing the 9 cases listed in `contracts/skill-prompt-loader.md` §"Test fixtures expected": (1) valid SKILL.md returns trimmed prompt body, (2) missing file throws `SkillPromptNotFoundError`, (3) missing `## Prompt` section throws same, (4) empty whitespace body throws same, (5) two-reads-after-edit returns new content, (6) sub-headings inside prompt are part of returned body, (7) multi-section file returns only the prompt body, (8) path-traversal `skillName` throws a generic error, (9) **FR-006 sanity loop** — `it.each([...8 skill names from FR-001])` iterates over the eight known skill names, calls `createDefaultSkillPromptLoader().loadPrompt(skillName)` against the real repo, and asserts the returned string is non-empty. Cases 1-8 use `mkdtempSync` and synthetic markdown for filesystem isolation; case 9 reads the real `skills/linkedin-<name>/SKILL.md` files.
- [X] T004 [US1] Run `npm test -- skill-prompt-loader` and confirm every test fails (the module does not exist yet). Capture the failure summary.

### Loader implementation

- [X] T005 [US1] Create `app/main/domains/execution/skill-prompt-loader.ts` implementing the contract from `contracts/skill-prompt-loader.md`. Export `type SkillPromptLoader`, `class SkillPromptNotFoundError`, and `function createDefaultSkillPromptLoader(skillsRoot?)`. The loader reads `${skillsRoot}/${skillName}/SKILL.md` on every call (no cache), extracts the body of the `## Prompt` section, trims it, validates non-empty, and returns it. Reject path-traversal characters in `skillName` with a generic Error. The default `skillsRoot` resolves to the repo's `skills/` directory via `path.resolve(__dirname, "..", "..", "..", "..", "skills")`.
- [X] T006 [US1] Run `npm test -- skill-prompt-loader` and confirm all 8 cases now pass.

### Migration of the 8 inline prompts

- [X] T007 [P] [US1] Append a `## Prompt` section to `skills/linkedin-strategy-foundation/SKILL.md`. The body MUST be byte-for-byte identical to the string returned by `case "linkedin-strategy-foundation"` in `app/main/domains/execution/codex-cli-runner.ts:buildSkillPrompt()`. Preserve the existing `# Title`, `## Purpose`, `## Inputs`, `## Outputs` sections — append the new section at the end.
- [X] T008 [P] [US1] Same as T007 for `skills/linkedin-topic-generator/SKILL.md` against `case "linkedin-topic-generator"`.
- [X] T009 [P] [US1] Same as T007 for `skills/linkedin-structure-selector/SKILL.md` against `case "linkedin-structure-selector"`.
- [X] T010 [P] [US1] Same as T007 for `skills/linkedin-hook-engine/SKILL.md` against `case "linkedin-hook-engine"`.
- [X] T011 [P] [US1] Same as T007 for `skills/linkedin-post-writer/SKILL.md` against `case "linkedin-post-writer"`.
- [X] T012 [P] [US1] Same as T007 for `skills/linkedin-post-editor/SKILL.md` against `case "linkedin-post-editor"`.
- [X] T013 [P] [US1] Same as T007 for `skills/linkedin-repurpose/SKILL.md` against `case "linkedin-repurpose"`.
- [X] T014 [P] [US1] Same as T007 for `skills/linkedin-news-to-post/SKILL.md` against `case "linkedin-news-to-post"`.

### Runner refactor

- [X] T015 [US1] Modify `app/main/domains/execution/codex-cli-runner.ts`: (a) import `SkillPromptLoader` and `createDefaultSkillPromptLoader` from the new loader module, (b) extend the `CodexCliRunner` constructor to accept a third parameter `promptLoader: SkillPromptLoader = createDefaultSkillPromptLoader()`, (c) replace `this.buildSkillPrompt(invocation)` inside `buildPrompt()` with `this.promptLoader.loadPrompt(invocation.skillName)`, (d) DELETE the entire `private buildSkillPrompt(invocation)` switch method (the eight `case "linkedin-..."` arms are now in their respective SKILL.md files).
- [X] T016 [US1] In `app/main/domains/execution/codex-cli-runner.ts`, wrap the `loadPrompt()` call inside `execute()` so that any thrown `SkillPromptNotFoundError` is converted into a `SkillRunnerResult` with `status: "failed"`, `summary: "Skill prompt missing"`, `error: { code: "SKILL_PROMPT_NOT_FOUND", message: <error message> }`. The runner MUST NOT propagate the exception to its caller.
- [X] T017 [US1] Run `npm test -- codex-cli-runner` and confirm every existing test case still passes WITHOUT modifying any assertion text. The byte-for-byte identical migration (T007–T014) plus the default loader injection guarantees this.

### Negative-path tests for the runner

- [X] T018 [US1] Add two test cases at the end of `tests/unit/codex-cli-runner.test.ts`: (1) "returns SKILL_PROMPT_NOT_FOUND when the loader throws" — instantiate `CodexCliRunner` with a stub loader whose `loadPrompt` throws `new SkillPromptNotFoundError("linkedin-post-writer", "...")`, call `execute()` with a post-writer invocation, assert `result.status === "failed"` and `result.error.code === "SKILL_PROMPT_NOT_FOUND"`. (2) "respects edited SKILL.md content on next call" — instantiate the runner with the default loader, monkey-patch `fs.readFileSync` (or use `mkdtempSync` and a custom skillsRoot) so the second read returns different content, call `execute()` twice, assert the executor was called with two different prompt bodies. NOTE: this is the only test that exercises the no-cache rule from the loader contract.
- [X] T019 [US1] Run `npm test -- codex-cli-runner` and confirm every previous case AND the two new cases pass.

**Checkpoint**: User Story 1 complete. The loader exists, the prompts live in the SKILL.md files, the runner reads them on every invocation, all tests are green. From this point on, editing any SKILL.md takes effect on the next skill invocation without rebuild.

---

## Phase 4: User Story 2 — Editorial benchmark with strict grading grid (Priority: P1)

**Goal**: Build a bench harness that loads 12 fixtures, exercises every skill chain through real Codex calls, applies a deterministic grading grid sourced from `docs/editorial-doctrine.md`, and emits a markdown + JSON report under `dist-eval/` with exit code 0 on full pass and 1 on any fail.

**Independent Test**: Run `tests/unit/editorial-doctrine-parser.test.ts` and `tests/unit/eval-editorial-grader.test.ts` to validate the pure modules without invoking Codex. Then run `npm run eval:editorial -- --fixture A1` to validate the wired bench end-to-end against a single fixture.

### Doctrine parser TDD cycle

- [X] T020 [US2] Create `tests/unit/editorial-doctrine-parser.test.ts` containing the 10 cases listed in `contracts/editorial-doctrine.md` §"Test fixtures expected": well-formed doctrine returns expected structure, missing each required section throws `EditorialDoctrineParseError` with `missingSections` list, missing sub-section also raises, empty list returns empty array, `*` bullet style is recognised, plain prose between sections is ignored, `numberRegex` matches representative inputs, `numberRegex` rejects non-numeric inputs, and `loadEditorialDoctrineFromFile()` reads the real `docs/editorial-doctrine.md` and parses successfully (sanity loop).
- [X] T021 [US2] Run `npm test -- editorial-doctrine-parser` and confirm every test fails (the parser module does not exist yet).
- [X] T022 [US2] Create `app/main/domains/execution/editorial-doctrine-parser.ts` implementing the contract from `contracts/editorial-doctrine.md`. Export `type EditorialDoctrine`, `class EditorialDoctrineParseError`, `function parseEditorialDoctrine(markdown: string): EditorialDoctrine`, `function loadEditorialDoctrineFromFile(path?: string): EditorialDoctrine`. The parser is a small line-based scanner: walk the lines, recognise `## ` and `### ` headings, accumulate bullet items (lines starting with `- ` or `* `) into the active section's array. Validate that the four required `## ` sections and the three required `### ` sub-sections under `## Concrete-Element Heuristics` are all present; if any are missing, throw `EditorialDoctrineParseError` with the list. Hardcode the `numberRegex` from research D2 inside the parser.

### Doctrine source file

- [X] T023 [US2] Create `docs/editorial-doctrine.md` with the structure from `contracts/editorial-doctrine.md` §"Initial content of `docs/editorial-doctrine.md`". Include a one-paragraph orientation paragraph at the top pointing the reader at `docs/editorial-iteration-playbook.md` (which will be created in US3). Populate every list with the items listed in the contract (banned openings 7, banned meta 5, voice rules 7, operational cost 10, business consequence 10, arbitrage 8). Plus the prose paragraph under `## Concrete-Element Heuristics` explaining that the number regex is hardcoded.
- [X] T024 [US2] Run `npm test -- editorial-doctrine-parser` and confirm all 10 cases now pass — including the sanity-loop case 10 that loads the real `docs/editorial-doctrine.md`.

### Grader TDD cycle

- [X] T025 [US2] Create `tests/unit/eval-editorial-grader.test.ts` containing the 15 cases listed in `contracts/grading-grid.md` §"Test fixtures expected by tests/unit/eval-editorial-grader.test.ts". Construct synthetic `SkillOutput` records and a synthetic `EditorialDoctrine` (no file IO, no `dist-eval/` writes). For each rule in the grading grid, write at least one passing case and one failing case. Include the integration case where two violations stack and the all-pass case. Import the grader via `import { gradeOutput } from "../../scripts/eval-editorial-grader.mjs"`.
- [X] T026 [US2] Run `npm test -- eval-editorial-grader` and confirm every test fails (the grader module does not exist yet).
- [X] T027 [US2] Create `scripts/eval-editorial-grader.mjs` implementing the contract from `contracts/grading-grid.md`. Export `function gradeOutput(output, doctrine, config): GradingResult`. Implement the seven rules in order. Rule 1 (skill refused) short-circuits and returns immediately because there is no body to grade. Rules 2 through 7 each append zero or one violation to `violatedRules` and continue. The verdict is `pass` if `violatedRules` is empty after all rules. Implement the skill-specific adapter for `linkedin-post-editor` so the grader sees `data.editedDraft.{headline,bodyMarkdown}` as `body` and `headline`. Import the doctrine type from the parser module via re-export.
- [X] T028 [US2] Run `npm test -- eval-editorial-grader` and confirm all 15 cases pass.

### Fixture catalogue

- [X] T029 [US2] Create `scripts/eval-editorial-fixtures.mjs` exporting `strategyBundle` (moved verbatim from the existing `scripts/benchmark-editorial-quality.mjs`) and `fixtures` — an array of exactly 12 `EditorialFixture` objects organised as 3 of type A, 3 of type B, 3 of type C, 3 of type D. Use the canonical id format `<TypeLetter><Index>` (A1, A2, A3, B1, B2, B3, C1, C2, C3, D1, D2, D3). Each fixture's `payload` matches the per-type required fields from `data-model.md` §"In-memory shapes" §EditorialFixture. Cover representative editorial situations from the cabinet's reality (ROI IA, cadrage, gouvernance, agents IA autonomes, etc.) — reuse the three topics already defined in the existing benchmark for type A, and invent realistic content for the other 9. Include a `validateFixtures()` helper that asserts the count, the per-type count, the id format regex, and the per-type required field presence; the helper throws on any malformed fixture so the bench fails fast at startup.

### Bench script

- [X] T030 [US2] Replace `scripts/benchmark-editorial-quality.mjs` with `scripts/eval-editorial-quality.mjs`. The new script: (a) parses CLI args via a small inline parser to extract `--fixture <id>` and `--fixture-type <letter>`, (b) loads `strategyBundle` and `fixtures` from `eval-editorial-fixtures.mjs`, (c) calls `validateFixtures()`, (d) loads the doctrine via `loadEditorialDoctrineFromFile()`, (e) computes the active fixture subset based on the CLI flags, (f) launches Electron in benchmark mode (same `_electron.launch()` pattern as the existing script), (g) saves the strategy bundle, (h) for each in-scope fixture, exercises the appropriate skill chain through the IPC bridge and captures the raw output, (i) calls `gradeOutput()` against each captured output, (j) writes the markdown + JSON report pair under `dist-eval/eval-report-<ISOtimestamp>.{md,json}` per `contracts/eval-report.md`, (k) exits with the correct status code per the contract (0 / 1 / 2 / 3). Capture the Codex CLI version once at startup via `codex --version` for the report metadata.
- [X] T031 [US2] Delete the obsolete file `scripts/benchmark-editorial-quality.mjs` if `scripts/eval-editorial-quality.mjs` is a separate file rather than a rename. (If T030 is implemented as a `git mv`, this task is automatically satisfied.)

### npm script wiring

- [X] T032 [US2] Add `"eval:editorial": "node scripts/eval-editorial-quality.mjs"` to the `scripts` block of `package.json`. Place it after the existing `verify-hardening` script for alphabetical-ish proximity to the other validation tooling. Do NOT add it to the test or build pipeline — per FR-017 the bench is local-only.

### Smoke test of the bench wiring

- [ ] T033 [US2] Run `npm run eval:editorial -- --fixture A1` against the local Codex CLI. Expected: the bench launches, executes one Codex invocation, writes a report pair under `dist-eval/`, and exits with 0 or 1 depending on whether the post-writer output passes the grading grid for fixture A1. NOTE: if Codex CLI is not authenticated locally the bench exits 3, which is an environmental issue not a feature defect — re-authenticate and retry.
- [ ] T034 [US2] Open the generated `dist-eval/eval-report-*.md` file and visually verify it contains the six required sections per `contracts/eval-report.md` §"Markdown shape" (Run metadata, Summary, Per-rule failure counts, Per-fixture results, Footer with playbook link). Open the JSON sibling and verify it parses with `node -e "JSON.parse(require('fs').readFileSync('dist-eval/<filename>.json'))"`.

**Checkpoint**: User Story 2 complete. The bench is wired end-to-end, the grading grid runs deterministically against captured outputs, the report pair is written to disk, and the exit code respects the contract.

---

## Phase 5: User Story 3 — Iteration playbook documented (Priority: P2)

**Goal**: A new file `docs/editorial-iteration-playbook.md` that teaches a contributor how to use the infrastructure shipped by US1 and US2, plus cross-references from `CONTRIBUTING.md` and `docs/exploitation.md`.

**Independent Test**: A reader unfamiliar with the project can complete every step of the playbook in under 15 minutes (SC-005). Verified manually in quickstart Step 9.

### Playbook content

- [X] T035 [US3] Create `docs/editorial-iteration-playbook.md` with seven `## ` sections matching FR-020: (1) `## Running the benchmark` — explains `npm run eval:editorial`, single-fixture filter, fixture-type filter, expected runtime, the four exit codes from `contracts/eval-report.md`. (2) `## Reading the report` — walks through the markdown report sections, explains how to identify the failing skill from a violated rule, and how to find the offending excerpt. (3) `## Editing a SKILL.md` — explains the file location, the `## Prompt` section, the no-recompilation guarantee, and the byte-for-byte identical-content rule that the migration preserved. (4) `## Re-running on a single fixture` — `--fixture` and `--fixture-type` syntax with concrete examples. (5) `## Adding a new fixture` — points at `scripts/eval-editorial-fixtures.mjs`, lists the per-type required payload fields, mentions the `<TypeLetter><Index>` id convention, mentions that `validateFixtures()` will catch malformed entries at startup. (6) `## Deciding when a prompt is production-ready` — the human "litmus test" framing: even if the bench is green on every fixture, the maintainer must read the outputs and confirm they sound publishable; this is the section that satisfies FR-021. (7) `## Limits of automated grading` — explicit list of what the grader does NOT measure (originality, factual accuracy, persona fit, audience match) and why those still need human review.
- [X] T036 [US3] In `docs/editorial-iteration-playbook.md`, add a footer that links to `docs/editorial-doctrine.md`, `contracts/grading-grid.md`, and `contracts/skill-prompt-loader.md` so a contributor who wants to dig deeper has a clear next step.

### Cross-references

- [X] T037 [US3] Modify `CONTRIBUTING.md`: in the existing `## Test-driven development (Constitution IV)` section (or in a new `## Editorial iteration` subsection right after it), add a paragraph explaining that prompt-iteration work happens through `docs/editorial-iteration-playbook.md` and link to that file. Per FR-022, the link MUST be reachable from the natural reading path of `CONTRIBUTING.md`.
- [X] T038 [US3] Modify `docs/exploitation.md`: add a new section or a paragraph in an existing operations section that references `docs/editorial-iteration-playbook.md` as the entry point for editorial iteration, with a short one-line description. Per FR-022, the link MUST be present.

**Checkpoint**: User Story 3 complete. The playbook exists, covers the seven topics, and is reachable from both `CONTRIBUTING.md` and `docs/exploitation.md`.

---

## Phase 6: Polish — Regression Gates + Commit + Merge

**Purpose**: Validate the complete feature against every existing gate and produce the final commits.

- [X] T039 Run the full local regression sequence in this exact order: `npm run rebuild:native:electron`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --audit-level=high --omit=dev`. Every command MUST exit 0. Test count MUST be at least `298 + 36 = 334` (9 from skill-prompt-loader including the FR-006 sanity loop + 10 from editorial-doctrine-parser + 15 from eval-editorial-grader + 2 new cases in codex-cli-runner.test.ts).
- [X] T040 Run `node scripts/real-app-audit.mjs` and confirm all 14 steps pass (exit 0). This is the existing real-app audit from feature 004 — it MUST NOT have regressed because of the runner refactor.
- [X] T041 Run `node scripts/verify-hardening.mjs` and confirm all 6 checks pass (exit 0). This is the existing hardening verification from feature 002 — it MUST NOT have regressed.
- [X] T042 Verify no `Co-Authored-By` trailer or `Claude` mention is present in the feature branch AND in the entire repository history (the latter to satisfy SC-008 fully). Run all four commands: (1) `git log main..HEAD --grep="Claude" --oneline` — feature branch keyword scan, MUST return no results. (2) `git log main..HEAD --pretty=full | grep -F "Co-Authored-By"` — feature branch trailer scan, MUST return no results. (3) `git log --all --grep="Claude" --oneline` — history-wide keyword scan, MUST return no results. (4) `git log --all --pretty=full | grep -F "Co-Authored-By"` — history-wide trailer scan, MUST return no results. Commands 3 and 4 satisfy the SC-008 wording "over the entire history at HEAD". This is FR-026 and SC-008.
- [X] T043 Verify the bench is NOT wired to any GitHub Actions workflow. Run `grep -r "eval:editorial" .github/workflows/` — MUST return no match. This is FR-017.
- [X] T044 Review the complete feature diff with `git diff main --stat` and confirm: the eight `skills/linkedin-*/SKILL.md` files have grown by approximately 10–30 lines each (the migrated prompt content), `app/main/domains/execution/codex-cli-runner.ts` has shrunk by ~110 lines (the deleted switch), three new `app/main/domains/execution/*.ts` and `*.mjs` files exist, three new `tests/unit/*.test.ts` files exist, two new files exist under `docs/`, one new file exists under `scripts/`, `package.json` has one new script entry, `.gitignore` has one new pattern. No file under `app/` other than the runner has been touched.
- [X] T045 Stage and commit the feature work as a small number of logical commits authored by `Philippe Cohen <contact@AutomatisIA.fr>` with conventional-commit subjects and **no `Co-Authored-By` trailer**. Suggested commit groups: (a) `docs(006): add spec-kit artifacts for editorial quality evaluation`, (b) `feat(006): expose SkillPromptLoader and migrate eight Codex prompts to SKILL.md`, (c) `feat(006): add editorial doctrine parser and source-of-truth markdown`, (d) `feat(006): add editorial grading grid and bench harness with 12 fixtures`, (e) `docs(006): add iteration playbook and cross-references`, (f) `chore(006): mark tasks complete in tasks.md`. Mark every task `[X]` in `tasks.md` before commit (f).
- [ ] T046 Switch to `main`, fast-forward merge `006-editorial-quality-evaluation`, push `main` to `origin`. After the push, observe the GitHub Actions CI run on `main` for the new commit and confirm all three OS matrix cells stay green. (The new files only touch local infra, so CI should pass without iteration.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** (T001–T002): no dependencies, starts immediately.
- **Phase 2 Foundational**: empty other than the gitignore in T002. No blocking work for the user stories beyond Phase 1.
- **Phase 3 US1** (T003–T019): depends on Phase 1. Independent of Phase 4 at the test level — T020–T028 can run in parallel with T003–T019 because they touch different files.
- **Phase 4 US2** (T020–T034): T020–T028 (parser + grader unit tests + implementation) are independent of US1 and can run in parallel. T029–T034 (fixtures + bench wiring + smoke test) depend on US1 being complete because the bench imports the runner.
- **Phase 5 US3** (T035–T038): depends on US1 + US2 being complete because the playbook references both the SKILL.md edit flow and the bench command.
- **Phase 6 Polish** (T039–T046): depends on every previous phase.

### Within US1 — strict TDD ordering

- T003 (test) → T004 (observe failure) → T005 (impl) → T006 (verify green)
- T007–T014 (eight migrations, parallelizable [P], can be done in any order — they touch different files)
- T015–T016 (runner refactor, sequential because they touch the same file)
- T017 (verify existing runner tests still green)
- T018 (negative-path tests) → T019 (verify all green including new cases)

### Within US2 — strict TDD ordering

- Doctrine parser: T020 → T021 → T022 → T023 (doctrine source) → T024 (verify green)
- Grader: T025 → T026 → T027 → T028 (verify green)
- Fixtures + bench wiring: T029 → T030 → T031 (delete old) → T032 (npm script) → T033 (smoke test) → T034 (verify report)

### Parallel Opportunities

- **Across US1 and US2**: T020–T028 (parser + grader unit tests) are 100% independent of US1 and can be assigned to a second contributor in parallel.
- **Within US1**: T007–T014 are eight independent file creations and can run as 8 parallel tasks.
- **Within US2 doctrine parser**: T023 (creating the doctrine source markdown) can run in parallel with T020–T022 (writing the parser test + implementation) because the parser test uses synthetic markdown strings — the real doctrine file is only needed for case 10 (sanity loop).

---

## Parallel Example — US1 and US2 doctrine + grader concurrent

```bash
# After T002 lands:
Agent A: T003 → T004 → T005 → T006 → T007..T014 → T015..T019    # entire US1
Agent B: T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028  # US2 unit tests + impl
# Both agents converge at the end of US1; agent A continues into T029..T034 (bench wiring) and agent B can start US3.
```

---

## Parallel Example — eight prompt migrations within US1

```bash
# After T006 verifies the loader green:
Task: "Append ## Prompt section to skills/linkedin-strategy-foundation/SKILL.md (T007)"
Task: "Append ## Prompt section to skills/linkedin-topic-generator/SKILL.md (T008)"
Task: "Append ## Prompt section to skills/linkedin-structure-selector/SKILL.md (T009)"
Task: "Append ## Prompt section to skills/linkedin-hook-engine/SKILL.md (T010)"
Task: "Append ## Prompt section to skills/linkedin-post-writer/SKILL.md (T011)"
Task: "Append ## Prompt section to skills/linkedin-post-editor/SKILL.md (T012)"
Task: "Append ## Prompt section to skills/linkedin-repurpose/SKILL.md (T013)"
Task: "Append ## Prompt section to skills/linkedin-news-to-post/SKILL.md (T014)"
# 8 tasks, 8 different files, no ordering constraint.
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 Setup (T001–T002).
2. Phase 3 US1 (T003–T019).
3. **STOP and VALIDATE**: editing a SKILL.md takes effect immediately. The infrastructure for fast iteration exists. Phase 4–6 can ship in a follow-up if needed.

### Full Feature (US1 + US2 + US3)

1. Setup → US1 → US2 → US3 → Polish, sequentially.
2. Or US1 in parallel with US2's unit tests as in the parallel example above.
3. Total estimated effort: ~6-8 hours of focused work for a single contributor, including the eight migration tasks which are mechanical copy-paste.

### Single-contributor sequential path

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030 → T031 → T032 → T033 → T034 → T035 → T036 → T037 → T038 → T039 → T040 → T041 → T042 → T043 → T044 → T045 → T046

Total: **46 tasks**.

---

## Notes

- **[P] tasks** = different files, no ordering dependency with other [P] tasks in the same batch.
- **TDD gate** (Constitution IV): every implementation task is preceded by a test task and an observation-of-failure task.
- **Byte-for-byte rule** (FR-002): T007–T014 are mechanical copy-paste from the inline switch arms. No editorial improvement allowed during this feature; the iteration loop ships first, the optimisation work follows.
- **No Claude trailer** (FR-026, session feedback rule): every commit MUST be authored by Philippe Cohen alone. T042 verifies this gate before merge.
- **No CI wiring** (FR-017): the bench is local-only. T043 verifies this is preserved.
- **Test count expectation**: 298 baseline + 9 (skill-prompt-loader, including the FR-006 sanity loop) + 10 (editorial-doctrine-parser) + 15 (eval-editorial-grader) + 2 (new runner cases) = 334. T039 asserts the final count is at least 334.
