# Research — Feature 007: Code Quality Refactor

## D1 — Conditional descope policy for the `eslint-plugin-react-hooks@7` upgrade

**Decision**: The upgrade chain is conditionally allowed. Bump every transitive package (`eslint` core, `typescript-eslint`, plugin peer-deps) as long as no bump invalidates a stabilized feature from chantiers 002 through 006: CSP, sandbox + context isolation, IPC validation envelope, hardening verification script, security audit gate. If a major transitive bump regresses any of these, US4 is descoped, `eslint-plugin-react-hooks` stays at 6.x, and a comment is added to `eslint.config.js` recording the reason and the follow-up trigger.

**Rationale**: Resolved by Clarification Q1. The objective is to unblock the modern lint rules (specifically `set-state-in-effect`), not to risk a cascading regression of features whose stability the project relies on. The conditional descope clause is a safety net that gives the upgrade attempt full freedom up to a clearly drawn boundary. The boundary is the same set of features that the existing `verify-hardening` script and `real-app-audit` script validate, so the regression test is automatic.

**Alternatives considered**:

- **Strict**: bump everything in cascade until green. Rejected because it could push the feature into unbounded scope (eslint major bump → typescript-eslint major bump → typescript bump → broken type narrowing in production code).
- **Minimal**: descope US4 immediately if any major transitive bump is required. Rejected because it gives up too easily — the audit measured only 6 known violations, all of which are mechanically refactorable.
- **Workspace pinning hack**: use a `package.json` `overrides` field to force the plugin to a newer version while keeping its peer-deps at 6.x. Rejected because it can produce silent runtime incompatibilities that no test catches.

## D2 — Location of the centralised `execution_runs` write helper

**Decision**: A new dedicated file `app/main/domains/execution/execution-runs.repository.ts` exporting a function `insertExecutionRun(db, payload)`. The existing `execution.service.ts` is NOT extended.

**Rationale**: Resolved by Clarification Q2. The `execution_runs` table is a low-level persistence detail, while `execution.service.ts` orchestrates higher-level skill execution logic (skill selection, timeout management, error mapping). Mixing the two concerns in one file violates the repository/service separation that the project already uses elsewhere (`ideas.repository.ts`, `strategy.repository.ts`). Putting the new helper next to the existing service in the same domain folder keeps the file organization intuitive for a contributor.

**Alternatives considered**:

- Extend `execution.service.ts` with a public `recordRun()` method. Rejected for the concern-mixing reason above.
- Place the helper in `app/main/shared/execution-runs.ts` next to `create-id.ts`. Rejected because the table belongs clearly to the execution domain — it has no callers outside the execution-related services.

## D3 — Maximum line count for sub-components extracted from the two screens

**Decision**: Soft cap of 300 lines per sub-component. The 50-line gap above the orchestrator cap of 250 accommodates complex forms with multiple grouped fields. Sub-components that exceed 300 lines after a good-faith decomposition MUST carry an inline justification comment explaining why a further split would harm cohesion.

**Rationale**: Resolved by Clarification Q3. 250 lines is too aggressive for a sub-component that may legitimately host a 5-7 field form (offers, ICPs). 300 leaves enough margin for a single-purpose form without falling back into the monolithic anti-pattern. The "justify or split further" rule prevents the cap from becoming a license to keep large files.

**Alternatives considered**:

- Strict 250 lines (same as the orchestrator). Rejected — would force sub-sub-components for legitimate cases.
- No cap, qualitative review only. Rejected — too subjective, risks regression to monolithic sub-components.
- 200 lines very strict. Rejected — would fragment forms unnecessarily.

## D4 — Type narrowing strategy for `noUncheckedIndexedAccess` fixes

**Decision**: Each fix uses one of four real narrowing patterns: (a) early return when the result is undefined, (b) explicit length check before the access, (c) optional chaining with a meaningful fallback, or (d) destructuring with a default value. Three escape hatches are explicitly BANNED: `// @ts-ignore`, `// @ts-expect-error`, and the non-null assertion operator `!`.

