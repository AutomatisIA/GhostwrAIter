# Phase 1 — Data Model

**Feature**: Security hardening and dependency refresh
**Branch**: `002-security-hardening`
**Date**: 2026-04-11

This feature introduces no new business entity. It changes how existing data flows across three boundaries: the Codex runner error shape, the workspace bootstrap configuration, and the window configuration. This document captures the shape, invariants, and lifecycle of those changes.

## 1. `SkillRunnerResult` — new error variant

The existing error variant union carried by `SkillRunnerResult` gains one new code.

**Location**: `app/main/domains/execution/skill-runner.service.ts` (existing type) and `app/main/domains/execution/codex-cli-runner.ts` (emitter).

**Type (additive)**:

```ts
type SkillRunnerErrorCode =
  | "CODEX_CLI_FAILED"
  | "CODEX_CLI_INVALID_JSON"
  | "CODEX_CLI_TIMEOUT"          // ← new
  | "SKILL_NOT_FOUND"
  | "CONTRACT_VIOLATION";
```

**New variant shape**:

```ts
{
  status: "failed",
  summary: "Codex CLI execution timed out",
  error: {
    code: "CODEX_CLI_TIMEOUT",
    message: `Codex CLI did not respond within <N> ms. Increase CODEX_CLI_TIMEOUT_MS or verify Codex availability.`
  }
}
```

**Invariants**:

- The `message` field always contains the configured timeout value `<N>` substituted at the time the error is built, so downstream consumers can surface it to the user.
- The error shape conforms to the existing failure contract of `SkillRunnerResult`; no caller needs a new branch to handle it beyond a more specific error-code comparison.
- A `CODEX_CLI_TIMEOUT` result is terminal for the invocation that produced it. It does not imply any state cleanup beyond what the existing `finally` block in the runner already performs (temp directory removal).

**Lifecycle**:

```
request received
      │
      ▼
spawnSync(..., { timeout: N })
      │
      ├── returns with status 0 ──────► succeeded result (no change)
      ├── returns with status ≠ 0 ────► CODEX_CLI_FAILED (existing)
      ├── parse fails ────────────────► CODEX_CLI_INVALID_JSON (existing)
      └── signal == "SIGTERM"
          and status == null ─────────► CODEX_CLI_TIMEOUT (new)
```

## 2. `WorkspaceConfigurationError` — new startup-time exception

**Location**: exported by `app/main/workspace/workspace.service.ts`; thrown by `resolveWorkspaceRoot`.

**Type**:

```ts
export class WorkspaceConfigurationError extends Error {
  constructor(
    public readonly reason:
      | "NOT_ABSOLUTE"
      | "TRAVERSAL_SEGMENT"
      | "PARENT_NOT_FOUND"
      | "PARENT_NOT_WRITABLE",
    public readonly value: string,
    message: string
  ) {
    super(message);
    this.name = "WorkspaceConfigurationError";
  }
}
```

**Invariants**:

- `reason` is always one of the four enumerated values; no generic `UNKNOWN` variant is allowed.
- `value` always contains the original unsanitized input the user provided via `LINKEDIN_POSTER_WORKSPACE_ROOT`. The error messages MUST NOT hide the input — users need to see exactly what they typed in order to fix it.
- `message` is written for a human reading the terminal. It names the environment variable, states what went wrong, and suggests a remediation.
- The error is thrown synchronously during startup, before any file or directory is created. A caller that sees this error MUST abort the application startup.

**Example messages per reason**:

- `NOT_ABSOLUTE`: `"LINKEDIN_POSTER_WORKSPACE_ROOT must be an absolute path; got \"./data\". Provide a full path starting at the filesystem root."`
- `TRAVERSAL_SEGMENT`: `"LINKEDIN_POSTER_WORKSPACE_ROOT resolved to \"/Users/alice/../bob/data\" after normalization, which contains a traversal segment. Provide a canonical path."`
- `PARENT_NOT_FOUND`: `"LINKEDIN_POSTER_WORKSPACE_ROOT points to \"/nonexistent/parent/workspace\" but \"/nonexistent/parent\" does not exist. Create the parent directory or pick a different path."`
- `PARENT_NOT_WRITABLE`: `"LINKEDIN_POSTER_WORKSPACE_ROOT points to \"/usr/lib/workspace\" but \"/usr/lib\" is not writable by the current user. Pick a path under your home directory."`

**Lifecycle**:

```
app.whenReady
      │
      ▼
resolveWorkspaceRoot(userDataPath, env)
      │
      ├── env var absent ─────────► default path (no change)
      ├── env var absolute & safe
      │   and parent writable ────► normalized path
      └── any rule fails ─────────► WorkspaceConfigurationError thrown
                                    (startup aborts upstream)
```

## 3. `WorkspacePathEscapeError` — new defensive exception

**Location**: exported by `app/main/workspace/workspace.service.ts`; thrown by the new `assertUnderRoot(candidate, root)` helper.

**Type**:

