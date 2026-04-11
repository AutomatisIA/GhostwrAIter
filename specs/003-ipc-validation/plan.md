# Implementation Plan: Systematic IPC schema validation

**Branch**: `003-ipc-validation` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-ipc-validation/spec.md`

## Summary

Introduce a single `registerValidatedHandler` wrapper, wire every IPC channel through it with an explicit zod schema, have the preload unwrap a typed result envelope into either data or a typed Error, replace handwritten IPC input types with schema-inferred types, and cover each of the seven handler files with a dedicated unit test file. All hardening from feature 002 is preserved. All renderer source files remain unchanged except where a handwritten IPC input type is replaced with a schema-derived import.

The feature is surgical: every change lives in `app/shared/schemas/`, `app/main/ipc/`, `app/preload/index.ts`, `tests/unit/*-ipc.test.ts`, and a handful of type-replacement edits in `app/shared/types/`. No business service is touched. No Codex skill prompt is touched. No renderer component is touched.

## Technical Context

**Language/Version**: TypeScript 6.0.2 compiled by Vite 7.3.2 + electron-vite 5. Same toolchain as feature 002.

**Primary dependency for this feature**: `zod` 4.3.6 — already used by feature 001 for `app/shared/schemas/strategy.ts`. No new dependency introduced. No existing dependency upgraded.

**Storage**: no change. SQLite via better-sqlite3.

**Testing**: Vitest 4.1.4 — same pattern as the existing `tests/unit/strategy-ipc.test.ts` (a `Map<string, Handler>` captures registrations and is driven synchronously without launching Electron). No new test framework, no new test config. Six new test files, one per remaining IPC handler.

**Target Platform**: macOS Apple Silicon today. Same as feature 002. Windows and Linux remain out of scope.

**Project Type**: single-process Electron desktop application with three layers (main / preload / renderer).

**Performance Goals**: no perceivable latency increase. Each validated handler adds a single `schema.parse()` call before the business invocation, plus a try/catch around both. On the hot path (workshop, strategy), the parse is on small objects (a few dozen fields at most) and is measured in microseconds.

**Constraints**: preserve every non-negotiable from the spec. Most importantly, the renderer API surface `window.linkedinPoster.*` stays identical in shape, the strict-Codex-execution doctrine of feature 001 is preserved, and no feature-002 hardening is weakened.

**Scale/Scope**: 28 IPC channels across 7 handler files, 6 new test files, ~25 zod schemas (one per channel that takes input, plus shared leaf schemas for PostTypology, PostObjective, HookOption, etc.).

## Constitution Check

Evaluated against `.specify/memory/constitution.md` v1.0.0:

| Principle | Status | Notes |
|---|---|---|
| I. Local-First and Confidential by Default | ✅ Pass | No remote dependency introduced. Validation happens entirely in the main process. |
| II. Workflow Before Prompting | ✅ Pass | No change to the editorial workflow. |
| III. Specialized Skills with Structured I/O | ✅ Pass + strengthened | The new envelope formalizes the structured I/O contract at the IPC seam, extending principle III beyond the Codex skill output into the cross-process message shape. |
| IV. Test-First Development Is Mandatory | ⚠ Required discipline | Every new schema and every new registration pattern must be driven by a failing test. The Testing Strategy section below enumerates the order. |
| V. Human Validation Over Autonomous Publishing | ✅ Pass | No change to the publishing path. |
| VI. Simplicity for MVP, Extensibility for the System | ✅ Pass | Zero new abstraction beyond the wrapper itself. Zero new module boundary. Zero new concept introduced into the domain layer. |

**Gate result**: pass with no violations. Complexity Tracking table empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-ipc-validation/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output — envelope, error taxonomy, validated handler shape
├── quickstart.md        # Phase 1 output — add a new IPC channel in 5 minutes
├── contracts/
│   ├── result-envelope.md
│   ├── validated-handler-wrapper.md
│   └── error-code-taxonomy.md
├── checklists/
│   └── requirements.md  # Already produced by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — not in this command)
```

### Source Code (repository root)

Files **touched** by this feature:

```text
app/shared/schemas/
  strategy.ts                 — already exists, verify completeness, add missing pieces if any
  ideas.ts                    — NEW: IdeaInput, NewsSourceInput schemas
  workshop.ts                 — NEW: PostTypology, PostObjective, HookOption,
                                and tuple schemas for generate-final-draft,
                                generate-hooks, get-suggested-structures
  library.ts                  — NEW: SearchLibraryInput schema
  calendar.ts                 — NEW: ScheduleDraftInput schema
  settings.ts                 — NEW: documents the empty-input schema convention
  execution.ts                — NEW: documents the empty-input schema convention

app/main/ipc/
  register-validated-handler.ts   — NEW: the wrapper helper + IpcResult envelope type
  strategy-ipc.ts             — migrated to registerValidatedHandler
  ideas-ipc.ts                — migrated
  workshop-ipc.ts             — migrated (positional arg tuple pattern)
  library-ipc.ts              — migrated
  calendar-ipc.ts             — migrated
  execution-ipc.ts            — migrated (empty-input schemas)
  settings-ipc.ts             — migrated (empty-input schemas)

app/preload/index.ts          — unwraps the envelope: returns data on ok, throws
                                typed Error on !ok. API surface unchanged.

app/shared/types/
  ideas.ts, workshop.ts,
  library.ts, calendar.ts,
  settings.ts, execution.ts   — existing handwritten IPC input types are replaced
                                with `z.infer<typeof ...>` imports from the
                                corresponding schema file. If a type has
                                no non-IPC consumer left after this, it is removed.

tests/unit/
  register-validated-handler.test.ts   — NEW: wrapper unit tests (success, validation
                                          failure, handler throw, empty-input schema,
                                          tuple schema for positional args)
  ideas-ipc.test.ts                    — NEW
  workshop-ipc.test.ts                 — NEW
  library-ipc.test.ts                  — NEW
  calendar-ipc.test.ts                 — NEW
  execution-ipc.test.ts                — NEW
  settings-ipc.test.ts                 — NEW
  strategy-ipc.test.ts                 — already exists, extended to cover the
                                          new wrapper and envelope unwrapping
```

Files **not touched**:

- Any file under `app/main/domains/` — business services keep their current signatures.
- Any file under `app/renderer/src/` — React components keep calling `window.linkedinPoster.*` with the same shapes.
- Any file under `scripts/` — real-app-audit continues to work verbatim.
- Any Codex skill prompt (`app/main/domains/execution/codex-cli-runner.ts` lines 155-260).
- `docs/exploitation.md` security section from feature 002.
- `specs/002-security-hardening/` or any other previous spec artifact.

**Structure decision**: no new directory. The wrapper lives alongside the existing IPC handlers. The schemas live alongside the existing `app/shared/schemas/strategy.ts`. This keeps the mental model small and makes the future refacto of chantier 4 (extraction of prompts, deduplication of execution helpers) unobstructed.

## Testing Strategy

Every behavioral change is driven test-first per Constitution IV. The sequence:

1. **Wrapper contract first**: write `tests/unit/register-validated-handler.test.ts` asserting the five required behaviors (valid input returns `{ ok: true }`, missing-field input returns `{ ok: false, error.code === "IPC_INPUT_INVALID" }`, wrong-type input returns the same, throwing handler returns `{ ok: false, error.code === "IPC_HANDLER_ERROR" }`, synchronous and async handlers both work). Observe failing. Implement `app/main/ipc/register-validated-handler.ts`. Observe passing.

2. **Per-handler test files**: write the six new test files each following the strategy-ipc.test.ts pattern. Each file asserts, for each channel in the file, the four required outcomes (valid, missing field, wrong type, handler throws). For the six new files this happens before the migration. The existing strategy-ipc.test.ts is extended last because the current handler is already validated at the service layer.

3. **Migration**: replace each `ipcRegistrar.handle(channel, ...)` call with `registerValidatedHandler(ipcRegistrar, channel, schema, handler)` one file at a time. After each file, run the file's test suite and confirm it passes. The implementation of each schema is part of the migration step.

4. **Preload unwrap**: extend the preload to unwrap the envelope. The unwrap helper is a pure function with its own test (`register-validated-handler.test.ts` gains a section for it, or a dedicated `preload-unwrap.test.ts` if the section is too big). Observe failing, implement, observe passing.

5. **Full regression**: run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `scripts/real-app-audit.mjs` against the final tree. No existing test must be weakened, skipped, or altered unless the alteration is justified by a replaced type import.

6. **`scripts/verify-hardening.mjs`** from feature 002 must still pass its six checks. The new wrapper and the new envelope must not change webPreferences, CSP, navigation guards, DevTools gating, or workspace validation.

## Risks and Mitigations

Three risks were flagged in the specification checklist and are resolved here.

### Risk 1 — Coupling with typed errors from feature 002

**Concern**: Several typed errors introduced in feature 002 (`WorkspaceConfigurationError`, `WorkspacePathEscapeError`, `CODEX_CLI_FAILED`, `CODEX_CLI_TIMEOUT`, `CODEX_CLI_INVALID_JSON`) are part of the business-layer error vocabulary. If the new wrapper catches every exception and re-packages it as `IPC_HANDLER_ERROR`, those typed errors become invisible to the renderer and the user loses useful diagnostic information.

**Decision**: the wrapper distinguishes three categories when catching an exception thrown by the business handler:

1. **Known passthrough errors** — instances of the typed error classes defined by previous features. The wrapper extracts the class's `name` or `code` property and uses it as the envelope's `error.code`, preserving the original message. A lookup table in the wrapper maps class names to envelope codes, with a default fallthrough.
2. **Zod `ZodError` from the schema parse** — produces `IPC_INPUT_INVALID` with a message that names the first invalid field.
3. **Any other exception** — produces `IPC_HANDLER_ERROR` with a generic message and the original exception's message concatenated.

This preserves the strict-Codex-execution doctrine (a `CODEX_CLI_INVALID_JSON` thrown from a skill call remains visible as such) and the workspace boundary posture (a `WorkspacePathEscapeError` thrown from a future path builder surfaces with its own code), while still catching truly unexpected exceptions with a generic code.

### Risk 2 — Bi-context import of `app/shared/schemas/`

**Concern**: Schema files must compile and run in both the main process context (Node APIs available, Electron APIs available) and the renderer context (neither). If a schema file accidentally imports `electron` or `node:fs`, the renderer build breaks.

**Decision**: `app/shared/schemas/` is already consumed by both sides today (the strategy schema from feature 001 is imported by the renderer for form typing and by the main process for validation). The new schema files follow the same rule: zero import from `electron`, zero import from `node:*`, zero import from `app/main/**` or `app/preload/**`. The only allowed imports are `zod`, other files under `app/shared/schemas/`, and type-only imports from `app/shared/types/` (as long as those types themselves do not violate the rule).

A small static check is added to `tests/unit/register-validated-handler.test.ts` that imports every schema file and asserts the import does not throw. This is a weak guard but catches gross violations (`require('electron')` at module load time) before the renderer build does.

### Risk 3 — Positional arguments in workshop handlers

**Concern**: The workshop handlers currently accept multiple positional arguments (up to eight for `workshop:generate-final-draft`: ideaId, typology, objective, structureKey, structureLabel, hookId, hookText, hooks[]). Each argument comes through IPC as a separate positional parameter. Migrating them to a single-object payload would change the renderer-facing signature and violate FR-014 (the renderer API surface must remain identical).

**Decision**: the wrapper supports two modes:

- **Single-input mode** — `registerValidatedHandler(channel, schema, handler)` where the handler takes one input. Used by strategy, ideas, library-search, calendar, and the simple workshop channels that take a single id or a single object.

- **Tuple-input mode** — `registerValidatedTupleHandler(channel, tupleSchema, handler)` where `tupleSchema` is a `z.tuple([...])` describing each positional argument, and `handler` takes the spread tuple elements as its own arguments. Used by `workshop:generate-hooks`, `workshop:get-suggested-structures`, and `workshop:generate-final-draft`.

Both modes produce the same envelope. The preload sees no difference. The renderer sees no difference. The business service method signatures remain unchanged because the handler spreads the tuple before the call.

This is the only structural choice that deserves its own helper function name rather than overloading a single one — the inference rules for `z.tuple` vs `z.object` are different enough that a type-safe single-function signature would be unwieldy.

## Rollout Plan

Single work unit on the `003-ipc-validation` branch. Each of the seven handler files gets its own commit on top of the wrapper commit, so a regression can be bisected to a single file. At the end, a regression and polish commit closes the feature. The superpowers `finishing-a-development-branch` phase runs separately.

No partial rollout, no feature flag, no environment-gated behavior.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(empty)* | *(empty)* | *(empty)* |

No constitution violation. No complexity justification required.
