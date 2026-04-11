# Quickstart — Verifying Feature 005 End-to-End

This document describes the verification sequence to run after implementing Feature 005. It is designed to give a clear pass/fail outcome for every user story and success criterion in `spec.md`.

## Prerequisites

- You are on branch `005-ci-cd-publish` with all tasks from `tasks.md` completed.
- Local gates are all green: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --audit-level=high --omit=dev`.
- You have push access to `github.com/AutomatisIA/LinkedIn-Poster`.

## Step 1 — Validate the structural tests locally

```bash
npm test -- ci-workflows oss-metadata
```

Expected: both test files pass. Every structural invariant listed in `contracts/workflows.md` and `contracts/metadata.md` is asserted.

If either test fails, the workflow YAML or metadata file does not yet match its contract — fix before pushing.

## Step 2 — Merge the branch into main

Open a pull request, let the pre-existing gates run on your local pre-push hook, then merge. Immediately after the merge, the new `.github/workflows/ci.yml` takes effect on `main`.

## Step 3 — Observe the first `ci.yml` run on main

- Open `https://github.com/AutomatisIA/LinkedIn-Poster/actions` and locate the run for the merge commit.
- Confirm the workflow produced three parallel jobs, one per OS (`macos-latest`, `ubuntu-latest`, `windows-latest`).
- **Expected outcome (SC-001)**: the macOS job finishes green. Ubuntu and Windows MAY require iteration — if they fail, diagnose via the run logs, push a fix commit, and repeat until all three are green.

## Step 4 — Verify CI blocks a deliberate failure (SC-002)

Create a throwaway branch with a deliberate type error:

```typescript
// in any TS file, temporarily:
const x: number = "not a number";
```

Push it, open a PR, and confirm:

- All three matrix jobs fail at the `npm run typecheck` step.
- The PR "Merge" button is disabled because required checks have not passed (requires Step 7 branch-protection setup, or is simulated by observing the red status).

Revert the deliberate failure and close the PR.

## Step 5 — Test the package workflow

Create a lightweight test tag:

```bash
git tag v0.0.1-ci-test
git push origin v0.0.1-ci-test
```

Observe:

- `.github/workflows/package.yml` runs on all three OS runners.
- Each job uploads at least one artifact with a name matching `linkedin-poster-v0.0.1-ci-test-<os>`.
- **Expected outcome (SC-006)**: three artifacts downloadable from the run page.

If any platform fails, iterate until all three green, then delete the test tag:

```bash
git push origin :refs/tags/v0.0.1-ci-test
git tag -d v0.0.1-ci-test
```

## Step 6 — Test the release workflow

After Step 5 produced artifacts, trigger `release.yml` manually:

```bash
gh workflow run release.yml -f tag=v0.0.1-ci-test
```

Observe:

- The release workflow runs and downloads the artifacts from the `workflow_run` context (or from the tag supplied via `workflow_dispatch`).
- A new GitHub Release appears at `https://github.com/AutomatisIA/LinkedIn-Poster/releases` in **draft** state with all artifacts attached.
- **Expected outcome (SC-007)**: the release exists as a draft; no publication happened automatically.
- Delete the test draft release manually once confirmed.

## Step 7 — Configure branch protection on main (one-time manual step)

Per research decision D9, branch protection is configured once in the GitHub UI rather than via code:

1. Go to `Settings → Branches → Add branch protection rule`.
2. Branch name pattern: `main`.
3. Enable `Require a pull request before merging`.
4. Enable `Require status checks to pass before merging` and select:
   - `ci (macos-latest)`
   - `ci (ubuntu-latest)`
   - `ci (windows-latest)`
5. Save.

From this point on, every PR to `main` is strictly blocked unless all three matrix cells are green.

## Step 8 — Verify the community profile checklist (SC-003)

Open `https://github.com/AutomatisIA/LinkedIn-Poster/community` and confirm every item is green:

- Description
- README
- Code of conduct
- Contributing
- License
- Security policy
- Issue templates
- Pull request template

If any item is missing or not recognized, inspect the corresponding file — GitHub's recognizer is strict about file names and location.

## Step 9 — Verify the 60-second first-visitor test (SC-004)

Open the repository in an incognito window and read the README top to bottom. Time yourself. You should be able to answer the following in under 60 seconds:

- What does LinkedIn Poster do?
- Under what license is it distributed?
- How would I install it on my operating system?

If any answer takes longer, the README needs tightening.

## Step 10 — Trigger the first Dependabot cycle (SC-005)

Dependabot auto-runs its first scan within a few hours of the configuration being merged. To accelerate:

1. Go to `Insights → Dependency graph → Dependabot`.
2. For each listed ecosystem (npm, github-actions), click `Check for updates`.

Expected: within 14 days, at least one grouped PR appears labeled `dependencies`, and that PR passes the `ci.yml` gate from Step 3.

## Step 11 — Final regression gate on main (SC-008, FR-024)

After all of the above is green, run the full local gate sequence one last time:

```bash
npm run rebuild:native:electron
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high --omit=dev
npm run real-app-audit
npm run verify-hardening
```

Expected: all gates pass. Test count is at least 215 + N (where N is the test count added by Feature 005's two new test files). No regression in npm audit, no regression in real-app-audit (14 steps), no regression in verify-hardening (6 checks).

## Sign-off criteria

Feature 005 is considered complete when:

- [x] Steps 1 through 11 above all pass.
- [x] Every FR listed in `spec.md` is satisfied.
- [x] Every SC listed in `spec.md` is measurable and measured as satisfied.
- [x] No new files contain placeholder text.
- [x] The `main` branch is pushed to `origin` and the community profile shows all green.