```ts
export class WorkspacePathEscapeError extends Error {
  constructor(
    public readonly candidate: string,
    public readonly root: string
  ) {
    super(
      `Refusing to write outside the workspace root. Candidate: "${candidate}", root: "${root}".`
    );
    this.name = "WorkspacePathEscapeError";
  }
}
```

**Invariants**:

- Only thrown when a candidate path, after normalization, is not a descendant of the root.
- Carries both paths so a log consumer can diagnose without re-running the offending code.
- Not expected to fire in normal operation; its presence in a log file is a signal of a bug in a caller (today) or a malicious input (tomorrow).

## 4. Configuration: `CODEX_CLI_TIMEOUT_MS`

**Location**: read at the top of `app/main/domains/execution/codex-cli-runner.ts`, inside `defaultExecutor`.

**Semantics**:

- Type: positive integer, expressed in milliseconds.
- Default: 120 000 (120 seconds).
- Source of truth: environment variable `CODEX_CLI_TIMEOUT_MS`.
- Parsing rules:
  - If the environment variable is absent, use the default.
  - If the environment variable is present but does not parse as a positive integer, use the default and log a warning once at startup.
  - If the environment variable is present and parses as zero or a negative integer, use the default and log a warning once at startup.
  - If the environment variable is present and parses as a finite positive integer, use that value without an upper bound.
- Visibility: documented in `docs/exploitation.md` in the security posture section.

**Invariants**:

- The value is read lazily at each invocation, not cached at module load time, so tests can override it by mutating `process.env` before calling the runner.
- The default is not a constant exported to tests; tests should prefer injecting their own timeout via the `CodexCliCommandExecutor` boundary instead.

## 5. Window configuration — `webPreferences` baseline

**Location**: `app/main/index.ts`, inside `createWindow()`.

**Current shape**:

```ts
{
  preload: join(__dirname, "../preload/index.mjs"),
  sandbox: false
}
```

**Target shape**:

```ts
{
  preload: join(__dirname, "../preload/index.mjs"),
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true
}
```

**Invariants**:

- `sandbox: true` is mandatory. Renderer code runs in a Chromium sandbox.
- `contextIsolation: true` is mandatory and explicit. The preload bridge is the only way for renderer code to reach main-process capabilities.
- `nodeIntegration: false` is mandatory and explicit. Node APIs are not exposed to the renderer directly.
- `webSecurity: true` is mandatory and explicit, even though it is the framework default, so that a reviewer can verify the posture without consulting defaults.

These invariants are enforced by the test `tests/unit/webpreferences-hardening.test.ts`, which instantiates `createWindow` with a stubbed `BrowserWindow` constructor and asserts the recorded options.

## 6. Navigation policy

**Location**: `app/main/index.ts`, after `createWindow()`, before `loadURL`/`loadFile`.

**Policy table**:

| Source event | Target type | Action |
|---|---|---|
| `will-navigate` | same-origin (file:// for prod, `ELECTRON_RENDERER_URL` for dev) | allow |
| `will-navigate` | http(s) external | `preventDefault`, delegate to `shell.openExternal` |
| `will-navigate` | any other origin | `preventDefault`, no delegation |
| `setWindowOpenHandler` | same-origin | `{ action: "allow" }` — not expected in current UI, kept permissive |
| `setWindowOpenHandler` | http(s) external | `shell.openExternal`, then `{ action: "deny" }` |
| `setWindowOpenHandler` | any other origin | `{ action: "deny" }` |

**Invariants**:

- The allowlist of origins is computed once at window creation time and captured in a closure, so it cannot be mutated by renderer code.
- Any URL that is malformed or unparseable is treated as "any other origin" and denied.
- No navigation outside the allowlist ever causes the main window to load external content.

## 7. Content security policy

**Location**: injected into `app/renderer/index.html` at build time by an `electron-vite` transform.

**Format**: a `<meta http-equiv="Content-Security-Policy" content="...">` element inside `<head>`.

**Policies**: see research.md decision D9 for the full production and development policies. They are referenced here, not duplicated.

**Invariants**:

- The production build never emits the development policy, and vice versa. The transform reads `process.env.NODE_ENV` (or the electron-vite build mode) and selects the right one.
- Exactly one CSP meta element is present in the rendered HTML. Duplicates are a configuration error.

## Summary

| Element | Type | New? | Lifecycle |
|---|---|---|---|
| `CODEX_CLI_TIMEOUT` error code | Discriminated union variant | Yes | Emitted on SIGTERM from spawnSync |
| `WorkspaceConfigurationError` | Exception class | Yes | Thrown synchronously during startup |
| `WorkspacePathEscapeError` | Exception class | Yes | Thrown by defensive helper; not expected at runtime today |
| `CODEX_CLI_TIMEOUT_MS` env var | Configuration | Yes | Read per invocation |
| Hardened `webPreferences` | Configuration object | Changed | Applied at window creation |
| Navigation policy | Runtime handlers | Yes | Attached per window, per lifetime |
| Content security policy | Build-time meta injection | Yes | Embedded in the shipped HTML |

No database schema change. No IPC channel change. No new table. No migration.
