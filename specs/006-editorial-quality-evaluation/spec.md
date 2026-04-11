# Feature Specification: Editorial Quality Evaluation Infrastructure

**Feature Branch**: `006-editorial-quality-evaluation`
**Created**: 2026-04-11
**Status**: Draft
**Input**: User description: "Editorial quality evaluation infrastructure: extract Codex prompts to SKILL.md so they are editable without recompilation, plus a strict editorial benchmark harness with 12 fixtures and a programmatic grading grid, plus an iteration playbook."

## Clarifications

### Session 2026-04-11

- Q: Where does the canonical editorial doctrine file (banned openings, banned meta-phrases, voice rules, concrete-element heuristics) live? → A: Human-readable markdown at `docs/editorial-doctrine.md`, organized by labelled sections (`## Banned Openings`, `## Banned Meta Phrases`, `## Voice Rules`, `## Concrete-Element Heuristics`). The grader and the unit tests load it through a small dedicated parser. The playbook links to it directly so contributors can edit doctrine without touching code.
- Q: How does the grader programmatically detect that an output contains at least one "concrete element"? → A: Multi-pattern detection across four named categories — (1) numbers via regex matching digits with optional units, (2) operational-cost keywords, (3) business-consequence keywords, (4) arbitrage keywords. At least one of the four categories must match the output body. Each category's keyword list lives in `docs/editorial-doctrine.md` under `## Concrete-Element Heuristics` so doctrine edits never require code changes.
- Q: What are the starting defaults for body length range and quality score threshold? → A: Body length **800–2200 characters** (≈120–330 words, the typical range before LinkedIn truncates with "see more" on mobile) and quality score threshold **≥ 0.80** (aligned with the "refuse rather than ship a weak draft" doctrine). Both values are tunable post-ship by editing a small constants block in the bench source.
- Q: How do existing prompt-fragment assertions in `tests/unit/codex-cli-runner.test.ts` survive the migration without being rewritten? → A: The runner gets a third constructor dependency `SkillPromptLoader`. In production it loads `skills/linkedin-<name>/SKILL.md` from disk on every invocation. In tests, the default loader is used and points at the real repo files. Because FR-002 mandates the migrated prompt content is byte-for-byte identical to today's inline content, every existing `expect(prompt).toContain(...)` assertion continues to pass with no modification. Tests that need to simulate a missing or invalid SKILL.md inject a custom loader stub.
- Q: How does a contributor re-run the benchmark against a single fixture during prompt iteration? → A: CLI flag passed through npm. `npm run eval:editorial -- --fixture A1` runs only fixture `A1`. `npm run eval:editorial -- --fixture-type A` runs the three fixtures of type A. With no flag, all twelve fixtures run. Fixture identifiers follow the convention `<TypeLetter><Index>` (A1, A2, A3, B1, …, D3) so they are easy to mention in the playbook and in commit messages.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Edit a Codex skill prompt without recompiling the application (Priority: P1)

The maintainer opens `skills/linkedin-post-writer/SKILL.md`, edits the prompt section directly in a text editor, saves the file, and re-runs any skill invocation. The new prompt content takes effect immediately on the next invocation. There is no TypeScript build step, no Electron rebuild, no application restart required to pick up the change. If the edited file becomes invalid (missing the prompt section, empty prompt body, missing critical anchors), the next invocation fails fast with a clear error code that names the offending skill, rather than silently falling back to a hardcoded version.

**Why this priority**: This is the unblocker for every prompt iteration that follows. Without it, every single prompt change costs a 30-second rebuild cycle, which makes the editorial evaluation work in User Story 2 prohibitively slow. P1 because no other story in this feature delivers value if the maintainer cannot iterate cheaply.

**Independent Test**: Open any `skills/linkedin-*/SKILL.md`, change one word inside the prompt section, save the file, run the existing real-app audit script. Observe that the changed word reaches the Codex CLI invocation on the very next run with no rebuild step. Restore the original word.

**Acceptance Scenarios**:

