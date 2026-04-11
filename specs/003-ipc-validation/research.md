# Phase 0 — Research

**Feature**: Systematic IPC schema validation
**Branch**: `003-ipc-validation`
**Date**: 2026-04-11

All decisions required for implementation are closed in this document. Each decision follows the **Decision / Rationale / Alternatives considered** format.

## D1 — Validation library

**Decision**: reuse `zod` 4.3.6, the library already adopted by feature 001 for `app/shared/schemas/strategy.ts`. No new dependency is introduced, no existing dependency is upgraded.

**Rationale**: single source of truth for all validation logic, consistent import pattern across the 7 handler files, no additional bundle weight, no additional typecheck surface. `zod.infer` cleanly produces the TypeScript type from the schema, fulfilling FR-021 without a separate codegen step.

**Alternatives considered**:
- `io-ts` — more functional idiom but requires `fp-ts` as peer and increases the bundle. Rejected.
- `valibot` — lighter than zod but the project already uses zod for strategy; adding a second library violates Constitution VI. Rejected.
- Handwritten runtime checks — verbose, error-prone, no inference. Rejected.

## D2 — Location of schema files

**Decision**: all new schemas live in `app/shared/schemas/<domain>.ts`, alongside the existing `strategy.ts`. One file per IPC handler domain. No subdirectory.

**Rationale**: the convention is already established by feature 001. Both the main process (`app/main/ipc/*.ts`) and the renderer (`app/renderer/src/features/strategy/*`) import from this directory today, proving the bi-context import path works. Keeping new files in the same directory prevents a contributor from wondering where schemas live.

**Alternatives considered**:
- `app/shared/validation/` — a separate directory for schemas. Rejected because it splits a concept that is already unified.
- Each schema co-located with its IPC handler in `app/main/ipc/` — rejected because the renderer cannot import from `app/main/**`, which would block the single-source-of-truth goal.

## D3 — Result envelope shape

**Decision**: the envelope is a discriminated union over a boolean `ok` tag:

```ts
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; field?: string } };
```

**Rationale**: discriminated unions narrow cleanly in TypeScript without a type guard. The `ok` tag is a boolean, which serializes trivially across the Electron IPC bridge (no class instances, no prototype chain). The `field` property is optional and is only set for validation failures, where it names the first invalid field path.

**Alternatives considered**:
- A Result type from a functional library like `neverthrow`. Rejected — new dependency, non-trivial serialization across IPC.
- Throwing exceptions at the preload layer directly (no envelope). Rejected because the main-process handler loses the ability to catch the error centrally and log it with channel context.
- A three-state envelope `{ status: "ok" | "validation_error" | "handler_error" }`. Rejected because it is less ergonomic than the boolean discriminant and does not compose with `TypeScript`'s `is` narrowing.

## D4 — Error code taxonomy

**Decision**: four reserved codes plus a passthrough mechanism for domain typed errors.

Reserved codes (defined by the wrapper):

- `IPC_INPUT_INVALID` — a zod `ZodError` was raised during the schema parse.
- `IPC_HANDLER_ERROR` — the business handler threw an exception that is not a recognized typed error.
- `IPC_HANDLER_UNAVAILABLE` — no handler was registered for the requested channel (defense in depth; should never fire in a correctly wired build).
- `IPC_TIMEOUT` — reserved but not used in this feature. Kept in the taxonomy so a future async timeout can reuse the code without a breaking change.

Passthrough codes (preserved when a known typed error is thrown by the business layer):

- `CODEX_CLI_FAILED`, `CODEX_CLI_INVALID_JSON`, `CODEX_CLI_TIMEOUT` — from feature 002's Codex runner.
- `WORKSPACE_CONFIGURATION_INVALID`, `WORKSPACE_PATH_ESCAPE` — from feature 002's workspace service. (Note: these are not currently thrown during a per-request invocation, but they may be in the future when the `assertUnderRoot` helper starts being used.)
- Any future typed error that carries a recognizable class name — added to the lookup table as it is introduced.

**Rationale**: the passthrough mechanism ensures that downstream error vocabulary is preserved at the renderer boundary. A Codex hang surfaces as `CODEX_CLI_TIMEOUT` with the wall-clock number in the message, not as a generic `IPC_HANDLER_ERROR`. This protects the strict-Codex-execution doctrine of feature 001 (FR-018, FR-022 from feature 002) and preserves diagnostic quality.

