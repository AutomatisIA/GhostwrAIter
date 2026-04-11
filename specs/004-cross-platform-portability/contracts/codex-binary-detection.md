# Contract: `findCodexBinary` cross-platform Codex CLI detection

**Scope**: internal contract between `app/main/domains/execution/find-codex-binary.ts` and `app/main/domains/execution/codex-cli-runner.ts`.
**Status**: new helper introduced by feature 004-cross-platform-portability.

## Signature

```ts
export type FindCodexBinaryDeps = {
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly existsSync?: (path: string) => boolean;
  readonly homedir?: () => string;
};

export function findCodexBinary(deps?: FindCodexBinaryDeps): string | null;
```

All four dependency fields are optional. Defaults:

- `env` → `process.env`
- `platform` → `process.platform`
- `existsSync` → `node:fs.existsSync`
- `homedir` → `node:os.homedir`

Returns the absolute path to the first existing Codex binary found, or `null` if no candidate path contains the binary.

## Platform lookup order

On **darwin**:

1. Every entry in `env.PATH` split by `:`
2. `/opt/homebrew/bin`
3. `/usr/local/bin`
4. `${homedir()}/.local/bin`

Binary name: `codex`.

On **linux** (and any other non-Windows platform as a safe default):

1. Every entry in `env.PATH` split by `:`
2. `/usr/local/bin`
3. `/usr/bin`
4. `${homedir()}/.local/bin`

Binary name: `codex`.

On **win32**:

1. Every entry in `env.PATH` split by `;` (the Windows separator)
2. `${env.ProgramFiles}\\Codex\\bin` (if `ProgramFiles` is set in env)
3. `${env.LOCALAPPDATA}\\Programs\\codex` (if `LOCALAPPDATA` is set in env)
4. `${homedir()}\\AppData\\Local\\Programs\\codex` (fallback when the env var is absent)

Binary name: `codex.exe`.

## Invariants

- The helper performs **only path existence checks**, no command execution. It never spawns a process. It returns a path **candidate** the caller may then choose to invoke.
- The helper deduplicates candidate directories in the order they appear. If a directory appears in PATH and also as a conventional fallback, it is probed once.
- The helper returns the **first** existing binary and stops. It does not verify the binary is runnable, has correct permissions, or returns a valid version — those concerns belong to the existing `isAvailable()` check in the runner.
- On any platform, an empty or absent PATH env variable is handled gracefully: the helper skips straight to the conventional fallbacks without throwing.
- On Windows, the helper accepts `codex.exe` OR `codex` as the binary name in PATH entries (some contributors may have the binary on their PATH without the `.exe` suffix).
- When the helper cannot find the binary anywhere, it returns `null`. It does not throw. The caller uses this to surface "Codex unavailable" via the existing `isAvailable()` and diagnostics paths.

## Integration with `codex-cli-runner.ts`

The existing `buildCodexCliPath(existingPath)` function is **removed**. The existing `defaultExecutor(args, input)` function changes its spawn behavior:

**Before**:
```ts
function defaultExecutor(args, input) {
  const result = spawnSync("codex", args, {
    ...
    env: { ...process.env, PATH: buildCodexCliPath() }
  });
  ...
}
```

**After**:
```ts
function defaultExecutor(args, input) {
  const resolved = findCodexBinary();
  const command = resolved ?? "codex";
  const result = spawnSync(command, args, {
    ...
    env: process.env,
    timeout: resolveCodexCliTimeoutMs()
  });
  ...
}
```

The `isAvailable()` method continues to call `defaultExecutor(["login", "status"], "")`; its behavior is unchanged except that it now uses the resolved path when available.

## Testing contract

The test file `tests/unit/find-codex-binary.test.ts` must cover at minimum:

1. `darwin` + PATH contains `/opt/homebrew/bin` + binary exists there → returns `/opt/homebrew/bin/codex`.
2. `darwin` + PATH empty + binary exists at `/opt/homebrew/bin/codex` → returns `/opt/homebrew/bin/codex` (fallback kicks in).
3. `darwin` + binary exists at `/usr/local/bin/codex` but not at `/opt/homebrew/bin/codex` → returns `/usr/local/bin/codex`.
4. `linux` + PATH contains `/usr/local/bin` + binary exists → returns the path.
5. `linux` + binary exists only at `$HOME/.local/bin/codex` → returns that path.
6. `win32` + PATH contains a directory with `codex.exe` → returns the full path with `.exe` extension.
7. `win32` + binary exists at `%ProgramFiles%\Codex\bin\codex.exe` → returns that path.
8. Any platform + no binary exists anywhere → returns `null`.
9. Any platform + env.PATH undefined → does not throw, falls back to the conventional directories only.
10. The helper does not touch the real filesystem: the `existsSync` mock is the only source of truth.

## Preconditions

- The helper is called from main-process code only. It is not exposed to the preload or the renderer.
- The helper runs **once per invocation** (not cached). Caching is a future optimization and is not required.

## Non-obligations

- The helper does NOT verify the Codex binary's version.
- The helper does NOT attempt to authenticate or log in.
- The helper does NOT probe `~/.config/codex` or any other user state.
- The helper does NOT search recursively inside subdirectories of the conventional fallback paths.
- The helper does NOT attempt to install Codex if missing.
