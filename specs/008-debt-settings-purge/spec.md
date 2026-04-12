# Feature Specification: UX Debt — Chantier 6

**Feature Branch**: `008-debt-settings-purge`
**Created**: 2026-04-12
**Status**: Draft
**Input**: User description: "UX debt — chantier 6 of the LinkedIn Poster roadmap. Seven UX targets bundled in a single feature to clear the user-friction backlog."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Confirmation before purging execution logs (Priority: P1)

A maintainer cleans up the workspace and clicks "Purger les logs" in Settings. Today the click immediately deletes every Codex execution log on disk — an irreversible action that destroys the investigation history of any recent bug. After this feature, the click first transforms the button into "Confirmer la suppression des N logs" (with the exact count loaded via a new IPC) plus an "Annuler" button. The maintainer needs a deliberate second click to actually purge.

**Why this priority**: P1 because it prevents data loss with minimal effort. The current state is a footgun that has zero protection.

**Independent Test**: Open Settings, click "Purger les logs" once → button transforms with the count, no deletion happens. Click "Confirmer" → logs are purged, message displays count deleted. Click "Annuler" between the two → state reverts and logs are intact.

**Acceptance Scenarios**:
1. **Given** the user is on the Settings screen with N execution logs on disk, **When** they click "Purger les logs" once, **Then** the button changes to "Confirmer la suppression des N logs" alongside an "Annuler" button, and zero files have been deleted.
2. **Given** the confirmation state, **When** the user clicks "Confirmer", **Then** all N logs are deleted and the success message reports the exact count.
3. **Given** the confirmation state, **When** the user clicks "Annuler", **Then** the button reverts to its initial state and zero files are deleted.

---

### User Story 2 — Per-step loading states in the workshop (Priority: P1)

The user is in the workshop atelier and clicks "Suivant : Structure". Today they see a single status string "Selection de la structure..." but no indication that *this specific step* is loading — the button stays clickable, the panel stays the same, and a slow Codex call leaves them wondering whether their click registered. After this feature, each step has its own boolean loading state. While loading, the "Suivant" button is disabled and shows a spinner with "Generation en cours...", and the target panel renders a skeleton placeholder.

**Why this priority**: P1 because the absence of feedback during ~5-30 second Codex calls is the most common source of confusion. The fix is small and removes a class of "did my click work?" support questions.

**Independent Test**: Mock the workshop IPC to delay each call by 2 seconds. Click "Suivant : Structure" → button immediately becomes disabled with spinner + "Generation en cours...", and the StructurePanel renders a skeleton instead of an empty list. After the mock resolves, the button re-enables and the real structures appear.

**Acceptance Scenarios**:
1. **Given** the workshop is on step 1 and the user clicks "Suivant : Structure", **When** the Codex call to `getSuggestedStructures` is in flight, **Then** the "Suivant : Structure" button is disabled with a spinner and "Generation en cours..." text, and the destination panel renders a skeleton.
2. **Given** any per-step loading is in flight, **When** the user clicks the back button (e.g. "Retour" from step 2 to step 1), **Then** navigation succeeds — the back action remains clickable so the user can cancel.
3. **Given** a per-step loading completes successfully, **When** the next panel renders, **Then** the spinner disappears and the panel shows the real content.

---

### User Story 3 — Sourced and readable Codex error messages in the workshop (Priority: P1)

A workshop step fails because Codex CLI is not authenticated. Today the user sees "Erreur lors de la generation des hooks." — uninformative and unactionable. After this feature, the same failure shows "Codex CLI n'a pas pu démarrer. Vérifie qu'il est installé et authentifié (`codex login`)." with the technical code `CODEX_CLI_FAILED` displayed in a small monospace badge underneath. Editorial failures (where the skill returns `status: "failed"` with a meaningful editorial reason) preserve the original message verbatim instead of replacing it with a generic phrase.

**Why this priority**: P1 because Codex failures are the most common runtime issue and the current generic message provides zero diagnostic value.

