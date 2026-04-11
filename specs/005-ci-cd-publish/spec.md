# Feature Specification: CI/CD Multi-OS Pipeline & Open-Source Publication Metadata

**Feature Branch**: `005-ci-cd-publish`
**Created**: 2026-04-11
**Status**: Draft
**Input**: User description: "CI/CD multi-OS pipeline via GitHub Actions and the open-source metadata files required to publish the repository at github.com/AutomatisIA/LinkedIn-Poster under the MIT license."

## Clarifications

### Session 2026-04-11

- Q: How should `release.yml` be triggered to avoid racing with `package.yml` when both consume a tag? → A: Only via `workflow_run` on successful completion of `package.yml` or via manual `workflow_dispatch`. Never directly on tag push.
- Q: Should the CI matrix allow a "non-blocking" escape hatch for a temporarily broken OS runner? → A: No. Strict blocking on all three OS from day one. No `continue-on-error`, no manual bypass label. Persistent breakage is fixed by iterating on the workflow.
- Q: Which exact `npm audit` invocation is the canonical gate for CI? → A: `npm audit --audit-level=high --omit=dev`. Production dependencies only, severity threshold `high`, so dev-only CVEs do not block the shipped binary.
- Q: How should Dependabot group npm updates to balance traceability and noise? → A: Two groups — `production-dependencies` and `development-dependencies` — each batching its minor+patch updates into a single weekly PR. Major updates remain ignored.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continuous validation across all supported operating systems (Priority: P1)

A contributor opens a pull request against `main`. Within minutes the pull-request page reports CI status from three independent runners covering macOS, Ubuntu, and Windows. Each runner installs dependencies, rebuilds the Electron native modules, runs type-checking, linting, the unit-test suite, the packaged build, and the npm security audit. The macOS runner additionally runs the headless hardening verification because it depends on Electron window interaction. The pull request cannot be merged while any of the required checks are failing.

**Why this priority**: This is the blocker for publishing the repository. Chantiers 1–4 wrote Windows and Linux code paths that have never been exercised end-to-end on a real runner. Without a green multi-OS pipeline, a first external contributor would immediately break a platform we do not test, and maintainers would have no automated way to detect regressions before shipping. Every other item in this feature is downstream of this loop being trustworthy.

**Independent Test**: Push any commit to a feature branch and open a PR targeting `main`. Observe that three parallel jobs (one per OS) report their outcome on the PR page within the CI provider's SLA. Force a deliberate failure in each gate (type error, lint error, failing test, vulnerable package, broken build) and confirm the pipeline blocks the merge.

**Acceptance Scenarios**:

1. **Given** a pull request with a commit that introduces a TypeScript type error, **When** the CI runs, **Then** all three OS jobs fail at the typecheck step and the PR is blocked from merging.
2. **Given** a pull request with a failing unit test on only one OS (platform-specific regression), **When** the CI runs, **Then** the other two OS jobs succeed and the affected OS reports a failing test job that blocks the merge.
3. **Given** a pull request that introduces a dependency with a known CVE, **When** the CI runs `npm audit`, **Then** every OS job fails at the audit step and the PR is blocked from merging.
4. **Given** a clean commit on `main` that touches only macOS-specific code, **When** the CI runs, **Then** all three OS jobs succeed and the macOS job additionally runs the hardening verification successfully.
5. **Given** a contributor who has never seen this repository before, **When** they open a pull request, **Then** the CI status report is the only signal they need to know whether their change is safe to merge.

---

### User Story 2 - Repository presents all metadata required of a public MIT open-source project (Priority: P1)

A stranger lands on `github.com/AutomatisIA/LinkedIn-Poster` for the first time. Within one minute they can identify what the project does, the license under which they can use it, how to install it on their operating system, how to contribute, how to report a bug or request a feature, how to report a security vulnerability, and what behavior is expected of community members. Every artifact required by GitHub's community standards checklist is present at the canonical path so that the repository surfaces a "green" community profile.

**Why this priority**: The repository becomes public in this iteration. Missing community-profile files are the first thing potential contributors and security researchers notice. Without a LICENSE file the project is legally not open-source. Without SECURITY.md, vulnerability reports go to the wrong place. Without CONTRIBUTING.md, the first PR wastes both parties' time. This is non-negotiable before flipping the repository to public.

