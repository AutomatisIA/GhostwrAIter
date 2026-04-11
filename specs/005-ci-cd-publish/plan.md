# Implementation Plan: CI/CD Multi-OS Pipeline & Open-Source Publication Metadata

**Branch**: `005-ci-cd-publish` | **Date**: 2026-04-11 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-ci-cd-publish/spec.md`

## Summary

Publish LinkedIn Poster as an MIT-licensed open-source repository at `github.com/AutomatisIA/LinkedIn-Poster`. The feature delivers three deliverable clusters: (1) a GitHub Actions pipeline that validates every pull request and push to `main` across macOS, Ubuntu, and Windows runners with strict blocking semantics, (2) the full set of open-source metadata files (LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue templates, PR template) required by GitHub's community standards checklist, and (3) Dependabot configuration for automated weekly dependency refresh with grouped PRs. Technical approach: lean YAML workflows that invoke the project's existing npm scripts rather than reimplementing logic; strict validation via tiny Node.js unit tests that parse the committed YAML and assert structural invariants (TDD-compatible per Constitution IV); no new runtime code, no schema changes, no IPC surface expansion.

## Technical Context

**Language/Version**: YAML 1.2 for GitHub Actions workflows + Markdown for metadata files. No change to TypeScript 6.0.2 / Node 20 / Electron 41.2.0 runtime.
**Primary Dependencies**: GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `softprops/action-gh-release@v2`), Dependabot v2. No new npm dependencies.
**Storage**: N/A — no persistent state introduced by this feature. Workflow artifacts are ephemeral (retained per GitHub's default 90-day policy).
**Testing**: Vitest 4.1.4 — add `tests/unit/ci-workflows.test.ts` that YAML-parses the committed workflow files and asserts the structural contracts listed in `contracts/workflows.md`, and `tests/unit/oss-metadata.test.ts` that asserts presence and minimum content of the metadata files listed in `contracts/metadata.md`.
**Target Platform**: GitHub Actions runners — `macos-latest`, `ubuntu-latest`, `windows-latest` (pinned to `-latest` tags with the understanding that GitHub rotates them; non-reproducibility acknowledged in research D3).
**Project Type**: CI/CD infrastructure + open-source community metadata. No source-code modifications to `app/` are anticipated.
**Performance Goals**: Per-cell CI completion under 30 minutes (SC-002). Typical expected range 12–20 minutes based on current local `npm run test`, `npm run build`, and native rebuild times.
**Constraints**: Zero secrets committed (FR-026), strict 3-OS blocking with no `continue-on-error` (FR-005), draft releases only (FR-012), no code signing (FR-009), no regression on existing gates (FR-024).
**Scale/Scope**: 1 repository, ~100 npm dependencies scanned weekly by Dependabot, up to 2 Dependabot PRs per week after grouping (1 prod + 1 dev), 1 release per milestone triggered manually.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|---|---|---|
| I. Local-First and Confidential by Default | ✅ PASS | Feature introduces no backend service and no remote data plane. GitHub Actions runs stateless validation; no user content ever leaves the repository. |
| II. Workflow Before Prompting | ✅ PASS (N/A) | Infrastructure feature, not a product capability. No UI, no editorial workflow touched. |
| III. Specialized Skills with Structured I/O | ✅ PASS (N/A) | No new skill introduced. Codex runner and existing skills untouched. |
| IV. Test-First Development Is Mandatory | ✅ PASS | Two new Vitest test files (`ci-workflows.test.ts`, `oss-metadata.test.ts`) written **before** the YAML workflows and metadata files they validate. Failing tests observed before implementation, per Constitution IV. |
| V. Human Validation Over Autonomous Publishing | ✅ PASS | `release.yml` creates only `draft` releases (FR-012); the maintainer explicitly flips them to published. No automatic publication path exists. |
| VI. Simplicity for MVP, Extensibility for the System | ✅ PASS | Three workflow files, no custom runner, no self-hosted infrastructure, no code signing. The simplest viable shape that delivers the acceptance criteria. |

**Result**: ✅ All six principles satisfied. No violations to justify in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-ci-cd-publish/
├── plan.md              # This file
├── research.md          # Phase 0 decisions (workflow triggers, cache strategy, etc.)
├── contracts/
│   ├── workflows.md     # Structural contract for ci.yml / package.yml / release.yml
│   └── metadata.md      # Structural contract for LICENSE/README/etc. + dependabot.yml
├── quickstart.md        # How to verify the pipeline after merge
└── tasks.md             # Phase 2 output (produced by /speckit.tasks)
```

Note: **no `data-model.md`** for this feature — infrastructure-only, explicitly stated in the spec under "Key Entities".

### Source Code (repository root)

```text
.github/
├── workflows/
│   ├── ci.yml                          # Push + PR gate, 3-OS matrix
│   ├── package.yml                     # Tag-triggered artifact producer
│   └── release.yml                     # workflow_run + workflow_dispatch only, draft release
├── ISSUE_TEMPLATE/
│   ├── bug_report.md
│   ├── feature_request.md
│   └── config.yml                      # disables blank issues
├── PULL_REQUEST_TEMPLATE.md
└── dependabot.yml                      # Two groups, npm weekly + github-actions monthly

.gitattributes                          # Line-ending normalization (FR-028): `* text=auto eol=lf` + `*.bat text eol=crlf`
LICENSE                                 # MIT, copyright 2026 Philippe Cohen
README.md                               # Rewritten for public audience
CONTRIBUTING.md                         # Clone, install, test, commit convention, TDD, specs/ pointer
CODE_OF_CONDUCT.md                      # Contributor Covenant 2.1, contact@AutomatisIA.fr
SECURITY.md                             # Reporting channel + posture summary + docs/exploitation.md ref

tests/unit/
├── ci-workflows.test.ts                # NEW — parses YAML, asserts structural contract
└── oss-metadata.test.ts                # NEW — asserts metadata files exist and meet contract
```

**Structure Decision**: All infrastructure artifacts live under `.github/` (workflows, templates, config) per GitHub's canonical locations. Top-level metadata files stay at repository root where GitHub's community profile checker expects them. The two new Vitest files live beside existing unit tests under `tests/unit/` so that the existing `npm test` gate validates them automatically on every CI run — this closes the loop between the workflows and their own structural tests.

## Complexity Tracking

> No Constitution Check violations. Section left empty per template instructions.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | *(none)* | *(none)* |
