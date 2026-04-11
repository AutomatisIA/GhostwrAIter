# Feature Specification: Systematic schema validation of every IPC handler

**Feature Branch**: `003-ipc-validation`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Chantier 2 of the open-source publication roadmap. Feature 002 hardened the Electron runtime envelope (sandbox, context isolation, content security policy, navigation guards, workspace validation, Codex CLI timeout). The inter-process communication boundary between the renderer and the main process remains unprotected: most handlers cast their payloads with `as T` and delegate to the business service layer, which crashes with an unhandled type error as soon as the payload is malformed. A compromised renderer, a poorly written test script, or an unexpected shape from a future frontend refactor can therefore take down the main process. This feature installs zod-based validation on every IPC channel, a centralized typed-error envelope for both validation and handler failures, and a unit-test suite for each of the seven handler files.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Closed trust boundary at the IPC seam (Priority: P1)

As the project maintainer, before publishing the source code under the MIT license, I need every message that crosses the inter-process communication boundary from the renderer to the main process to be validated against an explicit schema, so that no malformed payload can reach the business service layer or crash the main process, regardless of what a future frontend regression or an attacker-influenced renderer sends.

**Why this priority**: The IPC seam is the single remaining trust boundary inside the application where the hardening of feature 002 stopped. An XSS bug in any current or future renderer dependency becomes an immediate path into the main process today, because the services happily accept any shape. This must be closed before the source code is public.

**Independent test**: For each of the seven IPC files, send three kinds of payloads through the corresponding channel and observe the outcome. A valid payload produces the same result as before the feature. A payload with a missing required field returns a typed validation failure without reaching the service. A payload whose field has the wrong type returns the same typed validation failure. In no case does the main process crash, throw an unhandled exception, or write inconsistent data to storage.

**Acceptance Scenarios**:

1. **Given** a renderer that sends a well-formed request on any IPC channel, **When** the main process receives the request, **Then** the business service runs exactly as it would have before the feature and the renderer sees the same result it saw before.
2. **Given** a renderer that sends a request missing a required field on any IPC channel, **When** the main process receives the request, **Then** the request is refused before reaching the business service and the renderer receives a typed error whose code identifies the refusal as an input validation failure.
3. **Given** a renderer that sends a request with a field of the wrong type on any IPC channel, **When** the main process receives the request, **Then** the request is refused before reaching the business service and the renderer receives a typed error whose code identifies the refusal as an input validation failure.
4. **Given** a business service that throws an unexpected exception while processing a valid request, **When** the main process catches the exception, **Then** the renderer receives a typed error whose code identifies the failure as an internal handler error, and the main process does not propagate the raw exception or crash.
5. **Given** the existing real-application audit script running against the hardened and validated build, **When** it walks the canonical user journey end-to-end, **Then** every step passes and no typed validation or handler error is produced by a legitimate interaction.

---

### User Story 2 - Single source of truth for IPC input types (Priority: P2)

As a contributor maintaining the renderer, the main process services, and the unit tests, I need the TypeScript types used to describe every IPC input to be derived from a single definition, so that renaming a field or changing a validation rule propagates automatically to every call site and I cannot accidentally ship a renderer that talks to the main process with a shape the main process does not accept.

**Why this priority**: This is a developer-experience story that prevents the kind of drift that the baseline fix commit (`fix(002): restore baseline test suite to green before hardening`) had to resolve: a signature was refactored in one file, the caller in another file was not updated, and the tests only caught it days later. Having one source of truth means a future refactor cannot silently miss a call site.

**Independent test**: A contributor reads any of the seven IPC handler files and can point to the exact definition that produced every input type. No handwritten TypeScript type describes an IPC input independently from its validation schema. A renamed field in the schema causes a compile error at every call site that still uses the old name.

**Acceptance Scenarios**:

1. **Given** a validation schema for an IPC channel, **When** a contributor wants the TypeScript type for that input, **Then** the type is derived from the schema rather than defined separately in a types file.
2. **Given** a renamed field in an IPC validation schema, **When** the project compiles, **Then** every call site that still uses the old name produces a compile error.
3. **Given** a new IPC channel added in the future, **When** a contributor adds it, **Then** the pattern to follow is visible from any existing handler file without having to read the whole documentation.

---

### User Story 3 - Per-file unit test coverage of every handler (Priority: P2)

