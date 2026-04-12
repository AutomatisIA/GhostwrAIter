# Tasks: UX Overhaul

**Input**: Design documents from `/specs/009-ux-overhaul/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD per constitution IV — tests écrits avant l'implémentation pour toute logique métier testable.

**Organization**: Tasks grouped by user story. US2 (headers), US3 (navigation), and US7 (theme) are combined in the Foundational phase because they are structural prerequisites that affect all screens.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

## Path Conventions

- **Main process**: `app/main/`
- **Preload bridge**: `app/preload/`
- **Renderer**: `app/renderer/src/`
- **Shared types**: `app/shared/`
- **Tests**: `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New types, DB schema, settings service — shared foundation for all phases.

- [x] T001 [P] Create shared types for theme and engine in `app/shared/types/settings.ts` (ThemePreference, CliEngineStatus, EngineSelection)
- [x] T002 [P] Create shared types for updated diagnostics in `app/shared/types/execution.ts` (modify ExecutionDiagnostics to new shape with activeEngine + engines[])
- [x] T003 [P] Create Zod validation schemas for new settings IPC channels in `app/shared/schemas/settings.ts`
- [x] T004 Add `app_settings` table creation in `app/main/domains/settings/settings.service.ts` (follows existing per-service pattern)
- [x] T005 Create `app/main/domains/settings/settings.service.ts` with getPreference, setPreference, getAllPreferences methods
- [x] T006 Write tests for settings.service in `tests/unit/settings-service.test.ts` (6 tests: get/set/getAll, missing key returns null, upsert behavior)
- [x] T007 Register new IPC channels (settings:get-preference, settings:set-preference, settings:get-all-preferences) in `app/main/ipc/settings-ipc.ts`
- [x] T008 Expose new IPC channels in `app/preload/index.ts` (add to window.linkedinPoster.settings)

**Checkpoint**: Settings persistence infrastructure ready. All subsequent phases can store/retrieve preferences.

---

## Phase 2: Foundational — Theme + Navigation + Headers (US2, US3, US7)

**Purpose**: CSS custom properties migration, dark/light theme, navigation restructure from 8→5, compact headers. These structural changes MUST complete before building new screens.

**⚠️ CRITICAL**: No user story screen work can begin until this phase is complete.

### US7 — Dark/Light Theme (CSS Foundation)

- [x] T009 Write test for theme persistence roundtrip in `tests/unit/theme-preference.test.ts` (4 tests)
- [x] T010 Extract hardcoded color values from `app/renderer/src/styles.css` into CSS custom properties under `:root`
- [x] T011 Define dark theme palette in `app/renderer/src/styles.css` under `:root[data-theme="dark"]`
- [x] T012 Theme initialization handled renderer-side via IPC call in App.tsx useEffect
- [x] T013 Created `applyTheme(preference)` in `app/renderer/src/app/theme.ts`
- [x] T014 `applyTheme` called on renderer startup in `app/renderer/src/app/App.tsx`

### US3 — Navigation 8→5

- [x] T015 Write test for route redirects in `tests/unit/route-redirects.test.ts` (7 tests)
- [x] T016 Modified `sections` array in `app/renderer/src/app/App.tsx` — 5 entries: Cockpit, Stratégie, Créer, Bibliothèque, Paramètres
- [x] T017 Added `<Navigate>` redirect routes in `app/renderer/src/app/App.tsx` for /idees, /atelier, /calendrier, /runner
- [x] T018 Updated sidebar width from 320px to 280px in `styles.css` + compact brand panel
- [ ] T018a Verify mobile drawer (< 768px) renders 5 new nav items — visual check needed

### US2 — Compact Headers

- [x] T019 Modified CSS `.page-panel h1` to `1.4rem`, removed `max-width: 14ch`
- [x] T020 Removed eyebrow elements from all 8 screen components
- [x] T021 Removed description paragraphs from all 8 screen components
- [x] T022 Reduced `.page-panel` padding from 40px to 28px

**Checkpoint**: Theme switching works (light/dark/system with persistence). Navigation shows 5 entries. All headers are compact single-line. Legacy URLs redirect. Ready to build new screens.

---

## Phase 3: User Story 1 — Créer un post sans page vide (Priority: P1) 🎯 MVP

**Goal**: L'écran "Créer" fusionne Idées + Atelier. Plus jamais de page vide.

**Independent Test**: Cliquer "Créer" dans la nav → voir les idées ou un formulaire. Sélectionner une idée → le workshop démarre dans le même écran. Bouton "Changer d'idée" → retour à la sélection.

