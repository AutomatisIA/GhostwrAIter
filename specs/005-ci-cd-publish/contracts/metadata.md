# Contract — Open-Source Metadata & Dependabot Configuration

This document defines the structural contract that every open-source metadata file and the Dependabot configuration must satisfy. The automated test `tests/unit/oss-metadata.test.ts` asserts every invariant below. Any change that breaks this contract MUST update the test in the same commit.

## `LICENSE` (repository root)

- MUST exist at `./LICENSE` (no extension, GitHub's canonical location).
- MUST contain the exact copyright line: `Copyright (c) 2026 Philippe Cohen <contact@AutomatisIA.fr>`.
- MUST contain the MIT License permission paragraph beginning with `Permission is hereby granted, free of charge, to any person obtaining a copy`.
- MUST contain the warranty disclaimer paragraph beginning with `THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND`.
- Total length MUST be between 800 and 1500 characters (standard MIT text).

## `README.md` (repository root)

- MUST exist at `./README.md`.
- MUST start with a top-level heading `# LinkedIn Poster` (canonical project name with preserved casing per FR-027).
- MUST contain a one-paragraph description mentioning: local-first, Electron, LinkedIn editorial cockpit.
- MUST contain a `## Stack` or `## Technologies` section listing: Electron, TypeScript, React, Vite, SQLite.
- MUST contain a `## Prerequisites` section mentioning Node.js 20.
- MUST contain a `## Installation` section with per-OS subsections for macOS, Windows, and Linux.
- MUST contain at least one link to `docs/exploitation.md` for operational depth.
- MUST contain a `## License` section mentioning MIT.
- MUST contain a link to `CONTRIBUTING.md`.
- MUST NOT contain placeholder text like `TODO`, `TKTK`, `<placeholder>`, or `LOREM IPSUM`.

## `CONTRIBUTING.md` (repository root)

- MUST exist at `./CONTRIBUTING.md`.
- MUST describe how to clone the repository.
- MUST describe how to install dependencies (`npm ci`).
- MUST describe how to run the test suite (`npm test`).
- MUST mention conventional commits as the commit message convention.
- MUST mention the test-driven-development expectation and reference Constitution IV.
- MUST contain a link pointing at `specs/` to introduce the spec-kit workflow.

## `CODE_OF_CONDUCT.md` (repository root)

- MUST exist at `./CODE_OF_CONDUCT.md`.
- MUST contain the text `Contributor Covenant` in its opening section (so GitHub's community profile checker recognizes it).
- MUST contain the text `version 2.1` (or `v2.1`) to identify the Covenant version.
- MUST contain the exact contact email `contact@AutomatisIA.fr` in the enforcement contact section.

## `SECURITY.md` (repository root)

- MUST exist at `./SECURITY.md`.
- MUST contain a `## Reporting a Vulnerability` section (or equivalent English heading GitHub recognizes).
- MUST mention the private reporting channel: at least one of (a) the email `contact@AutomatisIA.fr`, (b) the GitHub Security Advisories feature.
- MUST contain a reference to `docs/exploitation.md` for the known-limitations list.
- MUST document an expected response-time window (e.g., "acknowledged within 72 hours").

## `.github/ISSUE_TEMPLATE/bug_report.md`

- MUST exist at the canonical path.
- Front matter MUST include `name: Bug report` and `labels: bug`.
- Body MUST include distinct sections for: operating system, application version, steps to reproduce, expected behavior, actual behavior, logs.

## `.github/ISSUE_TEMPLATE/feature_request.md`

- MUST exist at the canonical path.
- Front matter MUST include `name: Feature request` and `labels: enhancement`.
- Body MUST include distinct sections for: use case, proposed solution, alternatives considered, additional context.

## `.github/ISSUE_TEMPLATE/config.yml`

- MUST exist at the canonical path.
- MUST contain `blank_issues_enabled: false` to force template usage.
- MAY contain `contact_links` entries pointing at SECURITY.md, documentation, and similar guidance.

## `.github/PULL_REQUEST_TEMPLATE.md`

- MUST exist at the canonical path.
- MUST contain a checklist with at least the following items (order not enforced):
  - Description of the change.
  - Link to or mention of the user story / FR covered.
  - Tests added.
  - Screenshots for UI changes (or explicit "N/A").
  - Manual verification steps performed.
  - Confirmation of no regression on macOS (`scripts/real-app-audit.mjs`, `scripts/verify-hardening.mjs`).

## `.gitattributes` (repository root)

- MUST exist at `./.gitattributes`.
- MUST contain the literal line `* text=auto eol=lf` as the default text normalization.
- MUST contain the literal line `*.bat text eol=crlf` so that Windows batch files retain CRLF semantics.
- The file SHOULD be minimal — only these two patterns — unless a future feature has a justified reason to expand it.

## `.github/dependabot.yml`

- MUST exist at the canonical path.
- Top-level `version: 2`.
- MUST contain exactly TWO `updates:` entries:
  1. `package-ecosystem: "npm"` at `directory: "/"` with:
     - `schedule.interval: "weekly"`
     - `labels: ["dependencies"]`
     - `ignore:` entry that ignores `version-update:semver-major` for `dependency-name: "*"`
     - `groups:` block with exactly two groups named `production-dependencies` and `development-dependencies`. The first covers `dependency-type: "production"`, the second covers `dependency-type: "development"`. Both restrict to `update-types: ["minor", "patch"]`.
  2. `package-ecosystem: "github-actions"` at `directory: "/"` with:
     - `schedule.interval: "monthly"`
     - `labels: ["dependencies"]`
     - `ignore:` entry that ignores `version-update:semver-major` for `dependency-name: "*"`.
- MUST NOT contain a third `package-ecosystem` entry (no cargo, no docker, no pip — this is a pure Node project).

## Global invariants

- Every file listed above MUST be committed as a tracked file under git (no `.gitignore` rule that would exclude them).
- Every markdown file MUST be non-empty (minimum 200 characters) to prevent placeholder stubs from slipping through.
- The test harness MAY read the files from disk using `fs.readFileSync` and may use `yaml`-parser for `.yml` files; no custom linting required beyond the invariants above.