As the maintainer, before publishing the source code, I need each of the seven IPC handler files to have its own dedicated unit test file that exercises the valid path, at least two distinct invalid paths, and a simulated business-service error, so that a regression in any one handler surfaces as a localized test failure instead of a surprise discovered through the real-application audit or, worse, after publication.

**Why this priority**: Today only one of the seven handler files has a test file. The other six are entirely uncovered at the IPC layer; coverage is implicit through the service-level tests and the real-application audit. That makes it impossible to do a test-first change on an IPC handler. P2 because the protection itself is already delivered by User Story 1; this story is about keeping it protected.

**Independent test**: A contributor writing a new feature that touches any IPC handler can run the test file for that handler in isolation, see all existing cases pass, write a new failing case for the new behavior, observe it fail, implement the behavior, and observe all cases pass — all without running the full application or the real-application audit.

**Acceptance Scenarios**:

1. **Given** the seven IPC handler files, **When** the test suite runs, **Then** each handler file has a corresponding test file covering at minimum a valid-input case, a missing-field case, a wrong-type case, and a simulated handler error case.
2. **Given** a localized change to one handler file, **When** the contributor runs only that handler's test file, **Then** the feedback loop is under a second and requires no Electron launch, no renderer bootstrap, and no Codex CLI availability.
3. **Given** the full test suite, **When** it runs on the feature branch, **Then** every new IPC test file passes alongside every pre-existing test.

---

### User Story 4 - Preserved renderer ergonomics (Priority: P1)

As a renderer engineer working on any of the seven canonical screens, I need the `window.linkedinPoster.*` API surface I use from React components to continue behaving exactly as it does today, so that no screen needs to be rewritten, no existing component test needs to be updated, and the user-visible experience is unchanged.

**Why this priority**: This is what makes the feature safe to merge. If introducing IPC validation forced every screen to learn a new result shape, the refactor footprint would balloon and the risk of UX regression would rise. The preload bridge is the only layer allowed to learn the new envelope shape; every screen keeps talking to the same methods that either return data or throw a typed error.

**Independent test**: Every existing renderer component test continues to pass without any modification to the screen source code, and a manual walk through the canonical seven-step journey in the built app behaves identically to the behavior shipped by feature 002.

**Acceptance Scenarios**:

1. **Given** an existing screen that calls a method on `window.linkedinPoster.*`, **When** the validated main process returns a successful result, **Then** the screen receives the same shape it received before the feature.
2. **Given** an existing screen that calls a method on `window.linkedinPoster.*`, **When** the validated main process returns a typed failure, **Then** the screen observes a thrown Error object with a message informative enough to surface in the existing error-display paths.
3. **Given** the full renderer test suite, **When** it runs on the feature branch, **Then** every screen test passes without any source modification in the renderer.

---

### Edge Cases

- **A handler with no input payload** (for example, list-all, diagnostics, export): the validation layer must still participate so that a renderer that accidentally sends extra data is still refused or ignored consistently. The expected shape is "undefined", not "any".
- **A handler that accepts multiple positional arguments** (currently several workshop handlers): each argument must be validated individually, and the validation layer must preserve the positional calling convention so that the existing preload callers do not need to change.
- **A handler that was already validating its input at the service or repository layer** (the save-bundle case in feature 001): the new IPC-level validation must not double-validate in a conflicting way. If the schema at the IPC layer is a superset or equivalent of the existing internal validation, the internal one can remain as defense in depth.
- **A business service that throws a well-known typed error of its own** (for example a `WorkspaceConfigurationError` from feature 002): the new wrapper must not hide the typed error behind a generic handler-error envelope. The error code from the business layer must still be reachable by the caller.
- **A payload whose value passes validation at the IPC layer but triggers a Codex "source too weak" refusal downstream**: this is the strict-execution doctrine of the previous milestone and must be preserved. The new envelope must carry the downstream refusal without repackaging it as an input validation failure.
- **A concurrent request pattern**: if two invocations of the same channel overlap, each must be validated and answered independently. No shared state introduced by the validation layer.
- **A schema file that gets imported by both the main process and the renderer**: the module must compile and run in both contexts, which means it cannot depend on Electron-only APIs, Node-only APIs, or filesystem I/O.
- **A test file that captures the registered handlers via a `Map<string, Handler>`**: the new wrapper must preserve that pattern so the existing `strategy-ipc.test.ts` pattern can be replicated verbatim for the other six handler files, and so the tests do not need to spin up Electron to exercise the handlers.
- **A developer forgetting to wrap a new handler through the validated path**: the feature should make it at least uncomfortable, ideally impossible, to register a new handler the old way.