**Independent Test**: Open the repository on GitHub (or browse the file tree locally) and confirm that every file in the acceptance list below exists, contains content (not a placeholder), and correctly identifies the project, maintainer, and license. Run GitHub's community profile checker and confirm every item is green.

**Acceptance Scenarios**:

1. **Given** a visitor on the public repository page, **When** they look at the sidebar, **Then** the LICENSE is identified as MIT with copyright "2026 Philippe Cohen".
2. **Given** a visitor reading the README, **When** they scroll through the document, **Then** they find a one-paragraph description of what LinkedIn Poster does, the supported operating systems, install instructions per OS, a link to `docs/exploitation.md` for operational details, and a link to CONTRIBUTING.md.
3. **Given** a contributor clicking "New Issue", **When** the issue form opens, **Then** they are required to pick between "Bug report" and "Feature request" templates and cannot submit an empty issue.
4. **Given** a contributor opening a pull request, **When** the PR form loads, **Then** a checklist is pre-filled covering description, linked user story, tests added, screenshots for UI changes, manual verification steps, and confirmation of no regression on macOS.
5. **Given** a security researcher who has found a vulnerability, **When** they look for reporting instructions, **Then** SECURITY.md tells them exactly which email address or GitHub Security Advisory channel to use and what response time to expect.
6. **Given** a contributor reading CONTRIBUTING.md, **When** they follow the onboarding path, **Then** they can clone the repo, install dependencies, run the tests, understand the commit convention, understand the TDD expectation (Constitution IV), and know where the spec-kit workflow documents live.

---

### User Story 3 - Automated dependency refresh without manual CVE hunting (Priority: P2)

The maintainer receives weekly pull requests from Dependabot when npm dependencies have minor or patch updates available, and monthly pull requests when GitHub Actions versions drift. Each PR is labeled `dependencies` and runs through the full CI gate from User Story 1 before the maintainer decides to merge it. Major version updates are not opened automatically because they often require human judgment for compatibility.

**Why this priority**: Chantier 1 (feature 002) achieved 0 npm audit vulnerabilities manually. Keeping that posture over time requires automation — otherwise new CVEs silently accumulate between manual audits. Dependabot closes this loop. It is priority P2 rather than P1 because the repository can be published without it: the CI from User Story 1 still runs `npm audit` on every PR, so a regression would be caught at the next contribution. Dependabot reduces the time-to-detection from "next PR" to "next weekly cycle".

**Independent Test**: Commit the `.github/dependabot.yml` file, wait for the first automated cycle (or trigger it manually via the Insights → Dependency graph → Dependabot page), and observe that at least one Dependabot PR appears, is labeled `dependencies`, and is subject to the same CI gate as any other PR.

**Acceptance Scenarios**:

1. **Given** a new patch release of a direct npm dependency, **When** the weekly Dependabot cycle runs, **Then** a pull request is opened with the update and the `dependencies` label.
2. **Given** a new major release of a direct npm dependency, **When** the weekly Dependabot cycle runs, **Then** no pull request is opened for that major.
3. **Given** a new version of a GitHub Action used in the workflows, **When** the monthly Dependabot cycle runs, **Then** a pull request is opened updating the action reference.
4. **Given** a Dependabot pull request, **When** CI runs against it, **Then** the same multi-OS gate from User Story 1 executes and blocks the merge if any check fails.

---

### User Story 4 - Packaged artifacts for every supported OS produced from a single tag (Priority: P2)

A maintainer pushes a git tag matching `v*` (for example `v0.1.0`). GitHub Actions automatically produces packaged artifacts for each supported operating system: `.app` for macOS, NSIS installer and portable executable for Windows, AppImage and `.deb` for Linux. Every artifact is uploaded as a GitHub Actions artifact, downloadable from the workflow run page. No code signing is applied in this iteration.

**Why this priority**: Until this pipeline exists, a release requires running `npm run package:mac` on a Mac, `npm run package:win` on Windows, and `npm run package:linux` on Linux. The maintainer has only a Mac, so releases are currently impossible for Windows and Linux. This feature is P2 rather than P1 because the repository can exist publicly with only source distribution while this pipeline is iterated upon; the first external contributor to clone and build locally still has a working experience from User Story 2.

**Independent Test**: Create a lightweight git tag `v0.0.1-test`, push it, and confirm that the `package.yml` workflow runs on all three OS runners, each producing at least one downloadable artifact attached to the workflow run.

