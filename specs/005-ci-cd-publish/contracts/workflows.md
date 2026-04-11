# Contract — GitHub Actions Workflows

This document defines the structural contract that the three workflow YAML files under `.github/workflows/` must satisfy. The automated test `tests/unit/ci-workflows.test.ts` reads the committed YAML files and asserts every invariant below. Any change to the workflows that breaks this contract MUST be accompanied by a matching update to the test.

## `ci.yml` — Continuous Integration gate

### Triggers

- `on.push.branches` MUST contain `main`.
- `on.pull_request.branches` MUST contain `main`.
- No other trigger is permitted (no `workflow_dispatch`, no `schedule`, no tag-based triggers).

### Jobs

- The workflow MUST define exactly one job (name irrelevant, e.g., `ci`).
- That job MUST declare `strategy.matrix.os` with exactly these three entries (in any order):
  - `macos-latest`
  - `ubuntu-latest`
  - `windows-latest`
- `strategy.fail-fast` MUST be `false` so that a failure on one OS does not cancel the other two (the maintainer needs to see which platforms passed).
- The job MUST declare `runs-on: ${{ matrix.os }}`.
- The job MUST NOT declare `continue-on-error: true` at the job or step level. No `continue-on-error` is allowed anywhere in the file.

### Steps (ordered)

The job MUST contain steps that, in the following order:

1. `actions/checkout@v4` — clone the repository.
2. `actions/setup-node@v4` with `node-version: '20'` and `cache: 'npm'`.
3. `run: npm ci`.
4. `run: npm run rebuild:native:electron` — align native modules with the Electron target ABI.
5. `run: npm run typecheck`.
6. `run: npm run lint`.
7. `run: npm test`.
8. `run: npm run build`.
9. `run: npm audit --audit-level=high --omit=dev` — the canonical security gate chosen in Clarification Q3.
10. Conditional `run: npm run verify-hardening` that executes ONLY on macOS, gated by `if: runner.os == 'macOS'`.

### Invariants enforced by the test

- Step names or commands MUST reference each npm script listed above; the test tolerates reordering ONLY where GitHub Actions YAML semantics allow it (e.g., adding non-blocking display steps between the required ones) but typecheck MUST precede lint which MUST precede test which MUST precede build.
- No environment variable of the form `secrets.*` is referenced anywhere in `ci.yml`.
- No step uses `continue-on-error` at any nesting level.

## `package.yml` — Tag-triggered artifact producer

### Triggers

- `on.push.tags` MUST contain at least one pattern matching `v*`.
- No other trigger is permitted (not even `workflow_dispatch`, which is reserved for `release.yml`).

### Jobs

- One job with the same `strategy.matrix.os` as `ci.yml` (three OS entries, `fail-fast: false`).
- `runs-on: ${{ matrix.os }}`.

### Steps

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` with `node-version: '20'` and `cache: 'npm'`.
3. `run: npm ci`.
4. `run: npm run rebuild:native:electron`.
5. Conditional packaging step per OS:
   - macOS: `run: npm run package:mac` (produces `.app`).
   - Ubuntu: `run: npm run package:linux` (produces AppImage + `.deb`).
   - Windows: `run: npm run package:win` (produces NSIS installer + portable executable).
6. `actions/upload-artifact@v4` with:
   - `name: linkedin-poster-${{ github.ref_name }}-${{ matrix.os }}`
   - `path` pointing at the packaged output directory for that OS (the test validates only that a `path` is set; the exact path is delegated to electron-builder conventions).
   - `if-no-files-found: error` so that a silent packaging failure fails the workflow.

### Invariants

- No `secrets.*` reference.
- No `continue-on-error`.
- No code-signing-related step (no `codesign`, no `notarize`, no `electron-notarize`, no environment variable whose name starts with `APPLE_`, `CSC_`, `WIN_CSC_`, etc.).

## `release.yml` — Draft GitHub Release assembler

### Triggers

- `on.workflow_run` MUST reference `package.yml` by name AND restrict to `types: [completed]`.
- `on.workflow_dispatch` MUST exist and accept at least one input: `tag` (the git tag whose artifacts to assemble).
- NO `on.push.tags` entry — `release.yml` MUST NOT trigger directly on tag push. This is the resolution of Clarification Q1.

### Jobs

- One job, `runs-on: ubuntu-latest` (release assembly is platform-agnostic).
- For the `workflow_run` trigger path: `if: github.event.workflow_run.conclusion == 'success'` so that a failed packaging run does not produce a release.

### Steps

1. `actions/checkout@v4`.
2. `actions/download-artifact@v4` — downloads all artifacts from the originating `package.yml` run (via `run-id: ${{ github.event.workflow_run.id }}` for the `workflow_run` path, or via the tag-derived pattern for the `workflow_dispatch` path).
3. `softprops/action-gh-release@v2` (or the official `actions/create-release` equivalent) with:
   - `draft: true` — the resolution of FR-012.
   - `files:` pointing at the downloaded artifact paths.
   - `tag_name` derived from either `github.event.workflow_run.head_branch` or the `workflow_dispatch` input.
   - `token: ${{ secrets.GITHUB_TOKEN }}` — the only permitted secret, provided automatically by GitHub Actions.

### Invariants

- `draft: true` MUST be literally present in the release step configuration.
- `secrets.GITHUB_TOKEN` is the only `secrets.*` reference allowed anywhere in `release.yml`.
- No `continue-on-error`.
- No automatic publishing action (no `draft: false`, no `make_latest: true`, no direct `publish` command).

## Global invariants across all three workflows

- Every workflow file MUST start with `name: <descriptive>` at the top level so GitHub's UI renders a readable label.
- Every workflow MUST declare a top-level `permissions:` block that grants the minimum required scopes. For `ci.yml` and `package.yml`: `contents: read`. For `release.yml`: `contents: write` (required by `action-gh-release` to create the release).
- No workflow references any secret other than `GITHUB_TOKEN`.
- No workflow uses an action published by an author the project has not vetted; the allowlist is `actions/*` (GitHub-owned) and `softprops/action-gh-release` (widely used, audited). Any addition to this allowlist requires a spec amendment.
