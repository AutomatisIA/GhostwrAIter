# Research — Feature 005: CI/CD Multi-OS Pipeline & OSS Metadata

## D1 — Release workflow trigger architecture

**Decision**: `release.yml` triggers exclusively on (a) `workflow_run` events fired by a successful completion of `package.yml`, and (b) manual `workflow_dispatch` invocations. It does NOT trigger directly on tag push.

**Rationale**: Triggering both `package.yml` and `release.yml` on the same tag push creates a race condition — `release.yml` would attempt to `download-artifact` before `package.yml` has finished uploading. The `workflow_run` event is GitHub's canonical solution: it carries the upstream run ID so `release.yml` can download artifacts from the exact packaging run that produced them. Manual `workflow_dispatch` handles the case where the maintainer wants to retry release assembly after a packaging retry without re-pushing a tag.

**Alternatives considered**:

- Tag push triggering both workflows with a `sleep` / `poll` loop inside `release.yml` — fragile, wastes runner minutes, fails on long-running Windows builds.
- Merging packaging and release into a single workflow — couples concerns, harder to re-run just the release step, forces packaging to re-run on every release retry.
- Manual-only `workflow_dispatch` — sufficient for user needs but loses the "tag triggers everything automatically" affordance. Acceptable fallback but Option A is preferable because it still feels automatic from the maintainer's perspective.

## D2 — Matrix blocking strategy

**Decision**: Strict blocking on all three OS matrix cells from day one. No `continue-on-error: true`, no `required` / `optional` distinction, no branch-protection bypass label, no temporary graceful-degradation mode.

**Rationale**: Clarification Q2 explicitly chose strict blocking. The operational risk mentioned in the spec (a persistently broken Windows runner blocking urgent security fixes) is mitigated by fixing the workflow itself rather than introducing a permanent escape hatch that would erode the gate's credibility. The brief's non-negotiable constraint #2 ("Ubuntu and Windows can fail on first attempt; we iterate") explicitly anticipates iteration as the remediation path.

**Alternatives considered**:

- `continue-on-error: true` on Ubuntu and Windows while the pipeline is still being calibrated — rejected because it creates a zone where green CI does not actually mean working code, and because there is no natural moment to flip it back to strict.
- CODEOWNERS-based human override — rejected because it delegates the gate to human judgment on every PR, which defeats the purpose of automation.

## D3 — Runner image pinning

**Decision**: Use `macos-latest`, `ubuntu-latest`, and `windows-latest` without explicit version pinning.

**Rationale**: GitHub rotates the `*-latest` aliases roughly quarterly, always pointing at an actively supported runner image. Pinning to a specific version (e.g., `macos-14`) trades a small gain in short-term reproducibility for a maintenance burden: the moment the pinned version is deprecated, every workflow silently breaks until someone updates the constant. Using `*-latest` accepts minor drift in exchange for zero-touch rotation. If a future incident reveals that unpinned rotation caused a regression, we can re-evaluate then.

**Alternatives considered**:

- Pin to explicit versions (`macos-14`, `ubuntu-24.04`, `windows-2022`) — rejected for the maintenance cost listed above, and because the strict CI gate would catch a breaking rotation on the next PR anyway.
- Use a matrix of multiple versions per OS — rejected, triples runner minutes for no incremental confidence gain given that the product is an Electron desktop app, not a server-side library.

## D4 — npm audit gate scope

**Decision**: Run `npm audit --audit-level=high --omit=dev` in each matrix cell as the canonical security gate.