**Independent Test**: Mock the workshop IPC to throw an error with `code: "CODEX_CLI_FAILED"`. Click "Suivant : Structure" → the error display shows the actionable message about `codex login` and the `CODEX_CLI_FAILED` code badge. Repeat with `code: "CODEX_CLI_TIMEOUT"`, `code: "CODEX_CLI_INVALID_JSON"`, and a Codex `failed` status with a custom editorial message — each shows its own readable message without the generic prefix.

**Acceptance Scenarios**:
1. **Given** a workshop Codex call throws an error with code `CODEX_CLI_FAILED`, **When** the error is caught, **Then** the user sees the actionable message about `codex login` plus the technical code `CODEX_CLI_FAILED` in a small badge.
2. **Given** a workshop call returns `status: "failed"` with an editorial `error.message` like "Le titre est trop générique", **When** the error is displayed, **Then** the user sees that exact editorial message preserved verbatim, without the "Erreur lors de la..." prefix.
3. **Given** any error display, **When** the user looks for the technical code, **Then** it is visible in a small monospace style separate from the human-readable message.

---

### User Story 4 — Detailed run errors with log file open in the runner (Priority: P1)

A maintainer investigates why a recent Codex run failed. Today the runner page shows the run with a generic "Cette etape n'a pas produit de sortie exploitable" — no error details, no path to the log. After this feature, every failed run displays its `error.code` in monospace, its `error.message` in normal text, and a "Ouvrir le log technique" button that opens the JSON log file in the system editor. The button is disabled when no log path was recorded for the run.

**Why this priority**: P1 because it converts the runner from a passive history page into an actual diagnostic tool. Combined with US3, it closes the loop "see error → click → read full details".

**Independent Test**: Run the workshop until a failure occurs (or fixture-mock one), navigate to the runner, observe that the failed run card shows the error code + message + an enabled "Ouvrir le log technique" button. Click the button → the system editor opens the JSON file. For a run without a `log_path` (e.g. from library or news services), the button is disabled with a tooltip explaining why.

**Acceptance Scenarios**:
1. **Given** a failed run with a non-null `log_path`, **When** the maintainer views the runner page, **Then** the run card shows the `error.code` in monospace, the `error.message` in normal text, and an enabled "Ouvrir le log technique" button.
2. **Given** a failed run with a null `log_path`, **When** the maintainer views the runner page, **Then** the same error details appear but the "Ouvrir le log technique" button is disabled with a hint that no log was recorded.
3. **Given** the maintainer clicks "Ouvrir le log technique", **When** the IPC call succeeds, **Then** the system editor opens the JSON log file at the recorded path.

---

### User Story 5 — Visual cues for empty strategy sections (Priority: P2)

A new user opens the strategy screen and starts filling sections. Today the empty sections are silently rendered without any indication that leaving them empty will degrade the downstream skills' output quality. After this feature, each section displays a completion bar at the top (5 segments highlighting based on field count) and an orange badge "Section incomplète : impactera la qualité de [skill name]" when the section is below a critical threshold. The save action remains permitted regardless — the cues are informative, not blocking.

**Why this priority**: P2 because it improves the editorial quality output indirectly, but the strategy screen is functional without it.

**Independent Test**: Open strategy with an empty bundle → every section shows a near-empty completion bar and the orange badge. Add fields → the bar fills up. When a section reaches its completion threshold, the badge disappears.

**Acceptance Scenarios**:
1. **Given** the strategy screen with the profile section having an empty `name` and empty `positioning`, **When** the screen renders, **Then** the profile section shows a completion bar at 0 / 5 and an orange badge "Section incomplète : impactera la qualité de post-writer".
2. **Given** the user fills in `name` and `positioning`, **When** the screen re-renders, **Then** the badge disappears (or downgrades) and the completion bar reflects the new fill ratio.
3. **Given** any section has its visual cues active, **When** the user clicks "Enregistrer la strategie", **Then** the save still succeeds — the cues are informative only.

---