**Implementation detail for the lookup table**:

```ts
const KNOWN_ERROR_CODE_MAP: ReadonlyMap<string, string> = new Map([
  ["WorkspaceConfigurationError", "WORKSPACE_CONFIGURATION_INVALID"],
  ["WorkspacePathEscapeError", "WORKSPACE_PATH_ESCAPE"]
  // Codex errors are surfaced via the SkillRunnerResult shape,
  // not via thrown exceptions, so they don't need to be mapped here.
  // They flow through the envelope as successful handler results
  // that themselves describe a failed skill invocation.
]);
```

This means Codex failures will continue to flow through as `{ ok: true, data: { status: "failed", ... } }` — the handler returned the failed skill result successfully, and the renderer's existing code already knows how to read `data.status === "failed"`. Only workspace errors and truly unexpected exceptions are caught and transformed by the wrapper.

## D5 — Positional arguments strategy

**Decision**: two wrapper functions in the same module.

- `registerValidatedHandler(ipcRegistrar, channel, schema, handler)` — handler receives a single validated input.
- `registerValidatedTupleHandler(ipcRegistrar, channel, tupleSchema, handler)` — handler receives the spread tuple elements as positional arguments.

**Rationale**: type inference for `z.object` and `z.tuple` differs enough that overloading a single function produces unwieldy types. Two functions with distinct names keep each call site unambiguous and readable.

**Affected channels for the tuple variant**:

- `workshop:get-suggested-structures` (ideaId, typology, objective) — 3 args.
- `workshop:generate-hooks` (ideaId, typology, structureKey) — 3 args.
- `workshop:generate-final-draft` (ideaId, typology, objective, structureKey, structureLabel, selectedHookId, selectedHookText, hooks) — 8 args.

All other channels accept either a single object payload or a single scalar (ideaId / draftId / variantType), and use the single-input variant.

**Alternatives considered**:
- Migrate every handler to a single object payload. Rejected because it changes the preload bridge signatures, which changes the renderer API surface, violating FR-014.
- Wrap positional args into an object inside the preload. Rejected because the preload would need to know about the schema shape, coupling it to the validation layer.

## D6 — Preload unwrap strategy

**Decision**: the preload layer wraps every `ipcRenderer.invoke(...)` call in a small helper that awaits the envelope, returns `data` on `ok`, and throws a typed `Error` whose `name` is the envelope's `error.code` and whose `message` is the envelope's `error.message`. When `field` is present, it is appended to the message in parentheses.

```ts
async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise;
  if (result.ok) {
    return result.data;
  }
  const error = new Error(
    result.error.field
      ? `${result.error.message} (field: ${result.error.field})`
      : result.error.message
  );
  error.name = result.error.code;
  throw error;
}
```

Every method on `window.linkedinPoster.*` pipes its `ipcRenderer.invoke` result through `unwrap`. No other change in the preload.

**Rationale**: the renderer's existing error handling is `try { ... } catch (err) { setStatus(err.message) }` in every screen. A thrown Error with a meaningful `message` slots into that pattern without any screen edit. The `name` property carries the structured error code for any screen that wants to branch on it in the future.

**Alternatives considered**:
- Propagate the envelope directly. Rejected because every screen would need to learn to check `ok` and branch, which is exactly the refactor FR-014 forbids.
- Throw a custom class (e.g., `IpcError`) instead of a plain Error. Rejected because custom classes do not survive IPC boundary checks and instance checks in tests become fragile. A plain Error with a descriptive `name` is simpler and just as informative.

## D7 — Typed errors logging contract

**Decision**: the wrapper logs every failure via electron-log at level `warn` for validation failures and `error` for handler failures. The log line contains the channel name, the error code, and the first 80 characters of the error message. **Payload content is never logged**, only field names for validation failures.

**Rationale**: failure logs are diagnostic signals for the maintainer. Payloads may contain editorial content (drafts, strategy text) that is sensitive per the feature-002 documentation of local storage. Logging only metadata preserves diagnostics without exposing user content.