**Acceptance Scenarios**:

1. **Given** a git tag `v0.1.0` pushed to `origin`, **When** the package workflow runs, **Then** three parallel jobs each produce their platform-specific artifacts and upload them under the Actions run page.
2. **Given** a failed build on one platform, **When** the package workflow runs, **Then** the other platforms still complete successfully and their artifacts are still uploaded.
3. **Given** a push to `main` without a tag, **When** any workflow is triggered, **Then** the package workflow does not run.

---

### User Story 5 - One-click draft release ready for human review (Priority: P3)

After the packaging workflow from User Story 4 has produced artifacts for a given tag, the maintainer triggers a release workflow (either automatically on tag push or manually via `workflow_dispatch`). The workflow creates a GitHub Release in `draft` state, attaches all packaged artifacts from User Story 4, and leaves the release unpublished so the maintainer can review, write the release notes, and hit "Publish release" themselves.

**Why this priority**: This is convenience automation. A maintainer could create releases manually by uploading the artifacts from User Story 4 through the GitHub UI. Having a workflow that assembles them into a draft release saves ten minutes per release and removes the risk of forgetting an artifact. It is priority P3 because User Stories 1–4 provide end-to-end value without it.

**Independent Test**: Trigger the release workflow manually via `workflow_dispatch` against an existing tag, and verify that a draft release appears on the Releases page with all expected artifacts attached.

**Acceptance Scenarios**:

1. **Given** a tag with packaged artifacts already produced by User Story 4, **When** the release workflow runs, **Then** a new GitHub Release is created in `draft` state with all artifacts attached.
2. **Given** a draft release created by the workflow, **When** the maintainer reviews it, **Then** they can edit release notes and publish manually without running any additional command.
3. **Given** a workflow run that fails to locate any artifact, **When** the release workflow runs, **Then** it reports a clear error and does not create an empty release.

---

### Edge Cases

- **Native module rebuild on Windows runners**: `better-sqlite3` needs a matching Electron ABI. Windows runners may lack the Visual C++ build tools. The CI step must either use a runner image that ships them or install them explicitly before `npm ci`.
- **Line-ending normalization**: Without a committed `.gitattributes`, Windows contributors may introduce CRLF changes that break snapshot tests on Linux. The repository should normalize line endings consistently across the three OS runners.
- **Environment variables with secrets in CI**: The CI jobs under User Story 1 must run with zero secrets. The package and release workflows may rely only on the default `GITHUB_TOKEN` provided by GitHub Actions.
- **A runner is persistently broken**: If Windows or Linux CI breaks in a way we cannot quickly fix, the strict blocking rule from FR-005 still applies. Urgent security fixes require either a workflow-level fix to unblock the affected runner or a temporary remediation commit that addresses the root cause. There is no "non-blocking cell" escape hatch in this iteration.
- **First-time contributor forking the repo**: When a fork's PR runs CI, the GitHub Actions environment has read-only permissions by default. Workflows must not require write permissions for the basic validation path.
- **Dependabot PR noise**: Without guardrails, Dependabot may open dozens of PRs on the first run. Grouping strategy and rate limits should avoid overwhelming the maintainer.
- **npm audit false positives**: A transitively vulnerable dev-only package may be flagged with no upgrade path. The CI must fail loudly rather than silently tolerating such cases; exceptions require an explicit allowlist commit.
- **Release workflow races with package workflow**: If a release is triggered before packaging finishes, artifacts may not yet exist. The release workflow must wait for or depend on the packaging workflow run from the same tag.
- **README screenshots drift**: Placeholder screenshots age fast. The README must either reference stable placeholders or cite the directory where real screenshots will live so future updates have a home.

## Requirements *(mandatory)*

### Functional Requirements

#### GitHub Actions workflows

