# Contract: `WorkspaceConfigurationError` and `WorkspacePathEscapeError`

**Scope**: internal contract between `workspace.service.ts` and the Electron `app.whenReady` bootstrap path in `app/main/index.ts`.
**Status**: new behavior added by feature 002-security-hardening.

## Trigger points

### `WorkspaceConfigurationError`

Thrown by `resolveWorkspaceRoot(userDataPath, env)` when the `LINKEDIN_POSTER_WORKSPACE_ROOT` environment variable is present and does not satisfy the validation rules.

The function is called exactly once during startup, from `app/main/index.ts`, before any file or directory is created. The error is propagated up to the top-level startup handler.

### `WorkspacePathEscapeError`

Thrown by the internal helper `assertUnderRoot(candidate, root)` when a candidate path is not a descendant of the root after normalization. This helper is not invoked by any current code path. It is exported for defense in depth so that future contributors building dynamic paths can validate them with a single call.

## Validation rules for `LINKEDIN_POSTER_WORKSPACE_ROOT`

The rules are applied in order. The first rule that fails produces the error; subsequent rules are not evaluated.

| Rule | Failure reason | Short rationale |
|---|---|---|
| If the variable is absent or empty, return the default; no error. | — | The default path lives under the user-data directory chosen by Electron. |
| The value MUST be an absolute path. | `NOT_ABSOLUTE` | Relative paths are ambiguous under different working directories. |
| The value, after `path.resolve`, MUST NOT contain any segment equal to `..`. | `TRAVERSAL_SEGMENT` | `path.resolve` already eliminates `..` segments in well-formed absolute paths. If one survives, the input was ill-formed and would have resolved to an unexpected location. |
| The parent of the resolved path MUST exist. | `PARENT_NOT_FOUND` | The application will not create missing ancestors for safety. |
| The parent of the resolved path MUST be writable by the current user. | `PARENT_NOT_WRITABLE` | Failing at startup is more helpful than failing on the first write attempt. |

## Output shape

```ts
class WorkspaceConfigurationError extends Error {
  readonly reason: "NOT_ABSOLUTE" | "TRAVERSAL_SEGMENT" | "PARENT_NOT_FOUND" | "PARENT_NOT_WRITABLE";
  readonly value: string;
  readonly message: string;
  readonly name: "WorkspaceConfigurationError";
}
```

## Postconditions on error

When `WorkspaceConfigurationError` is thrown:

- No directory has been created under any candidate path.
- No file has been written anywhere.
- No SQLite database has been opened.
- The application startup MUST abort upstream. The top-level startup handler in `app/main/index.ts` is responsible for logging the error and calling `app.exit(1)` (or equivalent), so the user sees the error in the terminal when running from a shell.

## Postconditions on success

When `resolveWorkspaceRoot` returns without throwing:

- The returned value is an absolute path whose parent exists and is writable.
- The returned value is canonical (no `..` segments, no trailing slash unless it is the filesystem root).
- The rest of the workspace bootstrap may proceed: create required subdirectories, open the SQLite database, instantiate services.

## `assertUnderRoot` semantics

Signature (pseudocode):

```ts
function assertUnderRoot(candidate: string, root: string): string
```

Contract:

- Both `candidate` and `root` are resolved via `path.resolve` internally.
- If the resolved candidate is equal to the resolved root or is a strict descendant of it, the function returns the resolved candidate.
- Otherwise, the function throws `WorkspacePathEscapeError(candidate, root)`.

The function performs no filesystem I/O, no syscall — it is a pure path computation. It is safe to call at any time, including inside hot paths.

## Preconditions

None beyond the types being strings.

## Non-obligations

The contract does NOT require:

- The validation to check whether the target directory itself exists. Only the parent is required. This allows the user to pre-create just the parent and let the application create the final directory.
- The validation to check disk quota, filesystem type, or case-sensitivity. These are out of scope.
- The validation to handle symlinks in any special way. `path.resolve` does not follow symlinks; the validation treats a symlinked target the same as a direct target. If symlink trickery becomes a concern in a later chantier, a separate hardening can be added.

## Caller obligations

The startup handler in `app/main/index.ts` MUST:

- Wrap the call to `resolveWorkspaceRoot` in a try/catch that distinguishes `WorkspaceConfigurationError` from other exceptions.
- Log the error message to the terminal (via `console.error` or `electron-log`) so the user sees it when launching from a shell.
- Abort startup with a non-zero exit code when the error is a `WorkspaceConfigurationError`.
- NOT fall back to the default path silently. Silent fallback hides misconfiguration and contradicts the feature's intent.

## Testing notes

The unit test `tests/unit/workspace-service.test.ts` is extended with the following cases:

1. Variable absent → default path returned, no error.
2. Variable is empty string → default path returned, no error.
3. Variable is a relative path (`./workspace`) → `WorkspaceConfigurationError(reason="NOT_ABSOLUTE")`.
4. Variable resolves to a path with a traversal segment (`/tmp/../etc/workspace`) → `WorkspaceConfigurationError(reason="TRAVERSAL_SEGMENT")`.
5. Variable points under a non-existent parent → `WorkspaceConfigurationError(reason="PARENT_NOT_FOUND")`.
6. Variable points under a read-only parent (simulated with a fixture mkdir+chmod) → `WorkspaceConfigurationError(reason="PARENT_NOT_WRITABLE")`.
7. Variable is a valid absolute path under a writable parent → normalized path returned, no error.
8. `assertUnderRoot(candidate, root)` with candidate inside root → returns candidate.
9. `assertUnderRoot(candidate, root)` with candidate outside root → `WorkspacePathEscapeError`.
10. `assertUnderRoot` with `candidate === root` → returns root.

Tests use the real filesystem with a temporary directory as the fixture root, not mocks. Filesystem writes are cleaned up in the `afterEach`.
