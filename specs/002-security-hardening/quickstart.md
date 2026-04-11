# Quickstart — verifying the hardening end-to-end

**Feature**: Security hardening and dependency refresh
**Audience**: maintainer, reviewer, future contributor
**Time budget**: 15 minutes

This quickstart is meant to be followed sequentially by someone who wants to confirm, on a fresh checkout of the `002-security-hardening` branch, that the hardening is in place and has not been loosened by later edits.

## Prerequisites

- The repository cloned.
- Node.js installed at a version compatible with the current Electron target (Node 20+ at the time of writing).
- The `codex` CLI available on `PATH` (not strictly required for the audit run, but required for the end-to-end user journey).

## Step 1 — Install and audit

From the repository root:

```bash
npm install
npm audit
```

**Expected result**: the install completes without an error. The audit reports **zero vulnerabilities** at any severity level (`info`, `low`, `moderate`, `high`, `critical`). If any vulnerability is reported, the feature is not in the state that was shipped and the first thing to do is to read `research.md` decision D13 and follow the contingency.

## Step 2 — Native module rebuild

```bash
npm run rebuild:native:electron
```

**Expected result**: `better-sqlite3` rebuilds against the current Electron target without an error. If this step fails with `NODE_MODULE_VERSION` or similar, read `docs/exploitation.md` section "Limitations — better-sqlite3 / ABI Node".

## Step 3 — Unit and component tests

```bash
npm test
```

**Expected result**: every suite passes. In particular:

- `tests/unit/webpreferences-hardening.test.ts` confirms the mandatory `webPreferences` flags.
- `tests/unit/navigation-guards.test.ts` confirms the navigation handlers block external origins.
- `tests/unit/csp-injection.test.ts` confirms the production and development content policies are injected into the renderer HTML.
- `tests/unit/workspace-service.test.ts` confirms every validation rule for the workspace root variable.
- `tests/unit/codex-cli-runner.test.ts` confirms the `CODEX_CLI_TIMEOUT` error is emitted on simulated SIGTERM and that a subsequent normal call still succeeds.
- `tests/unit/workshop-service.test.ts` confirms the dynamic DDL helper refuses unknown table and column names.

No test is disabled, skipped, or marked as `test.todo` during verification.

## Step 4 — Electron lint

```bash
npm run lint
npm run typecheck
```

**Expected result**: both pass. If the TypeScript upgrade introduced a strictness warning, it is either fixed or the TypeScript version has been frozen at a known compatible major with a written justification in `research.md`.

## Step 5 — Development launch

```bash
npm run dev
```

**Expected result**: the application opens a window. The title bar reads `LinkedIn Poster`. The main screen loads. Navigate through Strategy, Ideas, Workshop, Library, Calendar, Runner, and Settings. Every screen renders without a console error. The browser developer tools are open (expected in dev mode) and the console is quiet except for the development content policy warnings that Vite emits for its own HMR traffic.

**Manual verification of the navigation guard**:

1. Open the developer tools console.
2. Run `window.open('https://example.com', '_blank')`.
3. **Expected**: the function returns `null` (or a window reference that never loads). The renderer window does not navigate. Your default browser opens `https://example.com`.

**Manual verification of the content policy**:

1. In the console, run `const s = document.createElement('script'); s.src = 'https://example.com/attack.js'; document.head.appendChild(s)`.
2. **Expected**: the console prints a CSP violation message. No network request is issued for `attack.js` (verifiable in the Network tab).

## Step 6 — Workspace validation

Quit the application and re-launch it with an invalid workspace root, from a terminal:

```bash
LINKEDIN_POSTER_WORKSPACE_ROOT="./relative/path" npm run dev
```

**Expected**: the application fails to start. The terminal prints a clear error message naming the environment variable and stating that an absolute path is required. No file has been created under `./relative/path`.

Try the same with a traversal-prone path:

```bash
LINKEDIN_POSTER_WORKSPACE_ROOT="/tmp/../etc/linkedin-poster" npm run dev
```

**Expected**: same pattern. The error message names the normalized path and explains the traversal segment. No file has been created at the offending location.

## Step 7 — Codex timeout (optional, requires Codex)

If you want to verify the timeout path, temporarily configure an aggressive value and simulate a hang. From the terminal:

```bash
CODEX_CLI_TIMEOUT_MS=1000 npm run dev
```

Trigger a generation in the Workshop. If your Codex setup responds in under a second, the generation succeeds and you see the result normally; the timeout is configured but not tripped. To actually trip the timeout you can either raise the complexity of the prompt or temporarily replace the `codex` binary on your `PATH` with a script that sleeps and does not respond.

**Expected on timeout**: a typed `CODEX_CLI_TIMEOUT` failure is shown in the Runner, with a message including `1000 ms`. A second generation issued immediately after works normally.

## Step 8 — Packaged build

```bash
npm run build
npm run package:mac
```

**Expected**: the build succeeds. The `dist-app` directory contains a packaged application. Launch it by opening the packaged app bundle. Repeat the manual verification of step 5 against the packaged build. The developer tools are now NOT opened automatically (they are production-gated), and attempting to open them via keyboard shortcut closes them immediately.

## Step 9 — Real-application audit script

```bash
node scripts/real-app-audit.mjs
```

**Expected**: the audit walks every section (strategy, ideas, workshop, library, calendar, runner, settings) without a failure. The audit output ends with a success summary.

## What is not in the quickstart

- Cryptographic verification of the Codex binary. Deferred to a future chantier.
- Encryption of the local SQLite database. Deferred to a future chantier.
- Windows and Linux builds. Scope of chantier 3.
- Schema-level validation of IPC inputs. Scope of chantier 2.

## If a step fails

Stop and investigate. Do not weaken the hardening to make the step pass. The hardening is either correct and the step must be fixed to match, or the hardening is wrong and the spec or plan must be updated in a new commit. Silent loosening of security-relevant code is the opposite of what this feature is trying to achieve.
