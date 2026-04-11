# Contributing to LinkedIn Poster

Thank you for considering a contribution to LinkedIn Poster. This document describes the development workflow, the quality expectations, and the spec-kit authoring process used by the project.

## Getting started

### Clone and install

```bash
git clone https://github.com/AutomatisIA/LinkedIn-Poster.git
cd LinkedIn-Poster
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

LinkedIn Poster uses [Conventional Commits](https://www.conventionalcommits.org/) for every commit message. The format is:

```
<type>(<scope>): <short summary>

<optional body explaining the why>
```

Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`. Scopes are optional but encouraged — for spec-driven features, use the feature number, e.g., `feat(005): add dependabot configuration`.

## Test-driven development (Constitution IV)

TDD is a **non-negotiable** expectation for any testable business logic in this project. The rule — codified as Constitution IV in `.specify/memory/constitution.md` — is:

1. Write the test first.
2. Observe it fail for the right reason.
3. Write the minimum implementation that makes it pass.
4. Refactor without changing the test.

A pull request that adds production code without a preceding failing test will be asked to be restructured. When the reviewer cannot clearly trace a test to the code change, they will ask you to add one before merging.

## Pull request process

1. Fork the repository and create a branch from `main`. Branch names follow the pattern `NNN-short-description` where `NNN` is the feature number from the `specs/` directory when applicable.
2. Make your changes on the branch, committing along the way with conventional commit messages.
3. Ensure all local gates pass (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`).
4. Open a pull request targeting `main`. Fill in the pull request template completely — it asks for the linked user story, tests added, screenshots for UI changes, and confirmation of no regression on macOS.
5. GitHub Actions runs the full gate on macOS, Ubuntu, and Windows. Every matrix cell must be green before the pull request is eligible for merge.
6. A maintainer reviews the change. If everything checks out, they will merge.

## Spec-kit workflow

LinkedIn Poster uses a structured spec-first workflow for non-trivial features. Every feature lives in a numbered directory under [`specs/`](specs/) and follows this sequence:

1. **Specify** — capture user stories, requirements, and acceptance criteria in `spec.md`.
2. **Clarify** — resolve ambiguities through a short question-and-answer loop recorded in the spec.
3. **Plan** — produce a technical plan (`plan.md`) with architecture decisions and constitution compliance check.
4. **Research** — document technical decisions and alternatives in `research.md`.
5. **Tasks** — break the plan into actionable, test-first tasks in `tasks.md`.
6. **Analyze** — cross-artifact consistency check before implementation.
7. **Implement** — execute the tasks following TDD.

Browse `specs/` to see prior features. If your change is non-trivial (new IPC handler, new screen, new schema migration, new workflow), please author a spec before writing code. For small fixes and documentation updates, a spec is not required.

## Reporting issues

Please use the issue templates under `.github/ISSUE_TEMPLATE/`. Blank issues are disabled — pick either "Bug report" or "Feature request" and fill out the template.

For security issues, do not open a public issue. Follow the private disclosure process in [`SECURITY.md`](SECURITY.md).

## Questions

If you are unsure about anything — scope, approach, whether a spec is needed — open a discussion or a draft pull request and ask. It is always better to check early than to finish work that needs to be redone.
