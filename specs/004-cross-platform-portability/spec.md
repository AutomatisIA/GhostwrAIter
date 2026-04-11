# Feature Specification: Cross-platform portability and responsive renderer baseline

**Feature Branch**: `004-cross-platform-portability`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Open LinkedIn Poster to Windows and Linux contributors before the open-source publication. The project has completed the security hardening (feature 002) and the IPC validation (feature 003). Four macOS-only anchors remain: the `open-mac-latest.sh` launcher script, the `build-mac-launcher.mjs` / `mac-launcher-lib.mjs` packaging helpers, the hardcoded Homebrew directories in the Codex CLI runner, and the electron-builder configuration which currently only targets macOS. The renderer is also not responsive below a hardcoded sidebar width of 320 pixels. The maintainer works from a macOS machine and cannot validate Windows or Linux builds end-to-end in this session; the CI/CD validation is the scope of chantier 5.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Windows contributor can develop against the project (Priority: P1)

As a contributor running Windows who has just cloned the public repository, I want to install the dependencies, run the development build, run the test suite, and produce a packaged Windows binary, so that I can fix a bug, extend a feature, or verify an integration without owning a macOS machine.

**Why this priority**: an open-source project that only compiles on macOS excludes roughly half of the potential contributor population before they write a single line of code. Of the four macOS anchors in the codebase today, two are execution-time blockers on Windows (the launcher scripts crash, the Codex binary detection only knows Homebrew paths) and two are build-time blockers (the electron-builder configuration declares only a macOS target, and the maintainer scripts assume the `mac-arm64` output directory). All four must be resolved for the story to pass.

**Independent test**: on a Windows machine, a contributor clones the repository, runs the standard install command, runs the development command, runs the test command, and runs the packaging command for Windows. Every step completes without an error, the development window opens, the test suite reports green, and the packaging command produces a Windows executable artifact.

**Acceptance Scenarios**:

1. **Given** a Windows machine with the documented prerequisites installed, **When** the contributor runs the install command, **Then** every dependency installs without an error and the native module rebuild step completes for the Windows Electron target.
2. **Given** the dependencies are installed, **When** the contributor runs the development command, **Then** the main Electron window opens and the renderer loads the dashboard.
3. **Given** the dependencies are installed, **When** the contributor runs the test command, **Then** the full test suite reports the same green outcome as on macOS.
4. **Given** the dependencies are installed, **When** the contributor runs the Windows packaging command, **Then** the command produces at least one Windows executable artifact under the output directory.
5. **Given** the packaged Windows build is launched, **When** the application starts, **Then** the main window opens and the canonical user journey (Strategy → Ideas → Workshop → Library → Calendar → Runner → Settings) remains usable.
6. **Given** the Codex CLI is installed at a standard Windows location, **When** the application starts, **Then** it detects the Codex binary without requiring a macOS-specific path fragment.
7. **Given** the Codex CLI is not installed, **When** the application starts, **Then** the application still starts, the Runner page reports Codex as unavailable, and no request is silently downgraded.

---

### User Story 2 - Linux contributor can develop against the project (Priority: P1)

As a contributor running Linux who has just cloned the public repository, I want the same install, development, test, and packaging experience as the Windows story, so that I can work from any mainstream Linux distribution without owning a macOS or Windows machine.

**Why this priority**: identical rationale to User Story 1 for a different operating system family. Linux is the third widely adopted operating system and is over-represented among open-source contributors, so closing the gap is critical for publication.

**Independent test**: identical to User Story 1 but on a Linux machine, with the packaging command producing an AppImage artifact or a Debian package artifact instead of a Windows executable.

**Acceptance Scenarios**:

1. **Given** a Linux machine with the documented prerequisites installed, **When** the contributor runs the install command, **Then** the installation completes and the native module rebuild succeeds for the Linux Electron target.
2. **Given** the dependencies are installed, **When** the contributor runs the development command, **Then** the main Electron window opens and the renderer loads.
3. **Given** the dependencies are installed, **When** the contributor runs the test command, **Then** the full test suite reports green.
4. **Given** the dependencies are installed, **When** the contributor runs the Linux packaging command, **Then** the command produces at least one AppImage or Debian package under the output directory.
5. **Given** the Codex CLI is installed at a standard Linux location, **When** the application starts, **Then** it detects the Codex binary.

---

### User Story 3 - The maintainer keeps the macOS workflow fully operational (Priority: P1)

As the project maintainer working from a macOS machine, after this portability feature lands I must continue to run the development command, the test command, the real-application audit, the verify-hardening script, and the macOS-specific launcher script exactly as before, with no new error, no missing screen, and no functional regression.

**Why this priority**: a portability feature that regresses the author's own platform is unshippable. This story shares P1 with Stories 1 and 2 because all three must be true on merge day.

