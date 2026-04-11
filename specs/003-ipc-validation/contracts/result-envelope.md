# Contract: `IpcResult<T>` — the IPC result envelope

**Scope**: internal contract between the main process IPC layer and the preload bridge. This envelope is produced exclusively by `registerValidatedHandler` (and its tuple variant) and consumed exclusively by the preload `unwrap` helper.
**Status**: new type introduced by feature 003-ipc-validation.

## Shape

```ts
export type IpcResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: IpcError };

export type IpcError = {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
};
```

## Production side (main process wrapper)

The wrapper MUST produce an envelope on every code path:

- **Success**: `{ ok: true, data: <handler return value> }` with `data` unchanged from the handler's return value.
- **Validation failure**: `{ ok: false, error: { code: "IPC_INPUT_INVALID", message: <human-readable>, field: <first invalid path> } }`.
- **Passthrough failure**: `{ ok: false, error: { code: <passthrough code>, message: <original message> } }` when the thrown exception matches a known typed error class.
- **Generic handler failure**: `{ ok: false, error: { code: "IPC_HANDLER_ERROR", message: "Unexpected handler error: <original>" } }` for any other exception.

The wrapper MUST NOT:

- Emit any response outside the envelope shape.
- Let an exception propagate back to the renderer unwrapped.
- Include raw payload content in the `message` field. Field names are allowed; values are not.
- Nest envelopes (`data` must never be an `IpcResult`).

## Consumption side (preload unwrap helper)

The preload helper `unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T>` MUST:

- Return `result.data` when `result.ok === true`.
- Throw an `Error` when `result.ok === false`.
- Set `error.name` to `result.error.code`.
- Set `error.message` to `result.error.message`, optionally prefixed with `"<message> (field: <field>)"` when `result.error.field` is present.

The preload helper MUST NOT:

- Mutate the envelope.
- Catch its own thrown error.
- Swallow the error silently.
- Add context to the message beyond the documented field prefix.

## Invariants

- `ok` is a boolean and is the discriminant. TypeScript narrows correctly from the discriminant alone.
- `data` is structurally serializable: no class instances, no functions, no symbols, no `undefined` fields (Electron's serializer loses undefined).
- `error.code` is always a non-empty string. It is a short screaming-snake-case identifier (e.g., `IPC_INPUT_INVALID`, `WORKSPACE_CONFIGURATION_INVALID`).
- `error.message` is always a non-empty human-readable string. It MAY be in French when the user-facing code path is French; it MAY be in English when the message originates from English-first internal modules. This feature does not normalize the language.
- `error.field` is a string describing a path in the input object using dot notation (`offers.0.name`, `profile.positioning`). It is only set by the wrapper when the underlying `ZodError` provides a `path`.

## Serialization

The envelope crosses the Electron IPC boundary as a JSON-serializable value. Electron's IPC uses the structured clone algorithm, which handles plain objects, arrays, strings, numbers, booleans, and `null`. Every field in the envelope respects this set.

The envelope MUST NOT carry:

- `Error` instances (they do not survive structured clone as-is and lose their `name`, `message`, and `stack`).
- `Date` instances (survive but the receiving side sees a `Date`, not a string — an inconsistency best avoided).
- `Map` / `Set` instances (survive but rarely needed).
- Functions, class instances with prototypes, symbols, `BigInt` (partially supported, best avoided).

## Testing

The envelope is covered by three layers of tests:

1. **Unit tests on the wrapper** (`tests/unit/register-validated-handler.test.ts`): assert that the wrapper produces the correct envelope shape for every outcome.
2. **Unit tests on the preload unwrap helper**: assert that `unwrap` correctly maps each envelope variant to either a returned value or a thrown Error with the right `name` and `message`.
3. **Per-handler tests** (`tests/unit/<domain>-ipc.test.ts`): assert end-to-end that a synthetic invocation through the captured registration produces the expected envelope shape.

## Preconditions

- The wrapper must be the only code that emits envelopes. Any handler that accidentally returns an envelope-shaped object produces a nested envelope and is a bug.
- The preload helper is the only code that consumes envelopes. Any renderer code that inspects envelope shapes directly is a bug.

## Non-obligations

- The envelope does not carry a timestamp. Logging timestamps are the responsibility of electron-log at the main process level.
- The envelope does not carry a correlation ID. Every IPC call is synchronous from the renderer's perspective (it awaits the promise), so correlation is implicit.
- The envelope does not carry a request ID. Same reason.
- The envelope does not carry a retry hint. Retry semantics are a renderer concern.
