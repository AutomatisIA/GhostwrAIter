# Contract: `CODEX_CLI_TIMEOUT` error

**Scope**: internal contract between `codex-cli-runner.ts`, `skill-runner.service.ts`, and every caller that consumes `SkillRunnerResult`.
**Status**: new variant added by feature 002-security-hardening.

## Emission conditions

A `CODEX_CLI_TIMEOUT` error is emitted by `CodexCliRunner.execute()` if, and only if, the underlying synchronous child-process call is terminated by the operating system in response to the `timeout` option passing through. The runner detects this by inspecting the result of the call:

```
result.signal === "SIGTERM" && result.status === null
```

Any other failure (non-zero status, invalid JSON, missing output file) is emitted under a different error code that already exists in the contract.

## Output shape

```json
{
  "status": "failed",
  "summary": "Codex CLI execution timed out",
  "error": {
    "code": "CODEX_CLI_TIMEOUT",
    "message": "Codex CLI did not respond within 120000 ms. Increase CODEX_CLI_TIMEOUT_MS or verify Codex availability."
  }
}
```

The `<N>` placeholder in the message template is substituted at emission time with the effective timeout value in milliseconds. This allows users and log readers to see exactly which value tripped, including when it differs from the default because the environment variable was overridden.

## Preconditions

- The `spawnSync` call was issued with a positive integer `timeout` option read from `CODEX_CLI_TIMEOUT_MS` or the default.
- The child process did not exit on its own before the timeout fired.
- The temporary directory allocated for the invocation is released in the `finally` clause regardless of timeout.

## Postconditions

- A `SkillRunnerResult` object with `status: "failed"` and `error.code: "CODEX_CLI_TIMEOUT"` is returned.
- The temporary directory has been removed.
- No further Codex process remains running.
- The application state is otherwise unchanged: no draft, version, run, or error record is written to SQLite by this error path, because the error is returned to the caller which decides whether and how to persist it.

## Caller obligations

A caller that consumes `SkillRunnerResult` MUST handle a `CODEX_CLI_TIMEOUT` error in the same way it handles other `status: "failed"` results. Specifically, it MUST:

- Not retry the invocation automatically. A retry is the user's decision.
- Surface the error message to the user through the existing Runner or Workshop error-display path.
- Not cache the error or otherwise alter the application's control flow based on the timeout variant specifically.

The current caller code already handles the generic failure case uniformly, so no caller refactor is expected.

## Non-obligations

The contract does NOT require:

- The runner to attempt a graceful cancellation before `SIGTERM`. The `timeout` option of `spawnSync` is hard by design.
- The runner to retry the invocation internally. Retries are a future concern.
- The runner to distinguish timeout-due-to-model from timeout-due-to-network. From the runner's vantage, both look like `SIGTERM` + `status: null`, and there is no reliable way to tell them apart.

## Testing notes

The unit test `tests/unit/codex-cli-runner.test.ts` exercises this contract by injecting a `CodexCliCommandExecutor` that returns `{ status: null, signal: "SIGTERM", stdout: "", stderr: "" }`. The test asserts:

1. The returned `SkillRunnerResult` has `status: "failed"`.
2. The `error.code` is `"CODEX_CLI_TIMEOUT"`.
3. The `error.message` contains the numeric timeout value.
4. A subsequent invocation with a normally-returning executor succeeds, proving the timeout path did not corrupt the runner's internal state.

The test must NOT actually call `spawnSync` with a real timeout — that would make the suite non-deterministic and slow.