### User Story 6 — Three-card separation of input modes in IdeasScreen (Priority: P2)

A new user opens the ideas screen and sees a wall of forms. Today the three input modes (manual idea entry, news transformation, generate-from-strategy) coexist without clear visual separation. After this feature, the screen shows three distinct cards side by side, each with its own title, description, and primary action button.

**Why this priority**: P2 because it improves discoverability for new users but does not block the existing flow.

**Independent Test**: Open IdeasScreen and verify that exactly three cards are visible above the existing backlog list, each with a distinct title and a single primary action button.

**Acceptance Scenarios**:
1. **Given** the IdeasScreen renders, **When** the user looks at the top of the page, **Then** they see three cards titled "Saisir une idée", "Transformer une veille", "Générer depuis la stratégie", each with its own description and action button.
2. **Given** the user clicks "Transformer la veille en draft" inside the second card, **When** the action completes, **Then** the same news-to-post flow as before runs (no behavior change in the underlying flow).
3. **Given** the IdeasScreen renders, **When** the user scrolls below the three cards, **Then** the existing backlog list of ideas is unchanged.

---

### User Story 7 — Dashboard onboarding polish + clickable counters (Priority: P2)

A first-time user lands on the dashboard with an empty workspace. Today they see four counters all showing 0 and a generic onboarding message. After this feature, the dashboard detects "first run" state (no strategy, no ideas, no drafts) and displays a large CTA "Commencer ici → Stratégie" that navigates to `/strategie`. Each existing counter becomes clickable and navigates to its corresponding screen.

**Why this priority**: P2 because the dashboard already has the basic onboarding text. The polish reduces the time-to-first-action for new users but is not critical.

**Independent Test**: Mock all dashboard data sources to return empty → observe the large "Commencer ici" CTA. Click any counter card → URL updates to the matching screen path.

**Acceptance Scenarios**:
1. **Given** the dashboard loads and `strategyReady === false && ideasCount === 0 && draftsCount === 0`, **When** the screen renders, **Then** a prominent "Commencer ici → Stratégie" CTA is visible and links to `/strategie`.
2. **Given** the dashboard is in normal (non-first-run) state, **When** the user clicks the "Idées" counter card, **Then** the URL navigates to `/idees`.
3. **Given** the dashboard is loading initial data, **When** the user looks at the counter cards, **Then** they see a skeleton placeholder instead of "0".

---

### User Story 8 — Responsive drawer below 768px (Priority: P2)

A user opens the app on a small viewport (iPad mini portrait, narrow Electron window, mobile browser). Today the sidebar consumes 30-40% of the screen even though feature 004's media query made the inner padding more compact. After this feature, the sidebar collapses to a hidden drawer below 768px and is opened via a hamburger button placed in the top-left of the main content. Clicking the overlay or any nav link closes the drawer automatically. Above 768px, the desktop layout is byte-for-byte unchanged.

**Why this priority**: P2 because the desktop experience is already correct. The drawer is purely a quality-of-life improvement for narrow viewports and adds the most regression risk of the feature.

**Independent Test**: Resize the browser to 600px width → sidebar disappears and a hamburger button appears in the top-left of the main area. Click hamburger → drawer slides in from the left with a semi-transparent overlay. Click a nav link → navigation happens and drawer closes. Click overlay → drawer closes without navigation. Resize back to 1200px → desktop layout returns identical to before.

**Acceptance Scenarios**:
1. **Given** the viewport width is below 768px and the drawer is closed, **When** the user clicks the hamburger button, **Then** the drawer slides in from the left and a semi-transparent overlay covers the main content.
2. **Given** the drawer is open, **When** the user clicks any nav link, **Then** the destination screen renders and the drawer closes automatically.
3. **Given** the drawer is open, **When** the user clicks the overlay, **Then** the drawer closes and the URL is unchanged.
4. **Given** the viewport width is 1200px (desktop), **When** the page renders, **Then** the sidebar is visible at its previous fixed position and no hamburger button is shown.

