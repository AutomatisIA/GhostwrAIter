# Contract: `registerValidatedHandler` and `registerValidatedTupleHandler`

**Scope**: internal contract between the registration call site in each `app/main/ipc/*.ts` file and the wrapper module `app/main/ipc/register-validated-handler.ts`.
**Status**: new helpers introduced by feature 003-ipc-validation.

## Signatures

### Single-input variant

```ts
export function registerValidatedHandler<TInput, TOutput>(
  ipcRegistrar: IpcRegistrar,
  channel: string,
  schema: ZodType<TInput>,
  handler: ValidatedIpcHandler<TInput, TOutput>
): void;
```

### Tuple-input variant

```ts
export function registerValidatedTupleHandler<
  TArgs extends readonly unknown[],
  TOutput
>(
  ipcRegistrar: IpcRegistrar,
  channel: string,
  tupleSchema: ZodTuple<TArgs>,
  handler: ValidatedIpcTupleHandler<TArgs, TOutput>
): void;
```

## Behavior of `registerValidatedHandler`

When called, the function:

1. Registers a handler with `ipcRegistrar.handle(channel, ...)`.
2. The registered handler receives the Electron `event` (ignored) and exactly one `input` argument.
3. The registered handler calls `schema.parse(input)`. On failure, it returns `{ ok: false, error: { code: "IPC_INPUT_INVALID", message, field } }`.
4. On success, it calls the user-supplied `handler(parsed)` inside a try/catch.
5. The user-supplied handler may be synchronous or asynchronous; the registered handler always awaits.
6. On handler success, it returns `{ ok: true, data: <handler return value> }`.
7. On handler failure, it classifies the thrown value:
   - If the thrown value's class name or `name` property matches a key in `KNOWN_ERROR_CODE_MAP`, the envelope uses the mapped code and the thrown value's `message`.
   - Otherwise, the envelope uses `IPC_HANDLER_ERROR` as the code and a message of `"Unexpected handler error: <original>"`.
8. It logs via electron-log at the appropriate level (`warn` for validation failures, `error` for handler failures), with the channel name, the error code, and a truncated error message (max 80 chars) — **never the payload content**.

## Behavior of `registerValidatedTupleHandler`

When called, the function:

1. Registers a handler with `ipcRegistrar.handle(channel, ...)`.
2. The registered handler receives the Electron `event` (ignored) and the spread of positional arguments.
3. It assembles the positional arguments into an array: `const inputTuple = [...args]`.
4. It calls `tupleSchema.parse(inputTuple)`. On failure, it returns the same `IPC_INPUT_INVALID` envelope, with the `field` set to a tuple-index path (`"[3]"` for the fourth argument, or `"[3].text"` when the invalid path is nested inside a tuple element).
5. On success, it calls `handler(...parsed)`, spreading the parsed tuple as positional arguments.
6. Success, error classification, and logging follow the same rules as `registerValidatedHandler`.

## `KNOWN_ERROR_CODE_MAP` — the passthrough table

The mapping is declared inside `register-validated-handler.ts` as a `ReadonlyMap`:

```ts
const KNOWN_ERROR_CODE_MAP: ReadonlyMap<string, string> = new Map([
  ["WorkspaceConfigurationError", "WORKSPACE_CONFIGURATION_INVALID"],
  ["WorkspacePathEscapeError", "WORKSPACE_PATH_ESCAPE"]
]);
```

The key is the constructor name or `error.name` property of the thrown value. The lookup is deterministic and order-independent.

A future contributor who introduces a new typed error class that deserves passthrough:

1. Adds the class name and target code to the map.
2. Adds a unit test asserting the new passthrough behavior.
3. Updates the `error-code-taxonomy.md` contract.

## Logging contract

| Failure category | Log level | Log message template |
|---|---|---|
| `IPC_INPUT_INVALID` | `warn` | `"[ipc] <channel>: input validation failed (<first invalid field>)"` |
| `IPC_HANDLER_ERROR` | `error` | `"[ipc] <channel>: handler threw (<truncated error message>)"` |
| Passthrough (e.g. `WORKSPACE_CONFIGURATION_INVALID`) | `warn` | `"[ipc] <channel>: <passthrough code> (<truncated message>)"` |

The wrapper MUST NOT log the payload. It MAY log field names for validation failures. It MAY log up to 80 characters of the original error message, truncated and suffixed with `"…"` if longer.

## Preconditions

- `ipcRegistrar` is an object with a `.handle(channel: string, listener: (...args: unknown[]) => unknown | Promise<unknown>): void` method, matching the Electron `ipcMain.handle` signature.
- `channel` is a non-empty string following the `<domain>:<action>` convention established by existing handlers.
- `schema` (or `tupleSchema`) is a valid zod schema, constructed at module load time.
- `handler` is a function of the correct arity (1 for single-input, N for tuple-input).

## Postconditions

After a successful registration:

- `ipcRegistrar.handle(channel, listener)` has been called exactly once with the channel name.
- Subsequent `ipcRenderer.invoke(channel, ...args)` calls are routed through the wrapper.
- The registered listener always returns a promise that resolves to an `IpcResult<TOutput>`, never rejects.

## Non-obligations

- The wrapper does NOT register the same channel idempotently. Calling `registerValidatedHandler(ipc, "foo", ...)` twice on the same `ipc` object causes Electron to throw at the second call. This is intentional — duplicate registration is a programmer error and should be visible.
- The wrapper does NOT cache or memoize handlers. Each invocation parses the input fresh.
- The wrapper does NOT measure handler latency. Profiling is out of scope.
- The wrapper does NOT enforce argument counts on the tuple variant beyond what the schema enforces. A tuple schema of length 3 will reject a 2-element or 4-element input via zod, not via explicit length checks in the wrapper.

## Testing notes

The wrapper's own tests (`tests/unit/register-validated-handler.test.ts`) cover:

1. Valid input with a synchronous handler → `{ ok: true, data }`.
2. Valid input with an asynchronous handler → `{ ok: true, data }`.
3. Missing required field → `{ ok: false, error: { code: "IPC_INPUT_INVALID", field } }`.
4. Wrong type → same envelope.
5. Handler throws a `WorkspaceConfigurationError` → `{ ok: false, error: { code: "WORKSPACE_CONFIGURATION_INVALID" } }`.
6. Handler throws a generic `Error` → `{ ok: false, error: { code: "IPC_HANDLER_ERROR" } }`.
7. Empty-input schema (`z.undefined()`) accepts `undefined` and rejects any other value.
8. Tuple schema of length 3 accepts a 3-element tuple, rejects a 2-element, rejects a 4-element.
9. Tuple schema with a complex element (object inside array inside tuple) correctly reports a nested field path in the envelope's `field` property.
10. Logging: asserts that `electron-log` receives a call with the expected level and template, without the payload content in the message.
