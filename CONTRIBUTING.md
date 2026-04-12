# Contributing to GhostwrAIter

Thank you for considering a contribution to GhostwrAIter. This document describes the development workflow, the quality expectations, and the spec-kit authoring process used by the project.

## Getting started

### Clone and install

```bash
git clone https://github.com/AutomatisIA/GhostwrAIter.git
cd GhostwrAIter
npm ci
npm run rebuild:native:electron
```

The `rebuild:native:electron` step is required because `better-sqlite3` must be compiled against the Electron runtime's Node ABI rather than your host Node version.

### Running the application locally

```bash
npm run dev
```

This launches the Electron shell with Vite hot-reloading the renderer process. The first launch will ask you to point to a workspace directory.

### Running the test suite

```bash
npm test
```

Additional quality gates that must pass before any pull request is merged:

```bash
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=high --omit=dev
npm run real-app-audit        # 14-step end-to-end audit against a packaged app (macOS only)
npm run verify-hardening      # 6 security-hardening checks (macOS only)
```

The full gate is automated in GitHub Actions across macOS, Ubuntu, and Windows for every pull request.

## Commit convention

GhostwrAIter uses [Conventional Commits](https://www.conventionalcommits.org/) for every commit message. The format is:

```
<type>(<scope>): <short summary>

<optional body explaining the why>
```

Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`. Scopes are optional but encouraged — for spec-driven features, use the feature number, e.g., `feat(005): add dependabot configuration`.

## Test-driven development (Constitution IV)

TDD is a **non-negotiable** expectation for any testable business logic in this project. The rule is:

1. Write the test first.
2. Observe it fail for the right reason.
3. Write the minimum implementation that makes it pass.
4. Refactor without changing the test.

A pull request that adds production code without a preceding failing test will be asked to be restructured. When the reviewer cannot clearly trace a test to the code change, they will ask you to add one before merging.

## Editorial iteration

Prompt-iteration work — improving the eight skill prompts that power the editorial workflow — happens through a dedicated loop, separate from regular feature development. Run `npm run eval:editorial` to benchmark prompt quality locally. Read the generated report before opening a pull request that touches `skills/linkedin-*/SKILL.md` or `scripts/eval-editorial-*.mjs`.

## Pull request process

1. Fork the repository and create a branch from `main`. Branch names follow the pattern `NNN-short-description` (e.g., `010-add-export-pdf`).
2. Make your changes on the branch, committing along the way with conventional commit messages.
3. Ensure all local gates pass (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`).
4. Open a pull request targeting `main`. Fill in the pull request template completely — it asks for the linked user story, tests added, screenshots for UI changes, and confirmation of no regression on macOS.
5. GitHub Actions runs the full gate on macOS, Ubuntu, and Windows. Every matrix cell must be green before the pull request is eligible for merge.
6. A maintainer reviews the change. If everything checks out, they will merge.

## Feature workflow

For non-trivial changes (new screen, new IPC handler, new schema migration), please open an issue describing the feature before writing code. Include user stories, acceptance criteria, and any architectural considerations. For small fixes and documentation updates, a direct pull request is fine.

## Reporting issues

Please use the issue templates under `.github/ISSUE_TEMPLATE/`. Blank issues are disabled — pick either "Bug report" or "Feature request" and fill out the template.

For security issues, do not open a public issue. Follow the private disclosure process in [`SECURITY.md`](SECURITY.md).

## Questions

If you are unsure about anything — scope, approach, whether a spec is needed — open a discussion or a draft pull request and ask. It is always better to check early than to finish work that needs to be redone.