1. **Given** all eight skill prompts have been migrated from the inline TypeScript switch to their corresponding `SKILL.md` files, **When** the maintainer edits a prompt in any `SKILL.md` and runs the application, **Then** the edited content is the prompt sent to the Codex CLI on the next invocation, with no rebuild required.
2. **Given** a `SKILL.md` file is deleted or its prompt section is removed, **When** the runner is asked to invoke that skill, **Then** the invocation fails with a stable error code that names the missing skill and does not silently fall back to a hardcoded prompt.
3. **Given** the existing unit test suite that asserts specific prompt fragments, **When** the prompts have been migrated to `SKILL.md` files, **Then** every existing prompt-content assertion still passes against the file-loaded prompt without modification of the assertion text.
4. **Given** a brand-new contributor cloning the repository, **When** they read `skills/linkedin-<name>/SKILL.md`, **Then** they see the entire prompt that the runner will use, in plain markdown, without having to grep through TypeScript code.

---

### User Story 2 — Run a strict editorial quality benchmark and get a structured pass/fail report (Priority: P1)

The maintainer runs a single command and the application launches in benchmark mode, exercises every skill against twelve representative input fixtures (three for each of the four canonical input types from Annex C of the cabinet's editorial cahier des charges), and produces a structured report listing every fixture as either pass or fail. Failed fixtures are annotated with the specific rule that was violated and the offending excerpt. The command exits with a non-zero status if any fixture failed, so the bench can be used as a gate during local iteration. The report is saved to disk in both human-readable and machine-parseable formats.

**Why this priority**: This is the deliverable that converts subjective editorial quality into a measurable signal. Without it, the maintainer has no way to know whether a prompt change improved or degraded the output, which makes the iteration loop guess-driven. P1 because it is the actual feature objective; User Story 1 only exists to make this loop fast enough to be practical.

**Independent Test**: Run the benchmark command after both User Stories 1 and 2 are implemented. Observe that twelve fixtures are exercised, every output is graded against the documented checks, the report file appears under `dist-eval/`, and the exit code matches whether any fixture failed.

**Acceptance Scenarios**:

1. **Given** twelve editorial fixtures organized in four named types (manual idea, news source, anonymized client case, draft to correct), **When** the benchmark is invoked, **Then** every fixture is exercised by the appropriate skill chain through real Codex CLI calls, and every output is captured for grading.
2. **Given** an output that contains a banned opening pattern from the cabinet doctrine (for example a soft opener not anchored in a concrete fact), **When** the grader runs against it, **Then** the fixture is marked as fail, the report names the violated rule, and the exit code is non-zero.
3. **Given** an output where the skill returned a `failed` status, **When** the grader runs against it, **Then** the fixture is counted as a fail with the reason "skill refused" and the natural Codex error message preserved in the report.
4. **Given** twelve outputs that all satisfy every check in the grading grid, **When** the grader runs against them, **Then** every fixture is marked as pass, the exit code is zero, and the report records the success count.
5. **Given** a benchmark run, **When** it completes, **Then** the report exists at a deterministic on-disk location in both markdown and JSON formats, and can be diffed across runs to track prompt-iteration progress.

---

### User Story 3 — Follow a documented playbook to iterate on prompts (Priority: P2)

A contributor (Philippe or a future external collaborator) opens the documentation, reads a single page that explains exactly how the editorial iteration loop works, and starts contributing prompt improvements without having to reverse-engineer the workflow. The playbook covers running the bench, reading the report, editing a SKILL.md, re-running on a single fixture during development, adding a new fixture, knowing when a prompt is ready, and explicitly states the limits of programmatic grading versus human judgment.

**Why this priority**: P2 because the loop technically works without it (User Stories 1 and 2 are self-sufficient for someone who built them), but the playbook is what makes the workflow accessible to a second person and durable through future maintainers' memory loss. The feature ships even if the playbook is incomplete; without User Story 3 the system is just harder to onboard.

**Independent Test**: Hand the playbook to someone who has never seen the project. Within fifteen minutes they should be able to run the bench, read the report, edit a SKILL.md, re-run the bench, and understand why the result changed.

**Acceptance Scenarios**:

1. **Given** the playbook document exists, **When** a contributor reads it end to end, **Then** they understand the seven topics: how to run the bench, how to read the report, how to edit a SKILL.md without recompilation, how to filter the bench to a single fixture, how to add a new fixture, how to decide a prompt is ready for production, and the limits of automated grading.
2. **Given** the playbook is published, **When** a maintainer browses `CONTRIBUTING.md` or `docs/exploitation.md`, **Then** they find a clear cross-reference pointing to the playbook.
3. **Given** the playbook claims that automated grading is necessary but not sufficient, **When** the reader looks for the human-validation section, **Then** they find the explicit "litmus test" framing that says no fixture is truly ready until the maintainer has read the output and confirmed it sounds publishable.

---

### Edge Cases

- **A SKILL.md exists but its prompt section is empty whitespace**: treated as missing, raises the same error as a fully missing file.
- **A SKILL.md contains a prompt section but also stale legacy stub content**: the loader extracts only the prompt section's body, ignoring sibling sections.
- **Two skills accidentally point at the same SKILL.md path**: the registry detects the collision at load time and refuses to start, naming both skills.
- **The benchmark is run on a machine where Codex CLI is not authenticated**: the bench fails fast with the existing `CODEX_CLI_FAILED` error code on the first fixture, the report records "codex unavailable" for every fixture, and the exit code is non-zero.
- **A fixture deliberately exercises an opening that looks banned but is immediately followed by a concrete fact**: the grader has a "rescue clause" that allows the banned phrase only when the very next sentence contains a measurable fact (number, business consequence, operational cost). This rescue is documented in the playbook.
- **The benchmark is interrupted halfway**: any fixtures already completed are still written to a partial report; the exit code reflects the interruption rather than a clean pass.
- **A new contributor adds a fixture without filling every required field**: the bench validates fixture shape at startup and refuses to run with a clear error pointing at the malformed fixture.
- **Two consecutive bench runs produce different reports because Codex output is non-deterministic**: this is expected, the report includes a timestamp and a Codex CLI version footer, and the playbook explains that variance is normal.

## Requirements *(mandatory)*

### Functional Requirements

#### US1 — Prompts loaded from SKILL.md at runtime

- **FR-001**: Each of the eight LinkedIn skills (`linkedin-strategy-foundation`, `linkedin-topic-generator`, `linkedin-structure-selector`, `linkedin-hook-engine`, `linkedin-post-writer`, `linkedin-post-editor`, `linkedin-repurpose`, `linkedin-news-to-post`) MUST have its full Codex prompt published as a `## Prompt` section inside `skills/linkedin-<name>/SKILL.md`.
- **FR-002**: The text of every migrated prompt MUST be byte-for-byte identical to the prompt currently inlined in the runner. This is a mechanical migration; no editorial improvement is allowed during this feature.
- **FR-003**: The runner MUST resolve the prompt for an invocation by reading the corresponding `SKILL.md` from disk at invocation time, not at process startup. Editing the file MUST take effect on the next invocation without restarting the application.
- **FR-004**: The loader MUST raise a stable error code (for example `SKILL_PROMPT_NOT_FOUND`) when a `SKILL.md` is missing, when the `## Prompt` section is missing, or when the prompt body is empty whitespace. The error message MUST name the offending skill.
- **FR-005**: The runner MUST NOT contain any silent fallback to a hardcoded prompt string. If the file load fails, the invocation fails.
- **FR-006**: A new unit test MUST iterate over every registered skill name and assert that its `SKILL.md` exists, contains a `## Prompt` section, and resolves to a non-empty prompt body.
- **FR-007**: Every existing assertion in `tests/unit/codex-cli-runner.test.ts` that checks specific prompt fragments MUST continue to pass after migration, with no changes to the assertion strings themselves. The `CodexCliRunner` constructor MUST accept an injectable `SkillPromptLoader` so that tests can either use the default loader (which reads the real `SKILL.md` files from the repo) or substitute a stub for negative-path tests (missing file, empty prompt section).
- **FR-008**: Each `SKILL.md` MUST keep its existing structural sections (`# <skill name>`, `## Purpose`, `## Inputs`, `## Outputs`) so the file is still readable as a skill contract, with the new `## Prompt` section appended.

#### US2 — Editorial benchmark with strict grading grid

- **FR-009**: A new npm script (`npm run eval:editorial` or equivalent) MUST exist and trigger the benchmark end-to-end.
- **FR-010**: The benchmark MUST load exactly twelve fixtures, organized in four types of three fixtures each:
  - Type A — manual leadership idea (raw subject + clear angle + explicit persona)
  - Type B — external news or article to repurpose (source text or URL plus optional human framing)
  - Type C — anonymized client case (situation, problem, intervention, outcome)
  - Type D — existing draft to be corrected (a draft post fed into the post-editor skill)
- **FR-011**: For each Type A and Type C fixture, the benchmark MUST exercise the appropriate skill chain ending in `linkedin-post-writer`. For each Type B fixture, the benchmark MUST exercise `linkedin-news-to-post`.
- **FR-012**: For each Type D fixture, the benchmark MUST invoke `linkedin-post-editor` against the supplied draft.
- **FR-013**: For every captured output, the benchmark MUST apply a programmatic grading grid that checks each of the following rules. The lists of banned phrases and concrete-element heuristics MUST be loaded from `docs/editorial-doctrine.md` (the canonical markdown source documented in the Key Entities section) — the grader has no inline copy.
  - No banned soft-opener phrase (loaded from the `## Banned Openings` section of `docs/editorial-doctrine.md`), unless the banned phrase is immediately followed within one sentence by a concrete fact matching one of the heuristics in the `## Concrete-Element Heuristics` section.
  - No banned meta-phrase (loaded from the `## Banned Meta Phrases` section of `docs/editorial-doctrine.md`).
  - The headline MUST NOT be repeated verbatim in either of the first two sentences of the body.
  - The body length MUST fall inside the configured min/max range. Default range: **800–2200 characters** (matching the LinkedIn mobile "see more" truncation window). Tunable by editing a constants block in the bench source.
  - The body MUST contain at least one concrete element matching one of four named categories: (1) a numeric value detected by regex (digits with optional unit such as `%`, `€`, `jours`, `heures`, `mois`, `FTE`, etc.), (2) an operational-cost keyword from the doctrine list (e.g. `licence`, `supervision`, `cadrage`, `audit`, `migration`, `onboarding`), (3) a business-consequence keyword from the doctrine list (e.g. `retard`, `perte`, `bloque`, `rejette`, `doublement`), or (4) an arbitrage keyword from the doctrine list (e.g. `plutôt que`, `versus`, `au lieu de`, `renonce à`). Each keyword list is editable in `docs/editorial-doctrine.md` under `## Concrete-Element Heuristics`. At least one of the four categories MUST match for the output to pass this rule.
  - The skill's reported quality score MUST be greater than or equal to the configured threshold. Default threshold: **0.80**, aligned with the "refuse rather than ship a weak draft" doctrine. Tunable by editing the same constants block.
  - The skill MUST NOT have returned a `failed` status; if it did, the fixture is counted as a fail with the reason "skill refused".
- **FR-014**: The benchmark MUST emit a structured report in two parallel formats: a human-readable markdown file and a machine-parseable JSON file. Both files MUST be saved under `dist-eval/` with a deterministic, timestamped naming scheme.
- **FR-015**: Each fixture entry in the report MUST contain: the fixture identifier, the fixture type (A/B/C/D), the skill that produced the output, the verdict (pass or fail), the list of violated rules if any, and a short excerpt of the output containing the violation if applicable.
- **FR-016**: The benchmark MUST exit with a non-zero status code if any fixture failed any check. A clean run (all twelve fixtures pass every check) MUST exit zero so the bench can be used as a local gate.
- **FR-017**: The benchmark MUST run only locally and MUST NOT be wired into the GitHub Actions CI pipeline, because it requires a real authenticated Codex CLI on the host.
- **FR-018**: The benchmark MUST support a fixture filter passed as a CLI flag through the npm script: `npm run eval:editorial -- --fixture <id>` runs exactly one fixture, `npm run eval:editorial -- --fixture-type <letter>` runs all three fixtures of the given type, and an absent flag runs all twelve. Fixture identifiers follow the convention `<TypeLetter><Index>` (e.g. `A1`, `B2`, `D3`) so they are stable across runs and easy to reference in the playbook and commit messages.
- **FR-019**: The strategy bundle (positioning, ICPs, voice rules, content pillars) used by the benchmark MUST stay aligned with the cabinet's editorial doctrine and SHOULD reuse the bundle already defined in the existing `scripts/benchmark-editorial-quality.mjs` script as its starting point.

#### US3 — Iteration playbook

- **FR-020**: A new file `docs/editorial-iteration-playbook.md` MUST exist and cover seven topics in plain language: (1) how to run the bench, (2) how to read the report, (3) how to edit a `SKILL.md` without recompilation, (4) how to filter the bench to a single fixture, (5) how to add a new fixture, (6) the human criteria for declaring a prompt "production-ready" beyond the programmatic checks, (7) the documented limits of automated grading.
- **FR-021**: The playbook MUST explicitly state that the programmatic grid is necessary but not sufficient, and MUST name the human "litmus test" — does the output sound like something the maintainer would actually publish — as the ultimate gate.
- **FR-022**: `CONTRIBUTING.md` and `docs/exploitation.md` MUST link to the playbook, so a new contributor lands on it through the natural reading paths.

#### Non-regression guardrails

- **FR-023**: This feature MUST NOT introduce any regression on the existing gates: at least 298 unit tests passing, zero `npm audit --audit-level=high --omit=dev` vulnerabilities, typecheck/lint/build clean, the 14-step real-app audit succeeding, the six-check verify-hardening script succeeding on macOS, and the 3-OS GitHub Actions CI staying green on `main`.
- **FR-024**: This feature MUST NOT change the externally observable behavior of any skill output during the migration. Subsequent prompt-iteration work happens after this feature ships.
- **FR-025**: No secret or credential MUST be added to the repository as part of this feature. The benchmark relies entirely on the operator's already-authenticated Codex CLI.
- **FR-026**: Every commit produced for this feature MUST be authored by `Philippe Cohen <contact@AutomatisIA.fr>` with no `Co-Authored-By` trailer and no mention of any AI assistant in the commit messages.

### Key Entities *(involving the new file-system contract)*

- **Skill prompt file (`skills/linkedin-<name>/SKILL.md`)**: a markdown document carrying the human-readable skill contract (purpose, inputs, outputs) plus the full Codex system prompt under a `## Prompt` heading. Owned by the editor; read by the runner at every invocation.
- **Editorial fixture**: a structured input record describing one of the four canonical input types (manual idea, news source, anonymized client case, draft to correct). Lives inside the benchmark script or an adjacent fixture file. Carries every field needed by the targeted skill, plus an identifier and a type label.
- **Grading rule**: a single check applied to a captured output. Documented in research and implemented as a small pure function. Returns a pass verdict or a fail verdict with a reason string.
- **Evaluation report**: the artifact produced by a benchmark run. Pair of files (markdown + JSON) under `dist-eval/`. Contains the run timestamp, the Codex CLI version footer, the per-fixture verdicts, the per-rule failure counts, and the overall pass/fail summary.
- **Editorial doctrine source (`docs/editorial-doctrine.md`)**: a human-readable markdown file at the canonical path `docs/editorial-doctrine.md`, structured as four labelled sections — `## Banned Openings`, `## Banned Meta Phrases`, `## Voice Rules`, `## Concrete-Element Heuristics`. Each section is a markdown bulleted list. The grader and the unit tests load this file through a small dedicated parser. The playbook links to it directly so a contributor can read and edit the doctrine without touching any code. This is the single source of truth referenced by the grader, the unit tests, and the playbook.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After this feature is merged, editing any `skills/linkedin-<name>/SKILL.md` and re-running a single skill invocation takes less than three seconds total elapsed time on the maintainer's local machine, versus the current baseline of approximately 30 seconds dominated by the Electron rebuild cycle.
- **SC-002**: A maintainer can complete one full prompt iteration loop (edit `SKILL.md`, run the benchmark, read the report, identify the failing rule, restore the previous version) in under five minutes on the local machine.
- **SC-003**: The benchmark exercises exactly twelve fixtures organized in four named types and produces a single deterministic report file (markdown + JSON pair) per run, every run, without manual cleanup between runs.
- **SC-004**: After the migration, every `skills/linkedin-<name>/SKILL.md` is at least eighty lines long (because the prompts are substantial) and contains a clearly delimited `## Prompt` section, so a contributor reading the directory listing can immediately tell that the prompt is real, not a stub.
- **SC-005**: A new contributor following the iteration playbook can complete all seven listed steps (run, read, edit, filter, add, decide, understand limits) in under fifteen minutes of reading and one full bench run, on a freshly cloned machine.
- **SC-006**: After this feature is merged, all gates listed in FR-023 still pass: at least 298 unit tests, zero high-severity production vulnerabilities, clean typecheck/lint/build, 14-step real-app audit, six-check verify-hardening, three-OS CI on `main`.
- **SC-007**: Running the benchmark with at least one deliberately seeded banned phrase in a fixture produces a non-zero exit code and the offending rule is named in the report; running the benchmark with all twelve fixtures clean produces an exit code of zero.
- **SC-008**: A `git grep -F "Co-Authored-By"` over the entire history at HEAD returns zero matches, and every commit on the feature branch is authored by `Philippe Cohen <contact@AutomatisIA.fr>`.

## Out of Scope

The following items are explicitly excluded from this feature:

- **Actual editorial optimization of the prompts.** This feature ships the infrastructure that makes iteration cheap. The iteration itself is daily editorial work that happens after this feature lands.
- **Any chiffré target quality score** (no commitment to "reach 95% pass rate"). The feature commits to delivering the measurement, not to the measurement's outcome.
- **Meta-evaluation of one Codex skill by another Codex call.** No "LLM as judge". The grader is purely deterministic regex-and-rule code.
- **CI integration of the benchmark.** The bench requires real Codex authentication and runs against a paid LLM endpoint, so it stays local-only and is invoked manually by the maintainer.
- **The remaining items of the broader code-quality refactor (Chantier 4).** Helper deduplication, strict TS tightening, screen extraction, etc. — these stay as a separate future feature.
- **Translation of the playbook.** It is written in the same language as the rest of the cabinet documentation and `CONTRIBUTING.md`.
- **Migrating fixtures into a database or remote store.** Fixtures live as code or JSON next to the bench script.
- **Adding a UI screen to expose the benchmark results inside the application.** The benchmark stays a CLI tool.
- **A regression of any decision made in features 001 through 005.** No IPC schema changes, no security-hardening relaxations, no CI matrix changes, no metadata file changes, no Codex execution doctrine relaxations.

## Assumptions

- The maintainer's local machine has the Codex CLI installed and authenticated through the standard OAuth flow before running the benchmark. If it is not, the existing `CODEX_CLI_FAILED` error path applies and the benchmark fails fast on the first fixture rather than trying to recover.
- The eight skill names enumerated in FR-001 are exhaustive; no new skill is added or renamed during this feature. If a future feature introduces a ninth skill, it will need to land its own `SKILL.md` with a `## Prompt` section under the same convention.
- The body-length range and the quality-score threshold mentioned in FR-013 are tunable defaults. The feature ships with sensible starting values that the maintainer can adjust later by editing a small configuration file or constants block; tuning the values is part of the post-ship editorial iteration, not part of this feature.
- The cabinet's editorial doctrine (banned openings, banned meta-phrases, voice rules) is considered stable for the duration of this feature. If the doctrine evolves, the canonical source-of-truth file documented in the entity list is the single place to update.
- The current `scripts/benchmark-editorial-quality.mjs` file is a starting point that already wires Electron + Playwright + the strategy bundle. This feature is allowed to extend, refactor, or rename it, as long as the user-visible npm script command resolves to the new behavior.