**Independent test**: on the maintainer's macOS machine, every pre-existing command continues to work. The test suite reports the same count as before. The real-application audit walks the canonical journey end-to-end. The verify-hardening script reports every feature-002 check as passing. The macOS launcher script still opens the packaged application.

**Acceptance Scenarios**:

1. **Given** the refreshed codebase, **When** the maintainer runs the test command on macOS, **Then** the same number of tests pass as before the feature.
2. **Given** the refreshed codebase, **When** the maintainer runs the real-application audit script, **Then** every step completes successfully as before.
3. **Given** the refreshed codebase, **When** the maintainer runs the verify-hardening script, **Then** every security check passes as before.
4. **Given** the refreshed codebase and a packaged macOS build, **When** the maintainer runs the existing macOS launcher script, **Then** the packaged application opens.
5. **Given** the Codex CLI installed at its usual Homebrew location, **When** the application starts on macOS, **Then** it detects the Codex binary exactly as before.

---

### User Story 4 - Usable layout when the window is narrow (Priority: P2)

As a user resizing the application window to a narrow width, or as a future contributor opening the renderer in a narrow browser viewport when a web mode becomes available, I want the layout to remain readable and navigable instead of producing an unusable overflow with a fixed 320-pixel sidebar pushing content off-screen.

**Why this priority**: this is a baseline responsive behavior, not a mobile-first redesign. It is P2 because the immediate portability story does not strictly require it, but it costs very little and closes a known usability gap flagged in the initial portability audit. Without this story the application is functionally cross-platform but visually broken at narrow widths.

**Independent test**: with the application running, resize the window to below 768 pixels wide. The sidebar either collapses or becomes a horizontally scrollable top bar. No content is cut off. Every navigation item remains reachable.

**Acceptance Scenarios**:

1. **Given** the application is running at a width of 1200 pixels, **When** the user resizes the window to 600 pixels wide, **Then** the layout reorganizes so that no horizontal content is cut off.
2. **Given** the application is running at a narrow width, **When** the user tries to reach any of the seven navigation destinations, **Then** each destination is reachable without horizontal scroll gymnastics.
3. **Given** the application is running at a width above 768 pixels, **When** the user looks at the layout, **Then** the previous sidebar layout is unchanged.

---

### User Story 5 - Clear cross-platform installation documentation (Priority: P3)

As a first-time contributor on any of the three supported operating systems, I want to read a single section of the operations documentation that tells me exactly what to install, what commands to run, and what artifacts to expect, so that I can go from zero to a running development environment in under fifteen minutes without trial and error.

**Why this priority**: documentation follows the runtime capability. Without the P1 and P2 stories complete, the documentation would describe something that does not exist.

**Independent test**: a reader who has never seen the project can read the new section of the documentation and, in under fifteen minutes, run through the install, development, test, and packaging commands on their own operating system without opening any source file.

**Acceptance Scenarios**:

1. **Given** a new contributor on Windows, **When** they read the cross-platform installation section, **Then** they know the exact prerequisites, install command, development command, test command, and packaging command for Windows.
2. **Given** a new contributor on Linux, **When** they read the same section, **Then** they know the exact equivalents for Linux.
3. **Given** a new contributor on macOS, **When** they read the same section, **Then** they see the existing macOS commands documented alongside the other platforms.
4. **Given** the documentation, **When** a reader checks the section, **Then** it mentions that Windows and Linux builds have not yet been validated end-to-end in the development session that introduced portability, and points to the chantier that will add that validation via continuous integration.

---

### Edge Cases

- **No Codex CLI installed on the host**: the cross-platform detection must return cleanly, the runner must report Codex as unavailable, and the strict-execution doctrine must reject generation requests rather than silently downgrade.
- **Codex CLI installed at a non-standard path**: the detection must honor the operating system's PATH environment variable in addition to the hardcoded fallbacks, so that a manual installation is recognized as long as the binary is on the PATH.
- **Codex CLI present but not authenticated**: the availability check already handles this via the existing `codex login status` call; this feature must not change that behavior.
- **macOS launcher script invoked from a Linux or Windows shell**: must detect the operating system mismatch and exit with an advisory message rather than throwing a shell error.
- **Electron-builder invoked with the wrong platform target**: running the Windows packaging command on macOS, or the Linux packaging command on Windows, may fail because of missing platform tooling; the documentation must note that each platform's packaging command is expected to run on the matching host by default, and that cross-compilation is a later-chantier concern.
- **Icons missing from the assets directory**: if the build configuration references an icon file that does not exist, the packaging command must produce a readable error message naming the expected path rather than crashing with a stack trace.
- **Window resized below the narrow breakpoint on macOS**: the responsive behavior must activate on every operating system, not just on the target cross-platform builds.
- **Content security policy violation from a responsive UI library**: the responsive baseline must not introduce any new inline script, new external stylesheet, or new resource that would be blocked by the feature-002 content security policy.
- **Native module rebuild across operating systems**: the rebuild command that exists today compiles the native SQLite binding against the local Electron target. On each of the three supported operating systems, that command must produce a working binary without requiring a manual toolchain setup beyond the documented prerequisites.
- **`process.cwd()` leaking into app-relative path resolution**: any code that currently builds a file path from the current working directory must either be left alone (if it references a user-controlled directory that should honor the shell) or switched to an Electron-provided application directory (if it references a bundled asset). No shipped code may rely on the working directory matching the repository root after packaging.