- [x] T023 [US1] CreateScreen state machine implemented with selecting/workshop modes
- [x] T024 [P] [US1] Created `app/renderer/src/features/create/components/IdeaSelector.tsx`
- [x] T025 [P] [US1] Created `app/renderer/src/features/create/CreateScreen.tsx`
- [x] T026 [US1] Wired CreateScreen into router at `/creer`
- [x] T027 [US1] Empty state shows 3 creation forms with guidance (never empty)
- [ ] T028 [US1] Delete `app/renderer/src/features/ideas/IdeasScreen.tsx` (deferred — safe to delete later)
- [ ] T029 [US1] Delete `app/renderer/src/features/workshop/WorkshopScreen.tsx` (deferred — safe to delete later)

**Checkpoint**: "Créer" screen works end-to-end. No empty page. Ideas selection → workshop transition is seamless.

---

## Phase 4: User Story 4 — Cockpit actionnable (Priority: P2)

**Goal**: Le Cockpit remplace le Dashboard avec pipeline progress, next action, métriques cliquables.

**Independent Test**: Ouvrir l'app → voir le cockpit avec pipeline, prochaine action, et métriques. Premier lancement → assistant de démarrage.

- [x] T030 [US4] Next-action logic implemented in CockpitScreen + dashboard test updated
- [x] T031 [P] [US4] Created `app/renderer/src/features/cockpit/CockpitScreen.tsx`
- [x] T032 [US4] Wired CockpitScreen into router at `/`
- [ ] T033 [US4] Delete `app/renderer/src/features/dashboard/DashboardScreen.tsx` (deferred)

**Checkpoint**: Cockpit guides the user. Pipeline shows real progress. Metrics are clickable.

---

## Phase 5: User Story 5 — Bibliothèque avec planification (Priority: P2)

**Goal**: La Bibliothèque absorbe le Calendrier avec un tab switcher Drafts/Planning et planification inline.

**Independent Test**: Ouvrir la Bibliothèque → voir tab "Drafts" actif. Basculer vers "Planning" → liste chronologique. Cliquer "Planifier" sur un draft → date picker inline.

- [x] T034 [P] [US5] Added tab switcher Drafts/Planning with URL sync, filters preserved
- [x] T035 [P] [US5] Created Planning view with chronological calendar items list
- [x] T036 [US5] Added inline scheduling to draft cards
- [x] T037 [US5] Planned date visible on scheduled draft cards
- [ ] T038 [US5] Delete `app/renderer/src/features/calendar/CalendarScreen.tsx` (deferred)

**Checkpoint**: Library shows both drafts and planning. Scheduling works inline. No separate calendar page needed.

---

## Phase 6: User Story 6 — Paramètres complets (Priority: P2)

**Goal**: Page Paramètres structurée en sections avec thème, moteur, diagnostics, données.

**Independent Test**: Ouvrir Paramètres → voir 4 sections. Changer le thème. Voir les diagnostics d'exécution.

- [x] T039 [P] [US6] Created ThemeSelector.tsx — 3-option segmented control
- [x] T040 [P] [US6] Created DiagnosticsPanel.tsx — execution history, collapsible
- [x] T041 [P] [US6] Created EnginePanel.tsx — engine status placeholder
- [x] T042 [US6] Rewrote SettingsScreen.tsx — 4 sections: Apparence, Moteur, Diagnostics, Données
- [x] T043 [US6] URL param ?section=diagnostics handled via useSearchParams
- [ ] T044 [US6] Delete `app/renderer/src/features/execution/ExecutionScreen.tsx` (deferred)

**Checkpoint**: Settings page is complete with all 4 sections. Theme toggle works. Diagnostics display execution history.

---

## Phase 7: User Story 8 — Multi-CLI et guidance d'installation (Priority: P3)

**Goal**: Supporter Codex, Claude Code, et Gemini CLI. Guidance d'installation pour l'utilisateur.

**Independent Test**: Ouvrir Paramètres → section Moteur. Voir les CLI détectés avec statut. Sélectionner un moteur. Lancer une génération.

- [x] T045 [US8] CliEngine interface tested via execution-service and execution-ipc tests (updated shapes)
- [x] T046 [US8] Engine registry tested via updated execution tests + fallback logic
- [x] T047 [P] [US8] Created `app/main/domains/execution/cli-engine.ts` + `find-cli-binary.ts`
- [x] T048 [US8] Created `app/main/domains/execution/codex-engine.ts` implementing CliEngine
- [x] T049 [P] [US8] Created `app/main/domains/execution/claude-engine.ts`
- [x] T050 [P] [US8] Created `app/main/domains/execution/gemini-engine.ts`
- [x] T051 [US8] Created `app/main/domains/execution/engine-registry.ts` with fallback chain
- [x] T052 [US8] Modified skill-runner.service.ts — optional engineRegistry dependency
- [x] T053 [US8] Modified execution.service.ts — async getDiagnostics with new shape
- [x] T054 [US8] Registered 3 new IPC channels in settings-ipc.ts
- [x] T055 [US8] Engine IPC channels already exposed in preload (done in Phase 1)
- [x] T056 [US8] Rewrote EnginePanel — 3 cards, badges, radio selection, copiable commands

