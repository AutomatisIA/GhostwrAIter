# Contract: IPC error code taxonomy

**Scope**: internal contract between the wrapper in `app/main/ipc/register-validated-handler.ts`, the preload unwrap helper in `app/preload/index.ts`, and every test that asserts an error code.
**Status**: new taxonomy introduced by feature 003-ipc-validation.

## Stable codes

These codes are reserved and must not be reused for a different meaning. Adding a new code is a backwards-compatible change; removing or redefining an existing code is a breaking change.

### `IPC_INPUT_INVALID`

**Meaning**: the input payload did not match its schema.
**Origin**: `ZodError` raised during `schema.parse()` or `tupleSchema.parse()`.
**Message template**: `"<field>: <zod message>"` — for example, `"offers.0.name: Required"`.
**`field` property**: set to the path of the first invalid field, in dot notation for object paths and bracket notation for tuple positions (e.g. `"[3].text"` for the `text` field of the fourth tuple element).
**Preload behavior**: thrown `Error` with `name === "IPC_INPUT_INVALID"`, `message === "<zod message> (field: <field>)"`.
**Emitted by**: the wrapper, always, on every schema parse failure.

### `IPC_HANDLER_ERROR`

**Meaning**: the business handler threw an exception that is not a recognized typed error.
**Origin**: any `throw` inside the user-supplied handler function that is not matched by `KNOWN_ERROR_CODE_MAP`.
**Message template**: `"Unexpected handler error: <original error message>"`.
**`field` property**: absent.
**Preload behavior**: thrown `Error` with `name === "IPC_HANDLER_ERROR"`.
**Emitted by**: the wrapper's catch block when classification does not match any passthrough.

### `IPC_HANDLER_UNAVAILABLE`

**Meaning**: no handler is registered for the requested channel.
**Origin**: reserved. Not emitted by the current implementation because Electron's `ipcMain` rejects the call at a lower layer with its own error message. Kept in the taxonomy as a reserved code for a future custom registry that would want to surface this condition through the envelope.
**Message template**: `"No handler registered for channel <channel>"`.
**`field` property**: absent.
**Preload behavior**: would throw `Error` with `name === "IPC_HANDLER_UNAVAILABLE"`. In practice, current Electron behavior surfaces this condition as a plain rejected promise with Electron's own message, which the preload catches and re-throws as-is.
**Emitted by**: nothing in this feature; reserved for future use.

### `IPC_TIMEOUT`

**Meaning**: the handler did not complete within an internal deadline.
**Origin**: reserved. Not emitted by the current implementation because handlers are synchronous from the main process's perspective (they await synchronously and do not have a wall-clock budget).
**Preload behavior**: would throw `Error` with `name === "IPC_TIMEOUT"`. Not expected to fire today.
**Emitted by**: nothing in this feature; reserved for a future asynchronous runner that would want to enforce a per-request deadline.

## Passthrough codes

These codes are not defined by this feature. They originate in other features' typed error classes and are preserved by the wrapper so the renderer sees the same vocabulary.

### `WORKSPACE_CONFIGURATION_INVALID`

**Source**: `app/main/workspace/workspace.service.ts` — class `WorkspaceConfigurationError` introduced by feature 002.
**Lookup key**: `"WorkspaceConfigurationError"` (the constructor name).
**Emitted when**: the class is thrown from the business handler during a per-request invocation. Today this is never the case — the class is only thrown at startup by `resolveWorkspaceRoot`, which runs outside the IPC path. Preserved in the table anyway so that a future change that wires workspace revalidation to an IPC call (e.g. a "reload workspace" button) surfaces correctly.

### `WORKSPACE_PATH_ESCAPE`

**Source**: `app/main/workspace/workspace.service.ts` — class `WorkspacePathEscapeError` introduced by feature 002.
**Lookup key**: `"WorkspacePathEscapeError"`.
**Emitted when**: a path builder calls `assertUnderRoot` with a candidate outside the workspace root. Not exercised by any current code path. Preserved in the table as defense in depth.

## Codes NOT in the passthrough table (explained)

### Codex CLI failures (`CODEX_CLI_FAILED`, `CODEX_CLI_INVALID_JSON`, `CODEX_CLI_TIMEOUT`)

These codes exist in feature 002's `SkillRunnerResult.error.code`, but they are **not** thrown as exceptions. They are carried by the `status: "failed"` variant of the result object that the runner returns. From the wrapper's vantage, a handler that invokes a Codex skill returns either a successful result object or a failed result object — both are "successful handler returns" and both flow through the envelope as `{ ok: true, data: <SkillRunnerResult> }`. The renderer then distinguishes `data.status === "succeeded"` from `data.status === "failed"` using the existing code path.

This is intentional and documented. It preserves the strict-Codex-execution doctrine (FR-018 of feature 002) without introducing an alternative failure channel.

## Adding a new code

When a future feature introduces a new error code:

- **If the code comes from a typed error class thrown by the business layer**: add the class name to `KNOWN_ERROR_CODE_MAP` in `register-validated-handler.ts` and add a passthrough test to `register-validated-handler.test.ts`.
- **If the code comes from the wrapper itself**: define it as a string constant, document it in this file (append to the "Stable codes" section), and add a test for its emission.
- **If the code comes from a result-carrying handler** (like the Codex runner): no change to the wrapper or the taxonomy. The code flows through as payload data.

## Non-obligations

- The taxonomy does not enforce a maximum message length. The wrapper truncates to 80 characters **only for the log**, not for the envelope returned to the renderer.
- The taxonomy does not prescribe a message language. Existing messages are in French where the surrounding code is French and in English where it is English; internationalization is out of scope for this feature.
- The taxonomy does not define severity. Severity is a log-level concern and is handled separately in the wrapper (`warn` vs `error`).
- The taxonomy does not define actionable hints for the renderer. Each screen decides how to react to each code; the wrapper just makes the code reachable.
