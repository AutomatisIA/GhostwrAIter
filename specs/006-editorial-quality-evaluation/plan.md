# Implementation Plan: Editorial Quality Evaluation Infrastructure

**Branch**: `006-editorial-quality-evaluation` | **Date**: 2026-04-11 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-editorial-quality-evaluation/spec.md`

## Summary

Deliver three coupled components that turn editorial quality from a subjective judgement into a measurable, fast-iteration loop. **(1)** Migrate the eight skill-specific Codex prompts from the inline switch in `app/main/domains/execution/codex-cli-runner.ts:buildSkillPrompt()` to per-skill `skills/linkedin-<name>/SKILL.md` files, expose a `SkillPromptLoader` injectable on the runner, and read the prompt from disk on every invocation so editing a markdown file takes effect on the next call without recompilation. The system prompt envelope (premium runner instructions + invocation block) stays in the runner. **(2)** Rebuild `scripts/benchmark-editorial-quality.mjs` (or replace it with `scripts/eval-editorial-quality.mjs`) to load twelve fixtures organised in four canonical types (manual idea, news source, anonymized client case, draft to correct), exercise the appropriate skill chain through real Codex CLI calls, apply a deterministic grading grid sourced from `docs/editorial-doctrine.md`, and emit a markdown + JSON report under `dist-eval/` with a non-zero exit code on any fixture failure. **(3)** Publish `docs/editorial-iteration-playbook.md` covering the seven topics from US3 (run, read, edit, filter, add, decide, limits), and link it from `CONTRIBUTING.md` and `docs/exploitation.md`. The feature ships infrastructure only; no editorial improvement of the prompts happens here — that is post-ship daily work the maintainer performs against the new fast-iteration loop.

## Technical Context

**Language/Version**: TypeScript 6.0.2 (runner refactor + new tests) and ES Modules JavaScript for the bench script (`scripts/eval-editorial-quality.mjs`). No new TypeScript compiler version, no new Vite version, no new Electron version. Node 20 runtime as before.
**Primary Dependencies**: No new npm dependencies. Reuse `node:fs` for file IO, `node:path` for path resolution, the existing `yaml` devDep already added in feature 005 only if needed (probably not — the doctrine file is parsed by a simple line-based parser). Reuse `playwright` (already devDep) + `_electron.launch()` for the bench harness, exactly as the existing `scripts/benchmark-editorial-quality.mjs` does today.
**Storage**: The doctrine source lives at `docs/editorial-doctrine.md` (markdown). The eight skill prompts live at `skills/linkedin-<name>/SKILL.md` (markdown). The evaluation report is written to `dist-eval/eval-report-<timestamp>.{md,json}` per run. No SQLite changes, no schema migration, no IPC surface change, no preload contract change.
**Testing**: Vitest 4.1.4 for unit tests. Three new unit-test files: `tests/unit/skill-prompt-loader.test.ts` (validates the loader against missing files, empty prompt sections, valid prompts), `tests/unit/editorial-doctrine-parser.test.ts` (validates the doctrine parser against well-formed and malformed `editorial-doctrine.md` fixtures), and `tests/unit/eval-editorial-grader.test.ts` (validates each rule of the grading grid against synthetic outputs). The existing `tests/unit/codex-cli-runner.test.ts` is updated to instantiate `CodexCliRunner` with the default loader (which reads the real repo `SKILL.md` files) so no assertion text changes per FR-007.
**Target Platform**: Local developer machine (macOS, Linux, Windows). The benchmark script is the only piece that requires a real authenticated Codex CLI; the loader and the grader unit tests run on every CI matrix cell because they only touch local file IO. The bench itself stays out of CI per FR-017.
**Project Type**: Electron desktop application — no architecture-level change. The new pieces are: a small loader module under `app/main/domains/execution/`, an updated `CodexCliRunner` constructor signature, a doctrine parser module reused by both the grader and the prompt-fragment unit tests, the rewritten bench script, the eight migrated `SKILL.md` files, the new `docs/editorial-doctrine.md`, and the new `docs/editorial-iteration-playbook.md`.
**Performance Goals**: SC-001 — editing a `SKILL.md` file and re-running a single skill invocation takes under 3 seconds elapsed (target: ≈ 1 second, dominated by Codex CLI cold start). SC-002 — one full prompt iteration loop under 5 minutes including editing, running the bench, reading the report, and reverting if the change was wrong.
**Constraints**: Byte-for-byte identical migration of prompts (FR-002, no editorial improvement during this feature). No new secrets (FR-025). No regression on existing 298+ unit tests, npm audit, real-app audit, verify-hardening, or 3-OS CI (FR-023). No `Co-Authored-By` trailer in any commit (FR-026, session feedback rule). Strict mechanical migration first, optimisation work later as post-ship editorial loop.
**Scale/Scope**: 8 skills × 1 SKILL.md migration each, 12 fixtures × 1 grading run each per benchmark invocation, 1 doctrine source file, 1 playbook document, ~3 new TypeScript modules under `app/main/domains/execution/`, ~3 new Vitest test files under `tests/unit/`, 1 rewritten bench script. Estimated +1500 lines of new content (mostly markdown prompts being migrated and the doctrine + playbook documentation), -150 lines of inline prompts removed from `codex-cli-runner.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|---|---|---|
| **I — Local-First and Confidential by Default** | ✅ PASS | The doctrine source, prompts, and benchmark report all live as files inside the repository or in `dist-eval/`. No remote service is introduced. The benchmark calls the operator's local Codex CLI (already authenticated via OAuth), no new credential is added. |
| **II — Workflow Before Prompting** | ✅ PASS | The feature reinforces the workflow-driven nature of the product by making each editorial step (skill) a first-class versioned artifact (`SKILL.md`) instead of a hidden TypeScript constant. Contributors edit the workflow vocabulary directly. |
| **III — Specialized Skills with Structured I/O** | ✅ PASS — strengthened | Each `SKILL.md` keeps its existing structural sections (Purpose, Inputs, Outputs) and gains an explicit `## Prompt` section. The skill is now described in one cohesive markdown document instead of being half-stub-half-inline. The runner contract on `SkillRunnerInvocation` and `SkillRunnerResult` is unchanged. |
| **IV — Test-First Development Is Mandatory** | ✅ PASS | Three new unit-test files are written before their corresponding production code: skill-prompt-loader, editorial-doctrine-parser, eval-editorial-grader. The migration of inline prompts to `SKILL.md` is gated by an existing-suite green check before and after — the byte-for-byte identical content guarantees no semantic change, which is itself a TDD safety net. |
| **V — Human Validation Over Autonomous Publishing** | ✅ PASS — strengthened | The benchmark explicitly rejects outputs but never marks them as "ready to publish". The playbook contains an explicit section stating that programmatic checks are necessary but not sufficient and that the human "litmus test" remains the ultimate gate. The bench is local-only and never wired to any auto-publishing path. |
| **VI — Simplicity for MVP, Extensibility for the System** | ✅ PASS | One small loader module, one small parser, one extended bench script, and three documentation files. No new framework, no new database, no new IPC channel. The doctrine and the prompts are accessible via plain markdown — the simplest editable surface possible. |