## Requirements *(mandatory)*

### Functional Requirements

#### Build and packaging matrix

- **FR-001**: The project's packaging configuration MUST declare at least one Windows target and at least one Linux target in addition to the existing macOS target. The Windows target MUST include a native installer format. The Linux target MUST include at least one portable format recognized by common Linux distributions.
- **FR-002**: The project's packaging scripts MUST expose a named command for each of the three operating systems so a contributor can invoke the packaging pipeline for their own operating system without passing additional flags.
- **FR-003**: The packaging configuration MUST declare a platform-appropriate icon for each of the three operating systems. Placeholder icons that can be replaced by a designer later are acceptable; a missing icon reference is not.
- **FR-004**: The native module rebuild step that exists in the current development workflow MUST continue to work on the maintainer's macOS machine and MUST be documented as the same step on Windows and Linux.

#### Runtime cross-operating-system behavior

- **FR-005**: The application's detection of the external command-line tool used for generation MUST work on the three supported operating systems without a code path containing a hardcoded operating-system-specific directory as its only lookup strategy.
- **FR-006**: On macOS, the detection MUST preserve the existing behavior of honoring the shell PATH and falling back to the two conventional Homebrew directories, so that a maintainer does not lose any capability.
- **FR-007**: On Linux, the detection MUST honor the shell PATH and fall back to the conventional Linux installation directories (`/usr/local/bin`, `/usr/bin`, and the user's local installation directory), while accepting the same binary name used on macOS.
- **FR-008**: On Windows, the detection MUST honor the shell PATH and fall back to the conventional Windows program installation directories, while accepting a binary name that may end in the Windows executable extension.
- **FR-009**: When the detection does not find the external command-line tool on any of the supported platforms, the application MUST start normally and report the absence on its diagnostics screen. No generation request may succeed silently in that case. This is the same strict-execution doctrine established in the earlier milestones, preserved unchanged.
- **FR-010**: The application MUST NOT use the current working directory to resolve paths that refer to bundled assets shipped with the packaged application. Paths that refer to user-controlled directories (configuration, workspace, user data) may continue to rely on environment variables and on the Electron-provided user data directory.

#### Macros and developer tooling

- **FR-011**: Scripts that are only applicable to macOS (the existing launcher script and the packaging-helper scripts) MUST detect the host operating system before running and exit with an advisory message naming the macOS requirement when invoked on another operating system. They MUST NOT throw a raw shell or runtime error.
- **FR-012**: The hardcoded output directory name inside macOS-specific scripts MUST continue to point to the macOS packaging output directory when the script is run on macOS. The scripts MAY be extended to recognize the Windows or Linux output directory in a follow-up chantier, but this feature does not require it.

#### Responsive renderer baseline

- **FR-013**: The renderer MUST remain usable when the application window is resized below a width of 768 pixels. "Usable" means that every navigation destination stays reachable, no content is hidden behind a clipped sidebar, and no horizontal page scroll is required to reveal primary interactive controls.
- **FR-014**: The responsive behavior MUST activate at the same threshold on every operating system. The threshold is 768 pixels of rendered viewport width.
- **FR-015**: The responsive behavior MUST NOT introduce any resource loaded from an origin outside the application's own bundle. The feature-002 content security policy MUST remain intact.
- **FR-016**: Above the 768-pixel threshold, the layout MUST remain visually identical to the current layout that feature 002 shipped.

#### Non-regression and non-weakening

- **FR-017**: Every automated check that passed at the end of feature 003 (the unit and component test suite, the type checker, the linter, the packaged build, the real-application audit script, the verify-hardening script) MUST continue to pass on the maintainer's macOS machine at the end of this feature.
- **FR-018**: Every security posture invariant established by feature 002 (the sandbox, the context isolation, the Node integration disabling, the web security flag, the content security policy, the navigation guards, the DevTools gating, the workspace validation, the Codex timeout) MUST remain intact.
- **FR-019**: Every inter-process communication invariant established by feature 003 (the validation of every channel, the typed error envelope, the preservation of the renderer API surface, the passthrough of typed errors from upstream features) MUST remain intact.
- **FR-020**: The project dependency audit MUST continue to report zero vulnerabilities of any severity level at the end of the feature.
- **FR-021**: No new runtime dependency is added by this feature. Cross-operating-system detection MUST rely on the existing standard library already used by the project.

#### Documentation

- **FR-022**: The operations documentation MUST gain a section titled "Installation cross-platform" (or an equivalent heading in French or English matching the rest of the document's voice) that enumerates, for each of the three supported operating systems, the prerequisites, the install command, the development command, the test command, and the packaging command.
- **FR-023**: The same section MUST acknowledge that the Windows and Linux builds have not yet been validated end-to-end in the development session that introduced portability, and MUST point to the continuous integration chantier that will deliver automated multi-operating-system validation.

### Key Entities

*(Not applicable — this feature introduces no new business entity. It modifies configuration, detection logic, scripts, styles, and documentation.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the maintainer's macOS machine, every automated check that passed at the end of feature 003 (the unit and component test suite, the type checker, the linter, the packaged build, the real-application audit script, the verify-hardening script) still passes at the end of this feature, and the application behaves identically.
- **SC-002**: The project's packaging configuration declares a Windows target and a Linux target in addition to the existing macOS target, with platform-appropriate installer formats for each.
- **SC-003**: The detection of the external command-line tool correctly identifies the tool when installed at its conventional location on each of the three supported operating systems, and returns "not available" cleanly when the tool is absent. Verifiable by unit tests that mock the host operating system and assert the lookup paths per platform.
- **SC-004**: A contributor resizing the application window to a width of 600 pixels can navigate to every one of the seven canonical destinations without horizontal scroll gymnastics. Above 768 pixels, the layout is visually identical to the feature-002 baseline.
- **SC-005**: A contributor reading the updated operations documentation can identify the exact install, development, test, and packaging commands for their own operating system in under one minute, without opening any source file.
- **SC-006**: The project dependency audit reports zero vulnerabilities at any severity level. No new runtime dependency is added by this feature.
- **SC-007**: The macOS-only scripts, when invoked on a non-macOS host, print a clear advisory message and exit with a non-zero status, without crashing.
- **SC-008**: The real-application audit script and the verify-hardening script, when run on the maintainer's macOS machine at the end of the feature, report the same fourteen-step and six-check pass counts they reported at the end of feature 003.

## Assumptions

- The maintainer continues to work from macOS during this feature and cannot execute the Windows or Linux packaging pipeline end-to-end. The feature's deliverable is the code, the configuration, and the documentation necessary to enable those pipelines; the validation of those pipelines is the responsibility of the continuous integration chantier that follows.
- The external command-line generation tool is installed on Windows and on Linux following the tool's own conventional installation instructions. The feature does not attempt to detect tool installations under arbitrary custom locations beyond honoring the shell PATH, because honoring PATH already covers every conventional installation path on every operating system.
- The responsive breakpoint of 768 pixels is chosen as the industry-standard tablet-narrow boundary. It is not a mobile-first redesign; it is a minimum viable defense against layout breakage at narrow widths.
- The native SQLite binding used by the project has prebuilt binaries for each supported operating system and is rebuilt locally against the Electron target by the existing rebuild command. If a specific operating system lacks a prebuilt binary, a local build toolchain must be installed as documented; this feature does not ship its own toolchain.
- Platform-specific icon assets will be finalized by a designer in a later chantier. For now, placeholder icons that satisfy the build-time reference check are acceptable.

## Dependencies and Relationships

- This feature depends on feature 002 (security hardening) and feature 003 (IPC validation) being present on the branch it starts from. It preserves every invariant those two features established.
- This feature is independent of the quality-evaluation chantier (3.5), the refactoring chantier (4), the continuous integration chantier (5), and the UX debt chantier (6), and can be merged in any order relative to them. The continuous integration chantier is the natural next step because it is what validates the Windows and Linux builds that this feature makes possible.

## Out of Scope

- Continuous integration multi-operating-system build pipeline (chantier 5).
- Platform-specific launcher scripts for Windows and Linux equivalent to the existing macOS launcher. Users launch the packaged application directly via the native installer.
- Finalized icon artwork; placeholder icons only.
- Internationalization or translation of the application or its documentation.
- Extraction of the renderer into a progressive web application or a standalone web mode.
- Touch-first mobile user experience beyond the narrow-width breakpoint defense.
- Accessibility compliance beyond what is required to keep the narrow-width layout reachable.
- Code signing, notarization, app-store distribution, or auto-update flows.
- Cross-compilation of Windows or Linux packages from macOS (each platform's packaging command runs on the matching host by default).
- Any change to the editorial skills, the Codex runner's prompts, or the business services.
