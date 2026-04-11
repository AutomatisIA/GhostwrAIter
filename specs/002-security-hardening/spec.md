# Feature Specification: Security hardening and dependency refresh before open-source publication

**Feature Branch**: `002-security-hardening`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Security hardening and full dependency refresh before open-source publication of LinkedIn Poster. Triggered by a pre-publication audit that surfaced two HIGH-severity CVEs, an unhardened Electron `webPreferences` configuration, an unvalidated workspace-root environment variable, a blocking `spawnSync` call for Codex CLI with no timeout, and a dynamic-DDL anti-pattern in the Workshop service. User directive: "MIT license, everything must be as up-to-date as possible before publication."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean security baseline before publication (Priority: P1)

As the project maintainer, before publishing the source code under the MIT license, I need the application to pass a dependency audit with zero known vulnerabilities, ship a hardened Electron runtime configuration, and refuse dangerous environment input at startup — so that I am not handing attackers a ready-to-exploit target the day the repository becomes public.

**Why this priority**: This is the single non-negotiable prerequisite for open-source publication. Publishing now with two HIGH CVEs and an unsandboxed renderer would expose every first-day user. Nothing else on the roadmap matters until this is done.

**Independent Test**: Can be fully verified by running the project's dependency audit tool and observing a zero-vulnerability report, by launching the packaged application and confirming that the renderer process is sandboxed, that Content Security Policy headers are present and restrictive, and that external navigation from inside the app is refused.

**Acceptance Scenarios**:

1. **Given** a clean clone of the repository on any supported developer machine, **When** the standard dependency audit command is run after installing dependencies, **Then** it reports zero vulnerabilities at any severity level.
2. **Given** the built application is launched, **When** the renderer tries to open an arbitrary external URL through navigation or a link click, **Then** the navigation is either refused or delegated to the user's default browser, never loaded inside the application window.
3. **Given** the application is running, **When** the renderer attempts to execute inline scripts or load scripts from a third-party origin, **Then** the browser content-security policy blocks the attempt.
4. **Given** a reviewer inspects the Electron window configuration, **When** they read the `webPreferences` object, **Then** every security-relevant flag (`sandbox`, `contextIsolation`, `nodeIntegration`, `webSecurity`) is explicit and aligned with current Electron security recommendations.

---

### User Story 2 - No functional regression for existing users (Priority: P1)

As an end user already using LinkedIn Poster, after the maintainer rolls out the hardening and dependency refresh I must continue to use Strategy, Ideas, Workshop, Library, Calendar, Runner and Settings exactly as before, with no new error, no missing feature, no crash, no performance regression, and no change in the look and feel.

**Why this priority**: Security hardening that breaks existing functionality is worse than not hardening at all: it forces users to either downgrade (losing the fix) or abandon the tool. This story shares P1 with Story 1 because both must be true on publication day.

**Independent Test**: Can be fully verified by running the full automated test suites (unit, integration where present, end-to-end) and the project's real-application audit script end-to-end, and by manually walking through the seven-step canonical user journey from Strategy through Settings.

**Acceptance Scenarios**:

1. **Given** the existing automated test suites, **When** they are run after the hardening is complete, **Then** every suite passes without regressions.
2. **Given** the existing real-application audit script, **When** it is executed end-to-end against the newly hardened build, **Then** every section it covers passes.
3. **Given** a user follows the canonical onboarding journey (fill Strategy → capture an Idea → produce a draft in the Workshop → create a variant in the Library → schedule it in the Calendar → check Runner diagnostics → export from Settings), **When** they complete each step, **Then** the system behaves identically to the pre-hardening version.
4. **Given** the preload API surface `window.linkedinPoster.*`, **When** any renderer screen invokes any of its methods, **Then** the method continues to function normally despite the renderer now running inside the Chromium sandbox.

---

### User Story 3 - Graceful handling of a stuck Codex invocation (Priority: P2)

As a user in the middle of generating a draft or a hook, if the Codex CLI hangs — for any reason including an unresponsive model, a network stall, a local authentication glitch — I must receive a clear actionable error within a bounded time window, rather than watching the application freeze indefinitely and having to kill it from the task manager.

**Why this priority**: This is a reliability issue, not a publication blocker. The current behavior is unpleasant but rare, and the fix is localized to the Codex runner. Bundled with P1 because the runner file is already being touched for other hardening work, so it is cheaper to do now than in a separate future feature.

**Independent Test**: Can be fully verified by simulating a hanging Codex invocation (mock runner that never returns) and observing that the application surfaces an error within the configured timeout window, that the error uses the existing typed-error contract shared by all Codex failures, and that subsequent invocations are not affected.

