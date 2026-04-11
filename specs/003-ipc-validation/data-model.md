# Phase 1 — Data Model

**Feature**: Systematic IPC schema validation
**Branch**: `003-ipc-validation`
**Date**: 2026-04-11

This feature introduces no business entity. It formalizes four shape contracts at the IPC boundary and extends the existing schema directory with six new files. This document captures each shape, its invariants, and its lifecycle.

## 1. `IpcResult<T>` — the envelope

**Location**: exported by `app/main/ipc/register-validated-handler.ts` and imported by `app/preload/index.ts`.

**Shape**:

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

**Invariants**:

- `ok` is the discriminant. Exactly one of the two variants is present for any result.
- In the success variant, `data` is the unmodified return value of the business handler.
- In the failure variant, `error.code` is always set, `error.message` is always a non-empty string, and `error.field` is set only for validation failures (when a specific field was rejected by zod).
- The envelope is JSON-serializable. No class instance, no function, no symbol, no `undefined` (Electron's IPC serializer loses `undefined`).
- The envelope is frozen at construction time in TypeScript (`readonly` fields) but not at runtime — enforcement via the type system only.

**Lifecycle**:

```
IPC request arrives
      │
      ▼
wrapper.parse(schema, input)
      │
      ├── ZodError ────────────────► { ok: false, error: { code: "IPC_INPUT_INVALID", ... } }
      │
      ▼
wrapper.invoke(handler, parsedInput)
      │
      ├── handler returns value ───► { ok: true, data: value }
      │
      └── handler throws
             │
             ├── known typed error ─► { ok: false, error: { code: "<PASSTHROUGH_CODE>", ... } }
             └── other exception ──► { ok: false, error: { code: "IPC_HANDLER_ERROR", ... } }
```

## 2. `ValidatedIpcHandler<TInput, TOutput>` — the handler signature

**Location**: type exported by `app/main/ipc/register-validated-handler.ts`.

**Shape**:

```ts
export type ValidatedIpcHandler<TInput, TOutput> = (
  input: TInput
) => TOutput | Promise<TOutput>;
```

**Invariants**:

- The handler receives exactly one argument, which is the post-validation value of type `TInput`.
- The handler may be synchronous or asynchronous. The wrapper awaits the result regardless.
- The handler SHOULD throw a typed error (from the known-passthrough lookup table) when it wants to surface a specific failure category. It MAY throw any other exception for unexpected failures; the wrapper catches both.
- The handler MUST NOT return a `Promise<IpcResult<T>>`. The envelope is the wrapper's responsibility, never the handler's.
- The handler MUST NOT construct its own envelope. Doing so would nest envelopes (`{ ok: true, data: { ok: true, data: ... } }`), which is almost always a bug.

## 3. `ValidatedIpcTupleHandler<TArgs, TOutput>` — the tuple handler signature

**Location**: type exported by `app/main/ipc/register-validated-handler.ts`.

**Shape**:

```ts
export type ValidatedIpcTupleHandler<TArgs extends readonly unknown[], TOutput> = (
  ...args: TArgs
) => TOutput | Promise<TOutput>;
```

**Invariants**:

- The handler receives the spread of the validated tuple as positional arguments.
- Same error and envelope invariants as `ValidatedIpcHandler`.
- The tuple length and element types are derived at compile time from the tuple schema via `z.infer<typeof tupleSchema>`.

## 4. Error code taxonomy

Reserved codes defined by this feature:

| Code | Meaning | Typical origin |
|---|---|---|
| `IPC_INPUT_INVALID` | The input payload did not match its schema | `ZodError` from `schema.parse` |
| `IPC_HANDLER_ERROR` | The business handler threw an unexpected exception | Any `Error` not in the passthrough table |
| `IPC_HANDLER_UNAVAILABLE` | No handler is registered for the requested channel | Defense in depth; should never fire in a correctly wired build |
| `IPC_TIMEOUT` | Reserved for a future async-timeout variant | Not emitted by this feature |

Passthrough codes preserved from upstream features:

| Code | Meaning | Source |
|---|---|---|
| `WORKSPACE_CONFIGURATION_INVALID` | A `WorkspaceConfigurationError` was thrown by the business layer | Feature 002 |
| `WORKSPACE_PATH_ESCAPE` | A `WorkspacePathEscapeError` was thrown by a path builder | Feature 002 |

Codex failures (`CODEX_CLI_FAILED`, `CODEX_CLI_INVALID_JSON`, `CODEX_CLI_TIMEOUT`) are NOT in the passthrough table because they are not thrown as exceptions. They are carried by the `SkillRunnerResult.status === "failed"` shape, which flows through the envelope as a successful handler result: `{ ok: true, data: { status: "failed", error: { code: "CODEX_CLI_TIMEOUT", message: "..." } } }`. The renderer's existing code already distinguishes the inner failure from the outer envelope.

## 5. Per-domain schemas

Each schema file exports a collection of zod schemas and their derived TypeScript types. The shape of each file is uniform:

```ts
import { z } from "zod";

// ... individual schemas ...

export const someInputSchema = z.object({ ... });
export type SomeInput = z.infer<typeof someInputSchema>;
```

### 5.1 `app/shared/schemas/ideas.ts`

- `ideaInputSchema` — `{ title: string(1-), angle: string(1-), pillarLabel: string(1-) }`
- `newsSourceInputSchema` — `{ sourceTitle: string(1-), sourceSummary: string(1-), pillarLabel: string(1-) }`

### 5.2 `app/shared/schemas/workshop.ts`

Primitives:
- `postTypologySchema` — `z.enum([...])` with the 8 typologies from feature 001 (expertise, opinion, diagnosis, etc.)
- `postObjectiveSchema` — `z.enum([...])` with the 4 objectives (awareness, consideration, conversion, retention)
- `hookOptionSchema` — `{ id: string, family: string, text: string, score: number(0-1) }`
- `variantTypeSchema` — `z.enum(["short", "punchy", "premium"])` (or the exact current values)

Tuple schemas for positional handlers:
- `suggestedStructuresTuple` — `z.tuple([ideaIdSchema, postTypologySchema, postObjectiveSchema])`
- `generateHooksTuple` — `z.tuple([ideaIdSchema, postTypologySchema, structureKeySchema])`
- `generateFinalDraftTuple` — `z.tuple([ideaIdSchema, postTypologySchema, postObjectiveSchema, structureKeySchema, structureLabelSchema, hookIdSchema, hookTextSchema, z.array(hookOptionSchema)])`

Scalar schemas:
- `ideaIdSchema` — `z.string().min(1)` with a descriptive error message
- `draftIdSchema` — same shape
- `createVariantTuple` — `z.tuple([draftIdSchema, variantTypeSchema])`

### 5.3 `app/shared/schemas/library.ts`

- `searchLibraryInputSchema` — `{ query?: string, pillar?: string, status?: string }` (or the exact current LibrarySearchInput shape)

### 5.4 `app/shared/schemas/calendar.ts`

- `scheduleDraftInputSchema` — `{ draftId: string(1-), plannedDate: string (ISO 8601 date), status: z.enum([...]) }`

### 5.5 `app/shared/schemas/settings.ts`

- `emptyInputSchema` — `z.undefined()` exported with a comment stating it is the convention for no-input channels
- Same file can be reused by execution.ts if the two files share one empty schema; the duplication is kept minimal with a re-export.

### 5.6 `app/shared/schemas/execution.ts`

- Re-exports `emptyInputSchema` from settings.ts (or defines its own if we prefer zero coupling between the two domain files).

### 5.7 `app/shared/schemas/strategy.ts` (already exists)

Verified for completeness during implementation. If the existing `strategyBundleInputSchema` covers all current fields, no change is needed. If a field is missing or a new one has been added since feature 001, the schema is updated.

## 6. Known failure modes documented as expected outcomes

1. **A renderer sends a request with a missing required field** — the envelope returns `{ ok: false, error: { code: "IPC_INPUT_INVALID", message: "<description>", field: "<name>" } }`. The preload throws an Error with `name = "IPC_INPUT_INVALID"`, `message` containing both the description and the field name. The renderer's existing catch block shows the message to the user via `setStatus(err.message)`.

2. **A renderer sends a request with a field of the wrong type** — same envelope shape as above, with a different message and field. Same renderer behavior.

3. **A business service throws a `WorkspaceConfigurationError`** (hypothetical; not currently thrown per-request) — the envelope returns `{ ok: false, error: { code: "WORKSPACE_CONFIGURATION_INVALID", message: "<original>" } }`. The preload throws an Error with `name = "WORKSPACE_CONFIGURATION_INVALID"`.

4. **A business service throws an unexpected `TypeError`** — the envelope returns `{ ok: false, error: { code: "IPC_HANDLER_ERROR", message: "Unexpected handler error: <original>" } }`. The preload throws an Error with `name = "IPC_HANDLER_ERROR"`.

5. **A Codex skill invocation returns `status: "failed"` with `error.code: "CODEX_CLI_TIMEOUT"`** — the handler returns the SkillRunnerResult normally. The envelope wraps it as `{ ok: true, data: <skillRunnerResult> }`. The renderer unwraps `data`, sees `data.status === "failed"`, and displays the Codex error via its existing code path. The new envelope does not interfere.

6. **A renderer invokes a channel that does not exist** — the underlying `ipcRenderer.invoke` rejects with Electron's default "No handler registered" error. The preload's `unwrap` helper sees a rejected promise, not an envelope; it re-throws. The test for this case asserts that the rejection's message is informative. `IPC_HANDLER_UNAVAILABLE` as a code remains defined but is not emitted by the current implementation because Electron handles missing handlers at a lower layer.

## 7. Lifecycle of a new IPC channel (additive contribution)

When a future contributor adds a new IPC channel:

```
1. Define the input schema in app/shared/schemas/<domain>.ts.
2. Derive the input type: export type FooInput = z.infer<typeof fooInputSchema>.
3. Add the handler method to the runtime service class in app/main/ipc/<domain>-ipc.ts.
4. Register the handler via registerValidatedHandler(ipcRegistrar, "<channel>", fooInputSchema, handler).
5. Add a method on the preload bridge that invokes the channel.
6. Add a unit test case to tests/unit/<domain>-ipc.test.ts covering valid + missing + wrong + throw.
```

The pattern is small enough to be recalled from any existing handler file without reading documentation, fulfilling SC-007.

## Summary

| Element | Type | New? |
|---|---|---|
| `IpcResult<T>` | Discriminated union | Yes |
| `IpcError` | Object type | Yes |
| `ValidatedIpcHandler<TInput, TOutput>` | Function signature | Yes |
| `ValidatedIpcTupleHandler<TArgs, TOutput>` | Function signature | Yes |
| 4 reserved error codes | String literals | Yes |
| 2 passthrough codes (from feature 002) | String literals | Preserved, surfaced |
| 6 per-domain schema files | zod schemas | Yes |
| 1 extended strategy schema | zod schemas | Verified for completeness |
| 1 wrapper module | TypeScript module | Yes |
| 6 per-handler test files | Vitest test files | Yes |
| 1 extended strategy-ipc test file | Vitest test file | Extended |
| Preload unwrap helper | Pure function | Yes |

No database schema change. No new table. No new IPC channel. No new Codex skill.