**Rationale**: Clarification Q3 settled on prod-only audit with `high` threshold. `--omit=dev` excludes vitest, eslint, electron-builder, and similar tools that never ship in the packaged binary, so a dev-only CVE cannot block releases. `--audit-level=high` filters noise: `low` and `moderate` findings are logged in the run output but do not fail the job. This aligns the CI gate with the actual blast radius (code that runs on an end-user's machine).

**Alternatives considered**:

- Full audit (`npm audit` without flags) — generates frequent blocking noise from dev-only dependencies; teams commonly end up disabling the gate.
- Using a separate tool (Snyk, OSV-Scanner) — introduces a new external dependency and potentially a new secret for private databases, violating FR-026.
- Retaining the project's existing `npm audit` script wrapper — the wrapper does not currently use `--audit-level`, so reusing it would not resolve the noise problem.

## D5 — Electron native module rebuild in CI

**Decision**: Every matrix cell runs `npm run rebuild:native:electron` immediately after `npm ci` and before any step that touches `better-sqlite3`. The Windows runner additionally requires the Visual C++ build tools, which are pre-installed on `windows-latest` via the `buildTools` image feature — no extra setup step needed.

**Rationale**: `better-sqlite3` is compiled against a specific Node.js / Electron ABI. The npm install step compiles against the Node ABI of the CI host, but the packaged binary runs in Electron's Node ABI, which differs (documented NODE_MODULE_VERSION mismatch between 141 and 145). Running the rebuild script as a dedicated CI step aligns the installed binary with the Electron target before typecheck/test/build. Testing this in the `npm test` job rather than just in `npm run build` catches ABI drift earlier.

**Alternatives considered**:

- Use `@electron/rebuild` directly in CI without the project's npm wrapper — loses idempotency with local developer flow.
- Skip native rebuild on non-Electron steps (typecheck, lint) — would save a few seconds but creates inconsistent environments between steps.

## D6 — Artifact naming convention

**Decision**: Use the pattern `linkedin-poster-${{ github.ref_name }}-${{ matrix.os }}` for uploaded artifacts. Example: `linkedin-poster-v0.1.0-macos-latest`.

**Rationale**: The artifact name appears in the workflow run UI and in the `download-artifact` call inside `release.yml`. Including the tag (`github.ref_name`) makes it trivial for `release.yml` to scope its download to the originating run, and including the matrix OS name lets a maintainer identify the right binary at a glance without opening the archive.

**Alternatives considered**:

- `build-${{ github.run_id }}` — opaque, forces maintainer to open every archive to figure out which OS it belongs to.
- Platform-specific suffix (`linkedin-poster-v0.1.0.app.zip`) — requires per-OS customization that duplicates logic.

## D7 — Dependabot grouping strategy

**Decision**: Two named groups in `.github/dependabot.yml`:

```yaml
groups:
  production-dependencies:
    dependency-type: "production"
    update-types: ["minor", "patch"]
  development-dependencies:
    dependency-type: "development"
    update-types: ["minor", "patch"]
```

Each group batches its applicable updates into one weekly pull request. Major updates are ignored via `ignore: [{ dependency-name: "*", update-types: ["version-update:semver-major"] }]`.

**Rationale**: Clarification Q4 settled on two groups. Separating prod from dev keeps the maintainer's review burden proportional to risk — production updates deserve careful review of the bundled changes, while development updates can often be batch-merged after green CI. The two-PR-per-week ceiling is tolerable; finer grouping would sacrifice the traceability benefit.

**Alternatives considered**:

- No grouping — one PR per dependency per week; noise overwhelms the maintainer.
- Single `all-npm` group — mixes prod risk with dev churn and hides important prod updates behind a pile of devDep changes.

## D8 — Dependabot GitHub Actions cadence

**Decision**: Monthly `schedule.interval` for the `github-actions` ecosystem with the same `dependencies` label. No grouping needed (small volume of actions).

**Rationale**: GitHub Actions versions drift slowly and breaking changes are rare. Monthly cadence keeps referenced actions current without generating ambient noise. Not grouping is fine because the total count of distinct actions in our workflows is small (roughly 5–7).

**Alternatives considered**:

- Weekly `github-actions` cadence — unnecessary churn for a rarely-updated ecosystem.
- Quarterly — risks falling behind on security advisories for third-party actions.

## D9 — Branch protection rules

**Decision**: Document the required branch-protection configuration in `quickstart.md` but do NOT codify it as part of the feature (GitHub's branch-protection API requires a personal access token that would need to be committed as a secret). The maintainer applies it manually after the workflows land on `main`.

**Rationale**: Committing a PAT or fine-grained token into the repository would violate FR-026. GitHub's built-in "required status checks" UI is the simplest path — the maintainer opens `Settings → Branches → main → Required status checks` and selects the three matrix cells after the first green run. This is a one-time ~2-minute operation, acceptable for an MVP.

**Alternatives considered**:

- Use a GitHub App with repository permissions — over-engineered for a single one-off configuration step.
- Use `terraform-provider-github` — introduces a whole new toolchain for one config line.

## D10 — Metadata files content boundaries

**Decision**: `README.md` is rewritten for the public audience (one-paragraph description, stack summary, per-OS install, license, contribution pointer) but delegates ALL operational depth to `docs/exploitation.md`. `SECURITY.md` references `docs/exploitation.md` for the known limitations list rather than duplicating it. `CONTRIBUTING.md` references `specs/` for the spec-kit workflow rather than duplicating the workflow here.

**Rationale**: Duplicating operational content across README, SECURITY, CONTRIBUTING, and `docs/exploitation.md` creates four places where the same fact can drift. Linking keeps a single source of truth. The public README must still stand alone for a first-time visitor, so it contains the minimum viable context + links for depth.

**Alternatives considered**:

- Self-contained README with inlined install details — hard to keep consistent with `docs/exploitation.md` as the project evolves.
- Move `docs/exploitation.md` content into the root — breaks the existing structure that the maintainer already references from other specs.

## D11 — CODE_OF_CONDUCT.md source

**Decision**: Use the exact text of Contributor Covenant v2.1 from `https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md` with `contact@AutomatisIA.fr` as the designated enforcement contact.

**Rationale**: Contributor Covenant 2.1 is the de-facto standard and what GitHub's community-profile checker recognizes. Writing a custom code of conduct would be unnecessary and would fail the community-standards heuristic.

**Alternatives considered**:

- Custom text — rejected, reinvents the wheel and forfeits the community recognition benefit.
- Older Covenant versions (1.4, 2.0) — rejected, 2.1 is the current recommended version.

## D13 — Line-ending normalization across OS runners

**Decision**: Commit a minimal `.gitattributes` at the repository root containing exactly two lines: `* text=auto eol=lf` as the default, and `*.bat text eol=crlf` as the exception for Windows batch files.

**Rationale**: Without a `.gitattributes`, git relies on each contributor's `core.autocrlf` setting, which differs between Windows and non-Windows defaults. This causes the Windows CI runner to silently check out files with CRLF endings, which can break snapshot tests, diff-based assertions, and text-equality checks on macOS and Linux. Committing the normalization makes the behavior deterministic regardless of runner OS or contributor OS. The `*.bat` exception preserves Windows batch-file semantics where CRLF is required by cmd.exe. This fix was flagged as MEDIUM finding C1 during `/speckit.analyze` on 2026-04-11.

**Alternatives considered**:

- Rely on contributors to set `core.autocrlf` correctly — rejected, brittle and invisible to new contributors.
- Use `.editorconfig` alone — handles editors but not git checkout, so the CRLF problem reappears on the Windows runner.
- Expand the `.gitattributes` with per-extension rules (`.md text eol=lf`, `.ts text eol=lf`, …) — rejected for simplicity. The `* text=auto eol=lf` default covers every text file git already recognizes.

## D12 — LICENSE copyright attribution

**Decision**: Single-line attribution `Copyright (c) 2026 Philippe Cohen <contact@AutomatisIA.fr>` followed by the standard MIT License text.

**Rationale**: Single-maintainer project at this stage. Collective attribution ("LinkedIn Poster contributors") adds no legal clarity while this is a solo effort; if contributors join later, the convention is to add them incrementally without rewriting the attribution line. Email in the copyright header makes the responsible party identifiable.

**Alternatives considered**:

- Collective "LinkedIn Poster contributors" — premature until there is actual shared ownership.
- Corporate attribution "AutomatisIA" — less common for open-source solo projects; using the natural person keeps legal semantics clean.