**Acceptance Scenarios**:

1. **Given** a Codex invocation that never completes, **When** the configured timeout elapses, **Then** the runner returns a typed failure error that is handled identically to other Codex failure modes (invalid payload, unavailable binary, weak input rejection).
2. **Given** a Codex invocation that hangs and is terminated by the timeout, **When** the user triggers another generation immediately after, **Then** the second invocation proceeds normally without requiring a restart.
3. **Given** a Codex invocation that completes normally within the timeout window, **When** it returns its result, **Then** the timeout mechanism does not introduce any observable latency or side effect.

---

### User Story 4 - Safe workspace configuration (Priority: P2)

As a power user who configures the workspace location through an environment variable (for instance to keep data on an encrypted volume or a non-synced folder), I expect the application to reject any malformed, relative, or traversal-prone value at startup with a clear error message, rather than silently writing my data to an unexpected location.

**Why this priority**: This is a defence-in-depth hardening that protects against a small but real class of mistakes. The attack surface is narrow (the environment variable is local) but the blast radius of getting it wrong is large (data in a wrong place, possibly overwriting unrelated files).

**Independent Test**: Can be fully verified by launching the application with various hand-crafted values of the workspace-root environment variable — empty, relative, containing `..` segments, pointing outside the user's writable area — and confirming that each invalid value is rejected at startup before any file is created, with an error message that names the variable and explains what is wrong.

**Acceptance Scenarios**:

1. **Given** the workspace-root environment variable is unset, **When** the application starts, **Then** it uses the default user-data location as before, with no change in behavior.
2. **Given** the workspace-root environment variable contains `..` segments that attempt to escape outside a reasonable root, **When** the application starts, **Then** it refuses to start and reports the offending value.
3. **Given** the workspace-root environment variable is a relative path, **When** the application starts, **Then** it refuses to start and reports that an absolute path is required.
4. **Given** the application writes files under the workspace (database, exports, logs, content), **When** it constructs any file path, **Then** the path resolves to a location under the workspace root; any attempt to escape produces a typed error.

---

### User Story 5 - Clear security documentation for the first contributors (Priority: P3)

As a future open-source contributor, when I first read the project documentation, I need a plainly-written section that tells me what security guarantees the project currently makes, what it does not, and what known limitations I should be aware of — so that I can make informed decisions about contributing or deploying.

**Why this priority**: Written documentation is not a runtime safety mechanism, but its absence makes the project look unprofessional to prospective contributors and invites bad-faith critique on the day of publication. Low priority because it does not block functionality.

**Independent Test**: Can be fully verified by reading the updated operations documentation and confirming that it explicitly names: the new Codex timeout behavior, the workspace-root validation behavior, the fact that application data is stored unencrypted on disk, and any limitation explicitly accepted as out-of-scope for this hardening cycle.

**Acceptance Scenarios**:

1. **Given** a new contributor who has never seen the project, **When** they read the operations documentation, **Then** they learn that the SQLite database and execution logs are stored in plain text on the local disk and that synchronizing the workspace to a cloud folder will upload this content.
2. **Given** a new contributor investigating behavior, **When** they read the documentation, **Then** they find an explanation of the Codex timeout, what triggers it, what the user sees when it fires, and how to tune it if needed.
3. **Given** a new contributor investigating the workspace, **When** they read the documentation, **Then** they find the validation rules applied to the workspace-root environment variable and the error messages it can produce.

---

### Edge Cases

- **Transitive vulnerability surfaces after upgrade**: a fresh vulnerability could appear in a transitive dependency pulled in by one of the upgraded direct dependencies. In that case, the audit stays red and the feature is not done. If no fix is available upstream, the maintainer must decide between pinning an older version of the direct dependency, overriding the transitive, or accepting the issue with a documented justification.
- **Breaking change in the upgraded Electron major**: the upgrade from the current Electron major to the latest stable may remove or alter an API in use. Every affected callsite must be migrated; if no migration path exists, the feature is not done and the fallback is to stop at the last Electron version without the issue and document why.
- **Renderer sandbox blocks the preload API**: activating the Chromium sandbox may require the preload script to use a contextBridge for API exposure if it does not already. Any callsite that loses access must be restored via contextBridge before the feature is considered done.
- **Content security policy breaks development hot-reload**: a strict CSP that is appropriate for production may block the development-mode hot-reload pipeline. The policy must therefore be environment-aware: strict in production builds, relaxed just enough in development to let hot-reload function.
- **Timeout fires on a legitimate long generation**: an unusually long but legitimate Codex invocation could trip the timeout. The default must be generous enough that ordinary generations never trigger it, and the value must be configurable for users with slow setups.
- **Timeout race with normal completion**: a Codex invocation that completes at nearly the same instant the timeout fires must never produce an inconsistent result or a double error; the race must be resolved in favor of one outcome.
- **Workspace-root variable points to an existing but unwritable directory**: validation must distinguish "malformed" (syntactic) from "unwritable" (operational) and produce different, helpful errors for each.
- **Dependency upgrade introduces a type or behavior change that existing tests do not cover**: the real-application audit script and the canonical user journey must catch gaps that the unit tests miss.
- **Application is launched with a working directory different from the repository root** (for instance, from a packaged build or a launcher shortcut): security-sensitive resolutions must not depend on the current working directory.