- **FR-001**: A workflow named `ci.yml` MUST exist under `.github/workflows/` and trigger on `push` and `pull_request` events targeting `main`.
- **FR-002**: The `ci.yml` workflow MUST run jobs in parallel across a matrix of at least three operating systems: macOS (latest available runner), Ubuntu (latest LTS available runner), and Windows (latest available runner).
- **FR-003**: Each matrix job MUST execute the following ordered steps: checkout, install Node 20, run `npm ci`, run `npm run rebuild:native:electron` to rebuild native modules for the Electron target ABI, run `npm run typecheck`, run `npm run lint`, run `npm test`, run `npm run build`, run `npm audit --audit-level=high --omit=dev` with a non-zero exit on any high or critical vulnerability in production dependencies. Dev-only CVEs are intentionally excluded from the blocking gate because they are outside the blast radius of the shipped binary. Each command name is a literal contract — the CI MUST invoke it verbatim, not via a wrapper or inline equivalent.
- **FR-004**: The macOS matrix job MUST additionally run `npm run verify-hardening` after the base steps. The Linux and Windows matrix jobs MUST NOT run this script.
- **FR-005**: Any failing step in any matrix cell MUST cause that cell to fail and MUST block the merge of the associated pull request. No matrix cell MAY use `continue-on-error: true`, no branch-protection bypass label, and no conditional `required-check` promotion is permitted. If a runner becomes persistently broken, the correct remediation is to iterate on the workflow itself — never to silence the check.
- **FR-006**: A workflow named `package.yml` MUST exist under `.github/workflows/` and trigger on `push` events where the git ref matches the pattern `v*`.
- **FR-007**: The `package.yml` workflow MUST run jobs in parallel across the same three-OS matrix and produce packaged artifacts: `.app` on macOS, NSIS installer plus portable executable on Windows, AppImage plus `.deb` on Linux.
- **FR-008**: Every artifact produced by `package.yml` MUST be uploaded as a GitHub Actions artifact with a descriptive name that includes the OS and the git tag.
- **FR-009**: `package.yml` MUST NOT perform code signing, notarization, or any publishing action beyond uploading artifacts to the workflow run.
- **FR-010**: A workflow named `release.yml` MUST exist under `.github/workflows/` and trigger ONLY via (a) a `workflow_run` event fired by a successful completion of `package.yml`, or (b) a manual `workflow_dispatch` invocation. It MUST NOT be triggered directly by a tag push, so that it never races with the packaging workflow on the same tag.
- **FR-011**: The `release.yml` workflow MUST download the artifacts produced by `package.yml` for the originating workflow run (or for the tag supplied via `workflow_dispatch` inputs) and attach them to a GitHub Release created in `draft` state.
- **FR-012**: `release.yml` MUST NOT publish the release automatically; the draft state MUST persist until a human flips it.

#### Open-source metadata files

- **FR-013**: A file `LICENSE` MUST exist at the repository root containing the standard MIT License text with copyright line "Copyright (c) 2026 Philippe Cohen <contact@AutomatisIA.fr>".
- **FR-014**: A file `README.md` MUST exist at the repository root containing, at minimum: a one-paragraph project description, a stack summary (Electron, TypeScript, React, SQLite), prerequisites (Node 20, OS support matrix), install instructions for macOS, Windows, and Linux, a link to `docs/exploitation.md` for detailed operational setup, the license line, and a link to CONTRIBUTING.md.
- **FR-015**: A file `CONTRIBUTING.md` MUST exist at the repository root covering: how to clone the repository, how to install dependencies, how to run `npm test`, the commit convention (conventional commits), the pull request process, the test-driven-development expectation stated in Constitution IV, and a pointer to `specs/` for the spec-kit workflow.
- **FR-016**: A file `CODE_OF_CONDUCT.md` MUST exist at the repository root containing the Contributor Covenant version 2.1 text with the maintainer email `contact@AutomatisIA.fr` as the contact address.
- **FR-017**: A file `SECURITY.md` MUST exist at the repository root documenting: how to report a vulnerability (private channel via email and/or GitHub Security Advisories), the current security posture summary, and a reference to the known limitations listed in `docs/exploitation.md`.
- **FR-018**: A file `.github/ISSUE_TEMPLATE/bug_report.md` MUST exist with fields covering the operating system, the application version, steps to reproduce, expected behavior, actual behavior, and log excerpts.
- **FR-019**: A file `.github/ISSUE_TEMPLATE/feature_request.md` MUST exist with fields covering the use case, the proposed solution, alternatives considered, and additional context.
- **FR-020**: A file `.github/ISSUE_TEMPLATE/config.yml` MUST exist disabling blank issues so that contributors are forced to pick a template.
- **FR-021**: A file `.github/PULL_REQUEST_TEMPLATE.md` MUST exist containing a checklist covering description, linked user story, tests added, screenshots for UI changes, manual verification steps, and explicit confirmation of no regression on macOS.