---

### Edge Cases

- **Settings: count is 0 logs**: the confirmation button shows "Confirmer la suppression des 0 logs" and the purge IPC returns `deletedCount: 0` without error.
- **Settings: user clicks "Annuler" then "Purger" again**: the count is re-fetched (the state is fresh).
- **Workshop: per-step loading + Codex error**: if the Codex call fails during loading, the loading state clears AND the error display appears at the same time.
- **Workshop: error code is unknown**: if `error.code` does not match any known mapping, fall back to the original message + display the unknown code in monospace.
- **Runner: openRunLog called for a run that does not exist**: the IPC returns an error code `RUN_NOT_FOUND` and the UI displays a small inline error.
- **Runner: openRunLog called for a run with `log_path === null`**: the IPC returns an error code `LOG_PATH_NULL` and the UI displays a hint instead.
- **Strategy: section was complete then user removes the last item**: the badge re-appears and the bar drops accordingly.
- **Ideas: news source text is empty**: the existing validation in the news flow still applies; the card UI does not change the validation logic.
- **Dashboard: counter is loading and user clicks**: the skeleton has `pointer-events: none` so clicks during loading do nothing.
- **Drawer: viewport resizes from 600px to 1200px while drawer is open**: the drawer state is preserved but becomes irrelevant because the desktop sidebar takes over.
- **Drawer: keyboard Escape press while drawer is open**: closes the drawer (basic a11y).

## Requirements *(mandatory)*

### Functional Requirements

#### US1 — Settings purge confirmation

- **FR-001**: A new IPC method `settings.countExecutionLogs()` MUST exist and return the integer count of execution log files on disk without deleting any.
- **FR-002**: The purge button in `SettingsScreen.tsx` MUST require two clicks: the first transforms the button into a confirmation state showing the exact count and an "Annuler" button; the second click on "Confirmer" actually invokes `settings.purgeExecutionLogs()`.
- **FR-003**: The "Annuler" button MUST revert to the initial state without any side effect.
- **FR-004**: The confirmation state MUST be inline in the same section — no native popup, no modal overlay.

#### US2 — Workshop per-step loading

- **FR-005**: The `useWorkshopFlow` hook MUST expose four boolean loading flags: `isLoadingStructures`, `isLoadingHooks`, `isLoadingDraft`, `isLoadingCorrection`.
- **FR-006**: Each Codex call in the hook (`nextToStep2`, `nextToStep3`, `nextToStep4`, `correct`) MUST set its corresponding flag to `true` at the start of the call and `false` in a `finally` clause.
- **FR-007**: Each step's primary "next" button MUST be disabled and display "Generation en cours..." with a spinner element when its corresponding loading flag is `true`.
- **FR-008**: The destination sub-component MUST render a skeleton placeholder when its loading flag is `true` (e.g., `StructurePanel` renders 3 skeleton cards instead of the empty structure list while `isLoadingStructures === true`).
- **FR-009**: Back navigation buttons MUST remain clickable during loading.

#### US3 — Workshop error sourcing

- **FR-010**: The `useWorkshopFlow` hook MUST capture the error code from caught exceptions instead of replacing them with a generic string.
- **FR-011**: The hook MUST expose an `error: { code: string; message: string } | null` field in its returned state.
- **FR-012**: A new code-to-message mapping MUST exist for: `CODEX_CLI_FAILED` → "Codex CLI n'a pas pu démarrer. Vérifie qu'il est installé et authentifié (`codex login`).", `CODEX_CLI_TIMEOUT` → "Codex CLI a dépassé son délai. La génération a été interrompue.", `CODEX_CLI_INVALID_JSON` → "Codex CLI a renvoyé une réponse invalide. Réessaie ou consulte le log.", `SKILL_PROMPT_NOT_FOUND` → "Le prompt d'une compétence est manquant. Vérifie le fichier `skills/<name>/SKILL.md`.".
- **FR-013**: For Codex `status: "failed"` results carrying an editorial `error.message`, the message MUST be displayed verbatim without the generic "Erreur lors de la..." prefix.
- **FR-014**: Every error display in `WorkshopScreen.tsx` MUST show the `error.code` in a small monospace badge alongside the human-readable message.