## Requirements *(mandatory)*

### Functional Requirements

#### Dependency posture

- **FR-001**: The project's dependency audit report MUST show zero vulnerabilities at any severity level (info, low, moderate, high, critical) after the feature is complete.
- **FR-002**: Every direct dependency listed in the project manifest MUST be at its latest stable release compatible with the project's declared minimum runtime, unless an explicit written justification in the feature records prevents it.
- **FR-003**: Every direct development dependency listed in the project manifest MUST be at its latest stable release compatible with the project's declared minimum runtime, unless an explicit written justification in the feature records prevents it.
- **FR-004**: The project MUST no longer declare any direct dependency that is not actually imported by project source code; unused declared dependencies MUST be removed.
- **FR-005**: The Electron runtime MUST be at its latest stable major release compatible with the project's native dependencies.

#### Electron runtime hardening

- **FR-006**: The main application window MUST be created with the Chromium sandbox enabled.
- **FR-007**: The main application window MUST be created with context isolation enabled, Node integration disabled, and web security enabled, all stated explicitly rather than relying on framework defaults.
- **FR-008**: The preload script MUST continue to expose the complete `window.linkedinPoster.*` API to the renderer through a safe bridge mechanism, despite the sandbox being enabled.
- **FR-009**: The renderer MUST enforce a Content Security Policy that forbids loading scripts from origins other than the application itself and forbids the execution of inline scripts in production builds.
- **FR-010**: Any attempt from within the renderer to navigate to an external origin, or to open a new window pointing to an external origin, MUST be refused by the main process; the user's default browser MAY be delegated the request when appropriate.
- **FR-011**: Developer tooling that reveals application internals (such as developer tools panels) MUST be available in development builds and disabled in production builds.

#### Workspace boundary

- **FR-012**: When the workspace-root environment variable is set, the application MUST validate its value before creating any file or directory. The validation MUST reject empty strings, relative paths, and values that contain escape segments attempting to walk out of a reasonable parent.
- **FR-013**: When the workspace-root environment variable is invalid, the application MUST fail fast at startup with an error message that names the variable and explains what is wrong, and MUST NOT create files in a default or unexpected location as a silent fallback.
- **FR-014**: Every file path derived from the workspace root — database file, export file, log file, content file — MUST resolve to a path located under the workspace root after normalization; any path that escapes the root MUST produce a typed error.

#### Codex invocation resilience

- **FR-015**: The Codex command-line invocation MUST be subject to a timeout. The default timeout MUST be generous enough that ordinary generations never trigger it, and the value MUST be configurable through an environment variable.
- **FR-016**: When the timeout fires, the application MUST terminate the hanging Codex process and MUST return a typed failure result to the skill runner, using the same error-reporting contract as other Codex failure modes.
- **FR-017**: A terminated Codex invocation MUST NOT leave the application in a state that prevents subsequent invocations from succeeding; in particular, any resources held for the duration of the invocation MUST be released.

#### Dynamic-DDL pattern cleanup

- **FR-018**: Any location in the code base that constructs a data-definition query from a variable table name or column name MUST validate those names against an explicit allowlist before issuing the query, so that a future contributor cannot inadvertently introduce a real injection by wiring user input into the same helper.

#### Regression discipline

- **FR-019**: Every pre-existing automated test suite (unit, integration where present, end-to-end) MUST pass on the feature branch before the feature is considered complete.
- **FR-020**: The existing real-application audit script MUST pass end-to-end on the feature branch before the feature is considered complete.
- **FR-021**: The packaged build pipeline MUST succeed on the feature branch without errors or critical warnings.
- **FR-022**: The strict-execution Codex principle of the previous milestone MUST be preserved: the application continues to refuse invalid, unavailable, or below-contract Codex outputs rather than degrading to a local fallback.

#### Documentation