**Rationale**: Resolved by Clarification Q4. The point of activating the flag is to convert latent runtime crashes into compile-time errors that the developer fixes properly. Allowing the `!` escape hatch silences the flag at compile time without preventing the runtime crash, defeating the purpose entirely. The real narrowing patterns force the developer to think about what should happen when the index is out of range, which is exactly the design feedback the flag is supposed to surface.

**Alternatives considered**:

- Pragmatic — `!` allowed when the developer can prove by construction that the index is valid, with a `// SAFETY: ...` comment. Rejected because the SAFETY comment becomes a rubber stamp once the convention is in place.
- Permissive — `!` allowed without constraint. Rejected, defeats the purpose.

## D5 — Dedicated unit test files for the two new shared helpers

**Decision**: Two new test files: `tests/unit/create-id.test.ts` (≥ 5 cases covering prefix preservation, id shape, uniqueness across many calls, optional `index` parameter, no collision between with-and-without index variants) and `tests/unit/execution-runs-repository.test.ts` (≥ 5 cases covering single-row insert per call, column value preservation, ISO timestamp format, JSON serialisation of structured payload, no accidental dedup).

**Rationale**: Resolved by Clarification Q5. Direct tests give an immediate signal when a refactor breaks a helper, instead of producing a confusing failure cascade in unrelated call-site tests. The cost is minimal (~30 minutes for both files combined), and the helpers are simple enough that test coverage is straightforward.

**Alternatives considered**:

- Indirect tests via call-sites only. Rejected — slower failure localisation, no protection against future refactors that change the helpers' contracts.
- Hybrid (test only `createId`, leave `insertExecutionRun` to indirect tests). Rejected — the SQL helper is the riskier of the two because it touches the database; it deserves equal coverage.

## D6 — Risk-ordered execution sequence for the six refactor targets

**Decision**: The user stories MUST be implemented in this order during the implementation phase, regardless of their priority labels:

1. **US2 (createId dedup)** — smallest, lowest risk, no UI touched.
2. **US3 (execution_runs dedup)** — small, medium risk (touches a shared service), no UI touched.
3. **US4 (noUncheckedIndexedAccess activation)** — medium effort, medium risk, ~20 fixes mostly in `workshop.service.ts`. The fixes from US4 may overlap with the call-sites already touched by US2 and US3, so doing the deduplications first reduces merge conflict surface.
4. **US5 (react-hooks 7 upgrade)** — medium effort, medium risk. May trigger the conditional descope clause from D1. Doing it before the screen splits ensures the lint rules are in their target state when the splits start, so any new sub-component is created against the strict rules from day one.
5. **US1a (StrategyScreen split)** — high effort, medium-high risk. Done after all the lower-risk targets land so a regression here is isolated and easy to revert without losing other progress.
6. **US1b (WorkshopScreen split)** — same as US1a but for the more complex screen, done last because it has the highest risk. The pattern learned from the strategy split applies to this one.

**Rationale**: This order minimises merge-conflict surface and risk-blast-radius. The deduplications create the shared helpers that other refactors will use; activating `noUncheckedIndexedAccess` before the screen splits ensures the splits are done against the strict rules; doing the highest-risk screen last (Workshop) means a problem there does not block the simpler refactors from shipping.

**Alternatives considered**:

- Priority-order (P1 before P2): US2 → US3 → US4 → US5 → US1a → US1b. Same as the chosen order, the priority labels happen to align with the risk order.
- Parallel within priorities. Rejected because the items affect overlapping files (workshop.service.ts is touched by US2, US3, and US4) and serial execution avoids merge conflicts.
- High-risk-first (US1a/US1b first to validate the approach). Rejected because a problem with the highest-risk item would block all the other refactors.
