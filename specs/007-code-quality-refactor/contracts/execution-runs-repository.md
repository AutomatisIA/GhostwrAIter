# Contract — `execution-runs.repository.ts` shared write helper

This document defines the API contract that the consolidated `execution_runs` write helper must satisfy. The contract is enforced by `tests/unit/execution-runs-repository.test.ts`.

## Module location

`app/main/domains/execution/execution-runs.repository.ts`

The location was chosen in Clarification Q2 over the alternative of extending `execution.service.ts`. The repository file contains only persistence concerns; the service file remains the orchestration layer.

## Public function

```ts
import type Database from "better-sqlite3";

export type ExecutionRunPayload = {
  // The exact field set is derived from the existing inline copies in
  // workshop.service.ts:743, library.service.ts:124, and
  // news-to-post.service.ts:86. The contract MUST stay byte-for-byte
  // aligned with what those copies insert today.
  runId: string;
  ideaId: string | null;
  draftId: string | null;
  skillName: string;
  status: "succeeded" | "failed" | "partial";
  summary: string | null;
  invocation: unknown;       // SkillRunnerInvocation, JSON-serialised inside the function
  result: unknown;            // SkillRunnerResult, JSON-serialised inside the function
  error: { code: string; message: string } | null;
  createdAt: string;          // ISO 8601, same format as existing copies
};

export function insertExecutionRun(
  db: Database.Database,
  payload: ExecutionRunPayload
): void;
```

The exact field names and types must match the source-of-truth implementation, which is the most-recent of the three inline copies (verified by inspection of `workshop.service.ts:743` before its deletion). If a field is `null`-able in the existing copies, it stays `null`-able in the helper.

## Behavior contract

### Single-row insert

- **Given** a valid `payload`,
- **Then** the function executes exactly one `INSERT INTO execution_runs (...)` statement and returns `void`.
- **And** the row inserted has the same column set, the same column order, and the same column values that the existing inline copies produce for the same payload.

### JSON serialisation

- **Given** a payload with structured `invocation` and `result` fields,
- **Then** the function calls `JSON.stringify(payload.invocation)` and `JSON.stringify(payload.result)` before binding them to the prepared statement.
- **And** the timestamp is stored as the string returned by `new Date().toISOString()` (or the equivalent format the existing copies use), unmodified.

### No accidental dedup

- **Given** the function is called twice with identical `payload` objects,
- **Then** the function inserts two distinct rows into the table.
- **And** the helper does NOT introduce any "INSERT OR REPLACE", "INSERT OR IGNORE", or any deduplication logic. The previous inline copies do not deduplicate, so the helper does not either.

### No transaction wrapping

- The function does NOT wrap the INSERT in a transaction. The caller is responsible for transaction control if needed (e.g., if the workshop service inserts multiple rows in a workflow that should be atomic). The previous inline copies are not transactional, so the helper preserves that behaviour.

### Error propagation

- **Given** the database is read-only or the table does not exist,
- **Then** the underlying `db.prepare(...).run(...)` call throws, and the function lets the exception propagate to the caller. The helper does NOT catch and swallow database errors. The caller's existing error-handling path (currently a `try { ... } catch { ... }` in the workshop service) continues to work because it sees the same exception shape.

## Test fixtures expected by `tests/unit/execution-runs-repository.test.ts`

The test file uses an in-memory `better-sqlite3` database created with `new Database(":memory:")` and the existing `createExecutionTables(db)` (or equivalent setup function) to provide the schema. Cases (≥ 5 per FR-007a):

1. **Single-row insert** — call `insertExecutionRun(db, payload)` once and verify that `db.prepare("SELECT COUNT(*) FROM execution_runs").get()` returns 1.
2. **Column value preservation** — after the insert, `db.prepare("SELECT * FROM execution_runs").get()` returns a row whose every column matches the input payload (with the JSON columns deserialised back to objects for comparison).
3. **ISO timestamp format** — the `createdAt` column contains a string that parses as a valid ISO 8601 timestamp via `new Date(...).toISOString() === stored`.
4. **JSON serialisation of structured payload** — passing a complex `invocation` object (with nested fields) results in a stored string that round-trips through `JSON.parse` to the original object.
5. **No accidental dedup** — calling the function twice with the same payload (and a slightly different `runId` to avoid primary key collision if applicable) results in two rows in the table.

Optional additional cases:

6. **Null fields** — passing `payload` with `ideaId: null` and `draftId: null` succeeds and stores nulls in the corresponding columns.
7. **Failed status** — passing `payload` with `status: "failed"` and a non-null `error` object stores the error correctly.

## Migration of the three call sites

After the helper is created and tested, the three inline INSERT statements are deleted in this order:

1. **workshop.service.ts** — the largest existing copy, also the most likely to have nuances. Read it carefully and ensure the helper preserves every column. Replace the private `recordExecutionRun` method's body with a single call to `insertExecutionRun(this.db, { ... })`.
2. **library.service.ts** — replace the inline INSERT with the helper call.
3. **news-to-post.service.ts** — replace the inline INSERT with the helper call.

After each replacement, run `npm test -- <relevant-test>` to confirm the existing service tests still pass.

## Verification

A grep over `app/main/` for `INSERT INTO execution_runs` MUST return exactly one match (in `execution-runs.repository.ts`) after the migration. A grep for `import { insertExecutionRun }` MUST return three matches (workshop, library, news services).