- **FR-023**: The operations documentation MUST describe the Codex timeout, including its default value, its configuration method, and what the user sees when it fires.
- **FR-024**: The operations documentation MUST describe the workspace-root validation rules and the error messages that a user may encounter when configuring an invalid value.
- **FR-025**: The operations documentation MUST clearly state that the local application data — database, drafts, execution logs — is stored unencrypted on the local disk, and that any synchronization of the workspace folder to a cloud service uploads this content in clear text.
- **FR-026**: The operations documentation MUST list the known security limitations explicitly accepted as out-of-scope for this hardening cycle, with a pointer to the broader roadmap for follow-up work.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The project's dependency audit tool reports zero vulnerabilities at any severity level when run on the feature branch after dependencies are installed.
- **SC-002**: A maintainer walking through the canonical seven-step user journey (Strategy → Ideas → Workshop → Library → Calendar → Runner → Settings) on the hardened build reaches the end without encountering any new error, missing screen, or functional regression compared to the pre-hardening baseline.
- **SC-003**: When a Codex invocation is made unresponsive on purpose, the user-visible error surfaces within five seconds of the configured timeout elapsing, and a subsequent invocation issued immediately after succeeds normally on the same running application.
- **SC-004**: Any attempt to start the application with an invalid workspace-root value produces a startup-time error that names the offending variable, and zero files are created under any default or fallback location during the failed startup.
- **SC-005**: Any attempt from within the application to load an external script or to navigate the main window to an external origin is blocked by the application's content policy and navigation control layer, with no external network request issued for that script.
- **SC-006**: The complete automated test suite of the project passes on the feature branch; the existing real-application audit script passes on the feature branch; the packaged build command completes successfully on the feature branch.
- **SC-007**: A contributor who has never seen the project can read the updated operations documentation and correctly answer, without opening any source file, what the Codex timeout does, how the workspace root is validated, and whether local data is encrypted at rest.
- **SC-008**: A security-conscious reviewer who opens the main application configuration file can, without running the code, confirm that every security-relevant flag is explicit and aligned with the current recommended configuration for the runtime.

## Assumptions

- The latest stable Electron release at the time of implementation is a full major ahead of the current declared version. The upgrade will likely introduce at least one deprecation warning in the main process; migration is in scope.
- The default Codex timeout of 120 seconds is sufficient for every v1 editorial skill under normal conditions. The longest skill (the post writer with enriched strategy context) typically completes in well under 60 seconds; 120 seconds provides headroom without making a real hang feel instant.
- Strict Content Security Policy in production builds is appropriate because the renderer never needs to load third-party scripts, inline scripts, or remote styles at runtime. Development builds may require a more permissive policy to preserve the hot-reload pipeline; the policy is therefore environment-aware.
- "Latest stable version" for each dependency means the latest published release on the project's package registry that is not explicitly tagged as prerelease and that is compatible with the project's declared minimum runtime version. Transitive vulnerabilities are addressed only when the project's audit tool flags them.
- The user-visible presentation of Codex timeout errors is handled by the existing Runner and Workshop error-reporting paths. This feature does not change how errors are displayed, only how they are produced and typed.
- Encryption of the local SQLite database, cryptographic verification of the Codex binary, and systematic input validation of IPC handlers via a schema library are explicitly out of scope for this feature and are tracked as separate follow-up features on the open-source publication roadmap.
- The workspace-root environment variable is used exclusively for local development, automated testing, and power-user customization. It is never set by a non-trusted caller in a normal end-user scenario.

## Dependencies and Relationships

- This feature depends on the previous milestone (`001-linkedin-editorial-cockpit`) being committed and stable. That milestone introduced the strict-execution Codex doctrine that FR-022 commits to preserving.
- This feature is the first of six chantiers on the open-source publication roadmap. It must complete before chantier 2 (systematic IPC input validation), chantier 3 (cross-platform portability), chantier 4 (code-quality refactoring), chantier 5 (CI/CD and open-source metadata), and chantier 6 (UX debt).
- This feature touches several files that chantier 2 and chantier 3 will also touch later. The implementation plan should aim for changes that do not unnecessarily constrain those follow-up features.

## Out of Scope

- Systematic schema-based validation of inter-process communication inputs across all handlers.
- Cross-platform packaging and launch scripts for Windows and Linux.
- Introduction of a centralized error model unifying synchronous exceptions and asynchronous failure results.
- Extraction of code-duplication between the Workshop and Library services.
- Introduction of a CI/CD pipeline and open-source project metadata (license text, contributor guide, issue templates).
- User-visible improvements to the Workshop, Runner, Ideas or Strategy screens (loading states, empty-field signaling, source-of-result display, error detail display).
- Encryption of the local SQLite database or the execution-log files.
- Cryptographic verification of the Codex command-line binary before invocation.
- Internationalization or English translation of the user interface.
- Extraction of the renderer as a web application or progressive web app.