#### Automated dependency monitoring

- **FR-022**: A file `.github/dependabot.yml` MUST exist configured to check the npm package ecosystem weekly, open pull requests for minor and patch updates only (major updates ignored), label each pull request with `dependencies`, and group updates into exactly two named groups: `production-dependencies` (covering runtime dependencies under `dependencies`) and `development-dependencies` (covering everything under `devDependencies`). Each group MUST batch its minor+patch updates into a single weekly pull request so that the maintainer receives at most two npm PRs per week.
- **FR-023**: The same `.github/dependabot.yml` MUST additionally check the GitHub Actions ecosystem on a monthly cadence so that the actions referenced in the workflows stay current.

#### Non-regression guardrails

- **FR-024**: This feature MUST NOT introduce any regression in the existing gates: `npm audit` MUST still report zero vulnerabilities, `npm test` MUST still pass 215 of 215 tests (or the current count plus any tests added by this feature), typecheck, lint, build, `scripts/real-app-audit.mjs` (14 steps), and `scripts/verify-hardening.mjs` (6 checks) MUST all still succeed on macOS.
- **FR-025**: This feature MUST NOT alter the existing IPC schemas, security hardening, Codex detection, or responsive baseline from features 002, 003, and 004.
- **FR-026**: No secret value of any kind MUST be committed to the repository as part of this feature. Workflows MUST rely only on the `GITHUB_TOKEN` automatically provided by GitHub Actions.
- **FR-027**: The repository name on GitHub MUST remain `LinkedIn-Poster` with preserved casing. The npm package name MUST remain `linkedin-poster` in lowercase per npm convention. Any new documentation MUST reflect this distinction clearly.
- **FR-028**: A file `.gitattributes` MUST exist at the repository root enforcing `* text=auto eol=lf` as the default and `*.bat text eol=crlf` as the exception for Windows batch files. This normalizes line endings across the three OS runners so that the Windows runner cannot silently introduce CRLF drift that breaks snapshot tests or diff comparisons on macOS and Linux.

### Key Entities *(none — infrastructure and documentation only)*

This feature introduces no persistent data, no database schema, and no IPC surface. The only artifacts are workflow YAML files, markdown documents, and a Dependabot configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the first push to `main` after `ci.yml` is merged, the macOS matrix job reports a successful run with all required steps green. Ubuntu and Windows jobs may be iterated upon but must reach success before the feature is declared complete.
- **SC-002**: A pull request that deliberately introduces a type error, a failing test, a lint error, a build failure, or a new CVE is blocked by the pipeline in under 30 minutes on all three OS runners.
- **SC-003**: GitHub's community standards checklist (`/community` tab of the repository) reports every item as green after this feature is merged: description, README, code of conduct, contributing guidelines, license, security policy, issue templates, and pull request template.
- **SC-004**: A brand-new visitor who has never seen the project can identify in under 60 seconds what LinkedIn Poster does, under which license it is available, and how to install it for their operating system.
- **SC-005**: Within 14 days of merging the Dependabot configuration, at least one automated dependency pull request has been opened and passed the CI gate from User Story 1.
- **SC-006**: A git tag matching `v*` triggers the packaging workflow which produces at minimum one downloadable artifact for each of the three supported operating systems.
- **SC-007**: The release workflow, when triggered against a tag that already has packaged artifacts, creates a draft GitHub Release with all artifacts attached and never publishes it automatically.
- **SC-008**: After this feature is merged, the gate numbers reported in FR-024 are still green: zero npm vulnerabilities, full test pass, typecheck clean, lint clean, build succeeds, 14-step real-app audit succeeds, 6-check hardening verification succeeds on macOS.

## Out of Scope

The following items are explicitly excluded from this feature and are deferred to later chantiers:

- Code signing of Windows installers and macOS notarization (deferred to a dedicated publication chantier).
- Automated publication of GitHub Releases (manual review via the `draft` state is the explicit choice here).
- Distribution via package managers such as Homebrew, Scoop, Chocolatey, or `apt` (post-launch).
- A project website or GitHub Pages deployment.
- New end-to-end tests under `tests/e2e/` (the directory stays empty; end-to-end coverage remains `scripts/real-app-audit.mjs`).
- Internationalization of the application UI.
- Code quality refactor work (chantier 4).
- Editorial quality evaluation of generated LinkedIn posts (chantier 3.5).