#### US4 — Runner error detail + log open

- **FR-015**: A new IPC method `execution.openRunLog(runId)` MUST exist and call `shell.openPath(logPath)` for the run identified by `runId`.
- **FR-016**: The IPC MUST validate that `runId` exists and that the corresponding run has a non-null `log_path`. On failure, it MUST return a stable error code: `RUN_NOT_FOUND` if no run matches the id, `LOG_PATH_NULL` if the run exists but has no log path.
- **FR-017**: `ExecutionScreen.tsx` MUST display, for every failed run, the `error.code` in monospace and the `error.message` in normal text.
- **FR-018**: A "Ouvrir le log technique" button MUST appear on every failed run card. The button is disabled when `log_path === null` and shows a hint explaining why.

#### US5 — Strategy empty section cues

- **FR-019**: Each strategy sub-component (`ProfileSection`, `OffersSection`, `IcpsSection`, `PillarsSection`, `VoiceRulesSection`) MUST display a completion bar at its top with 5 segments, the count of filled segments matching the count of filled fields (or filled list entries for the list sections) up to a max of 5.
- **FR-020**: When a section is below its critical threshold, it MUST display an orange badge with the text "Section incomplète : impactera la qualité de [skill]". The skill name is: `linkedin-strategy-foundation` for the profile, `linkedin-post-writer` for offers and ICPs, `linkedin-structure-selector` for pillars, `linkedin-hook-engine` for voiceRules.
- **FR-021**: The critical thresholds are: profile = name AND positioning both empty; offers / icps / pillars / voiceRules = 0 entries.
- **FR-022**: The cues MUST be purely informative — they MUST NOT block the save action or any other interaction.

#### US6 — IdeasScreen 3-card separation

- **FR-023**: `IdeasScreen.tsx` MUST display three distinct cards above the existing backlog list, each with its own title, description and primary action button. The titles are: "Saisir une idée", "Transformer une veille", "Générer depuis la stratégie".
- **FR-024**: The underlying flows behind each card's primary button MUST be unchanged from today (manual idea creation, news-to-post, generate from strategy).
- **FR-025**: The existing backlog list of ideas MUST remain visible below the three cards with no change.

#### US7 — Dashboard polish

- **FR-026**: When `strategyReady === false && ideasCount === 0 && draftsCount === 0`, `DashboardScreen.tsx` MUST display a prominent CTA labeled "Commencer ici → Stratégie" that links to `/strategie`.
- **FR-027**: Each counter card MUST be a clickable link navigating to its corresponding screen: strategy → `/strategie`, ideas → `/idees`, drafts → `/bibliotheque`, planned → `/calendrier`, runner mode → `/runner`.
- **FR-028**: While initial data is loading, each counter card MUST display a skeleton placeholder instead of the integer "0".

#### US8 — Responsive drawer

- **FR-029**: `App.tsx` MUST manage a `isDrawerOpen` boolean state via a `useState` hook (no Context, no global store).
- **FR-030**: A hamburger button MUST appear in the top-left of `<main class="content">` only when the viewport is below 768px. The button is hidden via CSS media query above 768px.
- **FR-031**: Below 768px, the sidebar MUST be styled with `position: fixed` and `transform: translateX(-100%)` when `isDrawerOpen === false`, and `transform: translateX(0)` when `isDrawerOpen === true`. A semi-transparent overlay MUST cover the main content area when `isDrawerOpen === true`.
- **FR-032**: Clicking any nav link in the drawer MUST set `isDrawerOpen` to `false`.
- **FR-033**: Clicking the overlay MUST set `isDrawerOpen` to `false` without navigating.
- **FR-034**: Pressing the Escape key while the drawer is open MUST close the drawer.
- **FR-035**: Above 768px, the sidebar MUST render at its existing fixed position with no behavioral change. The hamburger button MUST be hidden.