## Requirements *(mandatory)*

### Functional Requirements

#### Validation coverage

- **FR-001**: Every inter-process communication channel exposed by the main process MUST validate its incoming payload against an explicit schema before the payload is observed by any business service, repository, or Codex runner.
- **FR-002**: Every schema used for IPC validation MUST be defined in a single, shared location that both the main process and the renderer can import without incurring Electron-specific or Node-specific module initialization.
- **FR-003**: Every validation schema MUST reject a payload whose required field is missing, whose field has the wrong type, or whose field value falls outside the acceptable range, with an error message that names the offending field in plain language.
- **FR-004**: Channels that accept no payload MUST declare an empty-input schema explicitly, so that the absence of an input is a validated fact rather than an implicit default.
- **FR-005**: Channels that accept multiple positional arguments MUST validate each argument individually while preserving the positional calling convention used by the existing preload bridge.

#### Centralized error envelope

- **FR-006**: Every IPC channel MUST return a typed result envelope that distinguishes a successful response from a failure and carries a machine-readable error code when a failure is reported.
- **FR-007**: The error codes MUST distinguish at minimum three categories: an input-validation failure, an internal handler failure, and the absence of a handler for the requested channel. Additional codes MAY be introduced when a business layer already defines its own typed error that deserves to be passed through without repackaging.
- **FR-008**: A failure returned by the main process MUST NOT propagate as a raw thrown exception to the renderer. Every failure path MUST produce the typed result envelope, including when the failure comes from a thrown exception inside a business service.
- **FR-009**: The error messages carried by the envelope MUST NOT include raw payload data that could contain sensitive editorial content. When the payload must be referenced for debugging, only field names, types, and positions MAY be included.

#### Handler migration

- **FR-010**: Every handler declaration in every IPC source file MUST go through the validated registration helper introduced by this feature. No IPC handler MAY be registered via the raw registration primitive from the framework.
- **FR-011**: The validated registration helper MUST log every validation and handler failure through the project's logging facility, with enough context (channel name, failure category) to diagnose the problem from the log stream, without including sensitive payload contents.
- **FR-012**: The migration MUST preserve the existing IPC channel names, positional argument conventions, and successful response shapes so that no change is required in any renderer source file or in any preload bridge definition beyond the envelope unwrapping.

#### Preload ergonomics

- **FR-013**: The preload bridge MUST unwrap the typed result envelope before handing the value back to the renderer. On a successful result, the preload MUST return the successful payload unchanged. On a failure result, the preload MUST throw an Error whose message surfaces the typed error code and human-readable message so the existing renderer error-handling paths continue to work.
- **FR-014**: The renderer API surface `window.linkedinPoster.*` MUST remain identical in name, signature, and success-response shape. No renderer source file that imports from this surface MAY need to be modified as part of this feature.

#### Testing discipline

- **FR-015**: Each of the seven IPC handler files MUST have a dedicated unit test file covering at minimum a successful invocation, a missing-field invalid invocation, a wrong-type invalid invocation, and a simulated handler-error invocation.
- **FR-016**: The IPC handler unit tests MUST exercise the handlers without launching Electron and without depending on a live Codex CLI binary, using the existing fake-runner pattern where Codex is involved.
- **FR-017**: The pre-existing suites (unit, component, end-to-end, real-application audit) MUST continue to pass on the feature branch without any assertion being weakened, skipped, or removed to accommodate the new code.

#### Non-regression and non-weakening

- **FR-018**: The strict-Codex-execution doctrine of feature 001 MUST be preserved. The new envelope MUST NOT allow a below-contract Codex output to surface as a successful response, and MUST NOT introduce a "partial" or "degraded" success category.
- **FR-019**: The hardening of feature 002 MUST remain intact. The Electron sandbox, context isolation, content security policy, navigation guards, workspace validation, Codex timeout, and dynamic DDL whitelist MUST NOT be weakened, removed, or bypassed by this feature.
- **FR-020**: The project dependency audit MUST continue to report zero vulnerabilities of any severity level at the end of the feature.

#### Single source of truth for types

- **FR-021**: Every TypeScript type describing an IPC input that is used by the renderer, the preload bridge, the main process handlers, or the unit tests MUST be derived from the corresponding validation schema rather than being handwritten separately. Where a handwritten type exists today, the feature MUST replace it with the derived type and remove the handwritten declaration if it no longer has any non-IPC consumer.