**Result**: ✅ All six principles satisfied. No violations. Complexity Tracking section will remain empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-editorial-quality-evaluation/
├── plan.md              # This file
├── spec.md              # Feature spec with 5 clarifications integrated
├── research.md          # Phase 0 decisions (D1–D9)
├── data-model.md        # File-system entities + grading rule shape
├── contracts/
│   ├── skill-prompt-loader.md     # Loader API contract
│   ├── editorial-doctrine.md      # Doctrine markdown structural contract
│   ├── grading-grid.md            # Grader rule contract
│   └── eval-report.md             # Output report (md + json) shape
├── checklists/
│   └── requirements.md            # Spec quality checklist
├── quickstart.md        # Verification sequence after merge
└── tasks.md             # Phase 2 output (from /speckit-tasks)
```

### Source Code (repository root)

```text
app/main/domains/execution/
├── codex-cli-runner.ts                 # MODIFIED — constructor accepts SkillPromptLoader; buildSkillPrompt() removed
├── skill-prompt-loader.ts              # NEW — file-based loader, raises SKILL_PROMPT_NOT_FOUND on missing/empty
└── editorial-doctrine-parser.ts        # NEW — parses docs/editorial-doctrine.md into structured lists

skills/
├── linkedin-strategy-foundation/SKILL.md   # MODIFIED — adds ## Prompt section
├── linkedin-topic-generator/SKILL.md       # MODIFIED — same
├── linkedin-structure-selector/SKILL.md    # MODIFIED — same
├── linkedin-hook-engine/SKILL.md           # MODIFIED — same
├── linkedin-post-writer/SKILL.md           # MODIFIED — same
├── linkedin-post-editor/SKILL.md           # MODIFIED — same
├── linkedin-repurpose/SKILL.md             # MODIFIED — same
└── linkedin-news-to-post/SKILL.md          # MODIFIED — same

scripts/
├── benchmark-editorial-quality.mjs     # DELETED or REPLACED by eval-editorial-quality.mjs
├── eval-editorial-quality.mjs          # NEW — bench harness with 12 fixtures + grading grid
└── eval-editorial-fixtures.mjs         # NEW — fixture definitions (4 types × 3 = 12)

tests/unit/
├── skill-prompt-loader.test.ts         # NEW — loader unit tests
├── editorial-doctrine-parser.test.ts   # NEW — doctrine parser unit tests
├── eval-editorial-grader.test.ts       # NEW — grader rule unit tests
└── codex-cli-runner.test.ts            # MODIFIED — constructor now takes default loader, no assertion text changes

docs/
├── editorial-doctrine.md               # NEW — single source of truth for banned/allowed lists
├── editorial-iteration-playbook.md     # NEW — 7-topic playbook for the iteration loop
├── exploitation.md                     # MODIFIED — adds link to playbook
└── (other existing files unchanged)

CONTRIBUTING.md                         # MODIFIED — adds link to playbook
package.json                            # MODIFIED — adds "eval:editorial" script
```

**Structure Decision**: The new modules live next to the runner under `app/main/domains/execution/` because the loader and the doctrine parser are conceptually part of the execution domain (they affect how Codex is invoked). The bench script and its fixtures live under `scripts/` next to the existing benchmark for continuity. The doctrine and playbook live under `docs/` because they are user-facing documentation that contributors will read directly. The eight `SKILL.md` files stay in their current `skills/linkedin-<name>/` locations to preserve the existing convention.

## Complexity Tracking

> No Constitution Check violations. Section left empty per template instructions.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | *(none)* | *(none)* |