**Alternatives considered**:
- Log the full payload in the main log at level `debug`. Rejected because electron-log's default level in production includes `debug` if the file is rotated, so sensitive content could leak into the rotated log file.
- Log nothing. Rejected because silent failures are the exact issue the envelope is meant to fix; if the maintainer cannot see a pattern of `IPC_INPUT_INVALID` surging, they cannot diagnose.

## D8 — Schema-derived type replacement policy

**Decision**: wherever a handwritten TypeScript type in `app/shared/types/<domain>.ts` describes an IPC input, the handwritten type is replaced with `export type Foo = z.infer<typeof fooSchema>`. If the handwritten type has no non-IPC consumer after the replacement, the type declaration is removed entirely. Otherwise it is kept as a type-only re-export.

**Rationale**: fulfills FR-021 (single source of truth) and prevents drift between validation rules and TypeScript types. A future renaming of a field in the schema produces a compile error at every call site.

**Alternatives considered**:
- Keep the handwritten types and add zod schemas alongside. Rejected because the two can drift, which is the pattern that caused the `fix(002)` baseline repair commit in the first place.
- Generate the schemas from the handwritten types (reverse direction). Rejected because it is more complex, requires a codegen step, and loses the expressive power of zod validation (string length, enum membership, email format).

## D9 — Test pattern

**Decision**: each new handler test file follows the exact pattern of `tests/unit/strategy-ipc.test.ts`:

- A `Map<string, Handler>` captures channel registrations via a fake `IpcRegistrar` that stores `{channel, handler}` pairs.
- Tests call the captured handler directly with a synthetic `event` (typically `undefined`) and the test payload.
- A fake business service is injected into the runtime service constructor where applicable, with `vi.fn()` stubs for each method.
- For handlers that exercise Codex skills, the existing `createStrictSkillRunnerService()` from `tests/unit/helpers/fake-codex.ts` is reused.

**Rationale**: the pattern is proven, requires no Electron launch, runs in under a second, and covers the full IPC surface including the error paths. Reusing it eliminates bikeshedding about test infrastructure.

**Alternatives considered**:
- Use `@playwright/test` to drive the real app. Rejected because it is much slower and does not cover synthetic error inputs as cleanly.
- Use `@testing-library/react` to drive the preload from renderer tests. Rejected because the preload is not a React component and Testing Library's assertions don't map to the IPC surface.

## D10 — Migration order

**Decision**: migrate the handler files in this order:

1. `calendar-ipc.ts` — smallest (1 handler with input), serves as the migration template for the other files.
2. `settings-ipc.ts` — 2 handlers, both no-input. Exercises the empty-input schema pattern.
3. `execution-ipc.ts` — 2 handlers, both no-input. Same pattern as settings.
4. `library-ipc.ts` — 3 handlers, one with a search input, one with a scalar input.
5. `ideas-ipc.ts` — 4 handlers, two with object inputs, one with no input.
6. `workshop-ipc.ts` — 7 handlers, exercises the tuple pattern extensively. Most complex.
7. `strategy-ipc.ts` — 3 handlers, already has a test file. Migrated last and its test file is extended to cover the envelope.

**Rationale**: starting with the simplest file reveals any wrapper ergonomic issue early, with a low blast radius. The workshop file is last because it exercises the most complex pattern (tuple), and by then the wrapper will have been tested on six other files.

**Alternatives considered**:
- Alphabetical order. Rejected because it mixes easy and hard files randomly.
- Reverse order (most complex first). Rejected because an ergonomic bug in the wrapper would only surface after significant rewriting, and would force a rollback.

## Open items deferred to implementation

None. All decisions required for implementation are closed.

## Follow-up chantiers

- **Chantier 4** — extract the Codex skill prompts from `codex-cli-runner.ts` into `skills/linkedin-<name>/SKILL.md` files and have `SkillRegistryService` load them at runtime. The current SKILL.md files exist but are minimal stubs. This is orthogonal to IPC validation but shares the "structured I/O at boundaries" spirit.
- **Chantier 3.5** — real-world editorial quality evaluation with the four representative fixture types from the cahier des charges (raw idea, news, client case, draft to correct). This is a new chantier added by the user on 2026-04-11 after the .docx reference documents were re-read.
