# Contract — `createId` shared helper

This document defines the API contract that the consolidated `createId` module must satisfy. The contract is enforced by `tests/unit/create-id.test.ts`.

## Module location

`app/main/shared/create-id.ts`

## Public function

```ts
export function createId(prefix: string, index?: number): string;
```

## Behavior contract

### Happy path — single argument

- **Given** a non-empty string `prefix`,
- **Then** the function returns a string that:
  - Starts with `${prefix}_`.
  - Contains a timestamp component derived from `Date.now()`.
  - Contains a random component for collision resistance.
  - The exact shape MUST be byte-for-byte identical to the existing inline copies' output. The reference implementation is the one currently in `app/main/domains/workshop/workshop.service.ts:19` (the most-used variant). If a contributor needs to verify the exact shape, they read that source file before deletion.

### Happy path — with `index` parameter

- **Given** a non-empty `prefix` and a non-negative integer `index`,
- **Then** the function returns a string that respects the deterministic-ordering behavior of the existing strategy variant at `app/main/domains/strategy/strategy.repository.ts:51`.
- **And** two consecutive calls `createId("offer", 0)` and `createId("offer", 1)` MUST return values that sort in the same order as their indexes when compared lexicographically (or whatever ordering the strategy variant guarantees today).

### Uniqueness guarantee

- **Given** 100 consecutive calls with the same `prefix` and no `index`,
- **Then** the 100 returned values MUST all be distinct. Collisions are unacceptable even at high call rates.
- **Given** 100 consecutive calls alternating with-and-without `index`,
- **Then** no value returned with `index` MUST collide with any value returned without `index`.

### Pure function contract

- The function reads only its arguments and `Date.now()` (or equivalent monotonic source) and a random source. It does NOT touch the filesystem, the network, the SQLite database, the Electron app, or any global mutable state other than the time source.
- The function is synchronous and never throws on valid input. Invalid input (e.g., empty string `prefix`, non-string `prefix`, non-integer `index`) MAY throw or MAY return a graceful default — the choice is left to the implementation but MUST be consistent with the existing copies' behavior on the same input.

## Test fixtures expected by `tests/unit/create-id.test.ts`

The test file imports the helper and exercises it directly. Cases (≥ 5 per FR-003a):

1. **Prefix preservation** — `createId("draft")` returns a string that starts with `draft_`.
2. **Id shape** — the returned string matches the regex pattern for the existing format (the test inspects what the existing copies produce and asserts the same shape).
3. **Uniqueness across many calls** — calling `createId("draft")` 100 times in a tight loop returns 100 distinct strings.
4. **Optional `index` parameter** — `createId("offer", 0)` and `createId("offer", 1)` return distinct strings; the second sorts after the first under the documented ordering.
5. **No collision between with-and-without index** — calling `createId("offer")` and `createId("offer", 0)` returns two distinct strings even when the timestamp component is identical.

Optional additional cases (above the minimum of 5):

6. **Empty prefix** — `createId("")` either throws OR returns a string starting with `_` (the test asserts whichever the existing copies do — the test is calibrated against the source-of-truth implementation before deletion).
7. **Numeric prefix** — `createId("123")` is allowed and returns a string starting with `123_`.

## Migration of the five call sites

After the helper is created, the five inline copies are deleted in this order:

1. `app/main/domains/calendar/calendar.service.ts:4` — replace inline definition with `import { createId } from "../../shared/create-id";`.
2. `app/main/domains/strategy/strategy.repository.ts:51` — same import. The strategy site uses the `index` parameter, so the import works against the most expressive signature.
3. `app/main/domains/workshop/workshop.service.ts:19` — same import.
4. `app/main/domains/news/news-to-post.service.ts:10` — same import.
5. `app/main/domains/ideas/ideas.repository.ts:4` — same import.

After each deletion, run `npm test -- <relevant-test-file>` to confirm the existing service tests still pass. The byte-for-byte identical content guarantees they should.

## Verification

A grep over `app/main/` for `function createId\b` MUST return exactly one match (the new shared module) after the migration. A grep for `import { createId }` from any service file MUST return five matches (one per former call site).