**Checkpoint**: App detects multiple CLI engines. User can select active engine. Generations use the selected engine.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, verification, consistency.

- [x] T057 [P] Removed dead .eyebrow CSS classes from styles.css
- [ ] T058 [P] Verify all screens render correctly in dark theme — visual check needed
- [ ] T059 [P] Verify mobile responsive (< 768px) — visual check needed
- [x] T060 TypeScript compiles with zero errors
- [x] T061 ESLint passes with zero warnings on all new files
- [x] T062 All 374 tests pass (47 test files)
- [ ] T063 Visual quickstart validation needed: 5 nav items, theme switch, no empty pages, engine detection

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (needs settings service for theme persistence)
- **US1 Create (Phase 3)**: Depends on Phase 2 (needs new routes + compact headers)
- **US4 Cockpit (Phase 4)**: Depends on Phase 2 (needs new routes). Parallel with US1, US5, US6.
- **US5 Library (Phase 5)**: Depends on Phase 2 (needs new routes). Parallel with US1, US4, US6.
- **US6 Settings (Phase 6)**: Depends on Phase 2 (needs theme infrastructure + new routes). Parallel with US1, US4, US5.
- **US8 Multi-CLI (Phase 7)**: Depends on Phase 6 (needs Settings UI for engine panel)
- **Polish (Phase 8)**: Depends on all previous phases

### User Story Independence

- **US1 (Create)**: Independent after Phase 2
- **US4 (Cockpit)**: Independent after Phase 2
- **US5 (Library+Planning)**: Independent after Phase 2
- **US6 (Settings)**: Independent after Phase 2
- **US8 (Multi-CLI)**: Depends on US6 (Settings UI as host)

### Within Each Phase

- Tests MUST be written and FAIL before implementation (constitution IV)
- Types/schemas before services
- Services before IPC handlers
- IPC before renderer components
- Tasks marked [P] can run in parallel

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 in parallel (different files)
- **Phase 2**: T010+T011 (CSS themes) parallel with T015+T016+T017 (navigation) parallel with T019+T020+T021 (headers)
- **Phases 3-6**: US1, US4, US5, US6 all parallelizable after Phase 2
- **Phase 8**: T057, T058, T059 in parallel

---

## Parallel Example: After Phase 2

```
# Launch 4 user stories in parallel (different feature directories):
Agent A: Phase 3 — US1 Create Screen (app/renderer/src/features/create/)
Agent B: Phase 4 — US4 Cockpit (app/renderer/src/features/cockpit/)
Agent C: Phase 5 — US5 Library upgrade (app/renderer/src/features/library/)
Agent D: Phase 6 — US6 Settings overhaul (app/renderer/src/features/settings/)
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3)

1. Complete Phase 1: Setup (types, DB, settings service)
2. Complete Phase 2: Foundation (CSS theme + navigation + headers)
3. Complete Phase 3: US1 Create Screen
4. **STOP and VALIDATE**: Theme works, 5 nav entries, Create screen has no empty state
5. This alone delivers massive UX improvement

### Incremental Delivery

1. Setup + Foundation → structural base ready
2. Add US1 Create → MVP (no more empty workshop page)
3. Add US4 Cockpit → actionable home screen
4. Add US5 Library+Planning → unified draft management
5. Add US6 Settings → real settings page
6. Add US8 Multi-CLI → engine flexibility
7. Polish → final consistency

### Parallel Agent Strategy

After Phase 2 foundation:
- 4 agents on US1, US4, US5, US6 simultaneously
- Then 1 agent on US8 (needs US6 complete)
- Then 1 pass of Polish

---

## Summary

- **Total tasks**: 63
- **Phase 1 Setup**: 8 tasks
- **Phase 2 Foundation (US2+US3+US7)**: 14 tasks
- **Phase 3 US1 Create**: 7 tasks
- **Phase 4 US4 Cockpit**: 4 tasks
- **Phase 5 US5 Library**: 5 tasks
- **Phase 6 US6 Settings**: 6 tasks
- **Phase 7 US8 Multi-CLI**: 12 tasks
- **Phase 8 Polish**: 7 tasks
- **Parallel opportunities**: 22 tasks marked [P]
- **MVP scope**: Phases 1+2+3 (29 tasks)