#### Non-regression and identity guardrails

- **FR-036**: This feature MUST NOT introduce any regression on the existing gates: at least 355 unit tests passing, zero `npm audit --audit-level=high --omit=dev` vulnerabilities, typecheck/lint/build clean, the 14-step real-app audit succeeding, the six-check verify-hardening script succeeding on macOS, and the 3-OS GitHub Actions CI staying green on `main`.
- **FR-037**: This feature MUST NOT change any IPC schema introduced by feature 003. It only ADDS two new IPC schemas: `settings.countExecutionLogs` (no input, output: `{ count: number }`) and `execution.openRunLog` (input: `{ runId: string }`, output: `{ opened: boolean }`).
- **FR-038**: This feature MUST NOT modify any `skills/linkedin-*/SKILL.md` content.
- **FR-039**: This feature MUST NOT add any new npm dependency.
- **FR-040**: Every commit produced for this feature MUST be authored by `Philippe Cohen <contact@AutomatisIA.fr>` with no `Co-Authored-By` trailer and no mention of any AI assistant.

### Key Entities *(none — UI feature, no new persistent data)*

This feature introduces no new database table, no new schema migration, no new domain object. The two new IPC methods are read-only queries (`countExecutionLogs`) and side-effect helpers (`openRunLog`). Every other change is a UI rearrangement.

## Success Criteria *(mandatory)*

- **SC-001**: A maintainer clicking "Purger les logs" cannot delete any log without a deliberate second click. Time to revert via "Annuler" is under 2 seconds.
- **SC-002**: During any Codex workshop call, the user sees a visible loading indicator within 100 milliseconds of clicking the trigger button.
- **SC-003**: When a Codex workshop call fails with a known error code, the user sees an actionable message within the same display area, plus the technical code in a monospace badge.
- **SC-004**: A maintainer can open the JSON log file of any failed run that has a recorded `log_path` in two clicks (navigate to runner, click "Ouvrir le log technique").
- **SC-005**: A new user opening the strategy screen with an empty bundle sees at least 5 visual cues (one per section) signaling that the strategy is incomplete.
- **SC-006**: A new user opening IdeasScreen sees three visually distinct cards within 1 second of page load.
- **SC-007**: A first-run user lands on the dashboard and sees a single dominant CTA pointing to `/strategie`. Clicking it navigates within 200ms.
- **SC-008**: Resizing the browser from 1200px to 600px collapses the sidebar to a hamburger button without any layout shift on screens above 768px.
- **SC-009**: All existing gates pass: 355+ tests, 0 npm audit vulns, typecheck/lint/build clean, real-app-audit 14 steps, verify-hardening 6 checks, CI 3-OS green.
- **SC-010**: A `git log --all --grep="Claude" --oneline` over the entire repo returns zero matches at HEAD.

## Out of Scope

- Refactor of the shell layout beyond adding the drawer (no router migration, no global state container, no theming).
- i18n.
- Full WCAG audit.
- Animation polish beyond a simple `transition: transform 200ms ease-out`.
- IdeasScreen sub-component decomposition (only the visual card wrapper is added).
- Drawer state persistence in localStorage.
- Toast notification framework.
- Global keyboard shortcuts beyond Escape closing the drawer.

## Assumptions

- The `error.code` field is reliably populated by the IPC envelope from feature 003 — every workshop IPC call goes through `registerValidatedHandler` which standardizes error codes. If a code is missing, the fallback display uses "UNKNOWN_ERROR".
- The `log_path` column in `execution_runs` is reliably set or null per the schema introduced in feature 007. The runner UI does not need to handle malformed paths.
- The viewport width threshold of 768px aligns with feature 004's existing media query and is the only breakpoint introduced. No tablet-specific or landscape-specific tuning is part of this feature.
- The skeleton placeholders use a static gray block style. No animated shimmer (out of scope for animation polish).