### Key Entities *(include if feature involves data)*

- **Validation schema**: a declarative description of the expected shape of an IPC input, including its required fields, field types, value ranges, and an inferred TypeScript type.
- **Typed result envelope**: a two-state response produced by every validated handler. A successful state carries the business-layer response data. A failure state carries a machine-readable error code, a human-readable message, and optionally a field reference for validation failures.
- **IPC channel registration**: the act of binding a channel name to a handler function, which now requires presenting both a validation schema and a handler implementation to a single wrapping helper.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every inter-process communication channel exposed by the main process at the end of the feature is registered through the validated helper. Zero channels remain that bypass validation. Verifiable by a static check that every handler file uses the helper and that no file uses the raw registration primitive directly.
- **SC-002**: A deliberately malformed request sent on any IPC channel produces a typed failure result whose error code identifies it as an input validation failure, and does not cause the main process to crash, log an uncaught exception, or leave the database in an inconsistent state. Verifiable by running the new per-handler test suite.
- **SC-003**: A business service exception raised while processing a valid request produces a typed failure result whose error code identifies it as an internal handler error, and does not propagate the raw exception to the renderer. Verifiable by running the new per-handler test suite.
- **SC-004**: A successful request on any channel produces the same response shape a renderer received from the same channel before the feature. Verifiable by the real-application audit script, which walks the full canonical journey and asserts the shape of every success response.
- **SC-005**: The complete pre-existing test suite (unit, component, end-to-end, real-application audit) passes on the feature branch without any assertion being weakened. Verifiable by running the standard test, typecheck, lint, build, and audit commands.
- **SC-006**: The project dependency audit reports zero vulnerabilities of any severity level at the end of the feature, matching the posture established at the end of feature 002.
- **SC-007**: A contributor who wants to add a new IPC channel can find the pattern to follow from any existing handler file in under one minute, without reading the feature documentation or the plan.
- **SC-008**: The renderer source tree has zero modifications compared to the head of the preceding feature branch, other than any handwritten TypeScript input-type declarations that are replaced with schema-derived imports or removed entirely.

## Assumptions

- The validation library used by feature 001 for the Strategy bundle is the project's chosen validation library. This feature extends it to every other IPC channel rather than introducing a second library.
- The existing `strategy-ipc.test.ts` pattern — a `Map<string, Handler>` that captures channel registrations and is then driven by synchronous calls in the test — is the canonical pattern for the new handler tests, and is reusable verbatim for the other six handler files.
- Business services that already throw typed error classes of their own (from feature 002) continue to do so, and those typed errors continue to be caught by the startup-layer handler, not by the new IPC envelope. The new envelope handles only exceptions that escape up through the service call stack during a per-request invocation.
- The renderer is the only client of the IPC channels. No second renderer, no remote client, and no background worker calls these channels.
- The error messages surfaced by the envelope to the renderer are rendered as-is by the existing renderer error-display paths. They are in French where the existing user-facing strings are in French and in English where the existing ones are in English; this feature does not introduce a new user-facing language.

## Dependencies and Relationships

- This feature depends on feature 002 (security hardening) being present on the branch it starts from. Specifically, it depends on the hardened Electron configuration, the workspace validation error classes, the Codex timeout error code, and the restored baseline test suite.
- This feature is the second of six chantiers on the open-source publication roadmap. It is independent of chantier 3 (cross-platform portability), chantier 4 (code-quality refactoring), chantier 5 (CI/CD and open-source metadata) and chantier 6 (UX debt), and can be merged in any order relative to them.
- This feature touches a subset of the same files as chantier 4 will touch later (the IPC handler files). The wrapper helper and the schemas introduced here should not prevent chantier 4's refactor from proceeding; the implementation plan must aim for changes that leave room for future extraction of shared base classes in the handler files.

## Out of Scope

- Refactor of any renderer screen source file beyond the specific case where a handwritten IPC input type is replaced with a schema-derived type import.
- Cross-platform packaging or scripts for Windows and Linux.
- Internationalization of validation error messages.
- Validation of IPC inputs on the renderer side before they are sent to the main process.
- Rate limiting or throttling of IPC invocations.
- Replacement of the logging facility or changes to log file locations and rotation policies.
- Introduction of a second validation library or migration of the existing validation library to a new major version.
- Schema generation from the renderer TypeScript types (reverse direction).
- Automatic documentation of the IPC API surface from the schemas.
