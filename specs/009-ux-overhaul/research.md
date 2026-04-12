# Research: 009 UX Overhaul

**Date**: 2026-04-12

## R1: CSS Theming Strategy

**Decision**: Migrate all hardcoded color values to CSS custom properties, with two theme sets (light/dark) applied via `data-theme` attribute on `<html>`.

**Rationale**: The current `styles.css` has zero CSS custom properties — all ~60 color values are hardcoded inline. A dark theme requires a systematic variable layer. CSS custom properties are the lightest approach (no runtime JS, instant swap, no dependency). The `data-theme` attribute pattern is standard for Electron apps and avoids flash-of-wrong-theme issues.

**Alternatives considered**:
- CSS-in-JS (styled-components/emotion): Rejected — project uses global CSS, migration would be massive and unnecessary.
- Tailwind dark mode: Rejected — project doesn't use Tailwind, adding it now is scope creep.
- `prefers-color-scheme` media query only: Rejected — doesn't support user override (the 3-option selector: System/Light/Dark).

**Color mapping strategy**: Define semantic tokens (--color-bg-primary, --color-text-primary, etc.) mapped to the existing palette for light theme, and inverted equivalents for dark theme. Preserve glassmorphism in both themes by adjusting opacity values.

## R2: Theme Preference Persistence

**Decision**: Store theme preference in SQLite `app_settings` table (new), not localStorage.

**Rationale**: The app already uses SQLite for all persistence. localStorage in Electron is tied to the renderer process and can be wiped by clearing app data. A dedicated `app_settings` key-value table is consistent with the existing architecture and will also serve engine selection (FR-031). The main process reads it at startup to set the initial theme before the renderer loads, avoiding flash-of-wrong-theme.

**Alternatives considered**:
- localStorage: Simpler but not accessible from main process, inconsistent with app architecture.
- JSON config file: Workable but adds a second persistence mechanism; SQLite is already there.
- electron-store: External dependency, rejected per constitution VI (simplicity for MVP).

## R3: Multi-CLI Engine Abstraction

**Decision**: Create a `CliEngine` interface with three implementations (Codex, Gemini, Claude). The existing `CodexCliRunner` already uses dependency injection for all its seams (command executor, filesystem, prompt loader). The abstraction wraps the spawn call and result parsing.

**Rationale**: The current `CodexCliRunner` uses `spawnSync` with Codex-specific args (`exec --skip-git-repo-check --ephemeral --output-last-message`). Each CLI has different invocation patterns:
- **Codex**: `codex exec --ephemeral --output-last-message <path> -` (stdin prompt, JSON output file)
- **Claude Code**: `claude --print --output-format json "<prompt>"` (arg prompt, stdout JSON)
- **Gemini CLI**: `gemini --json "<prompt>"` (arg prompt, stdout JSON)

The skill prompts (SKILL.md) stay identical. Each engine adapter handles: binary detection, auth check, invocation args, output parsing, and error mapping to the existing `SkillRunnerResult` contract.

**Alternatives considered**:
- HTTP API calls instead of CLI: Rejected — constitution I mandates local-first, CLI tools handle their own auth without exposing API keys.
- Single generic spawn with config: Too fragile — each CLI has different output formats and error conventions.

## R4: Navigation Restructure Impact

**Decision**: Reduce from 8 routes to 5, with redirect aliases for backwards compatibility.

**Route mapping**:
- `/` → Cockpit (replaces Dashboard)
- `/strategie` → Strategy (unchanged)
- `/creer` → Create (merges /idees + /atelier)
- `/bibliotheque` → Library (absorbs /calendrier)
- `/parametres` → Settings (absorbs /runner)

**Redirects**: `/idees` → `/creer`, `/atelier` → `/creer`, `/calendrier` → `/bibliotheque?view=planning`, `/runner` → `/parametres?section=diagnostics`

**Impact on IPC**: Zero. All IPC channels remain unchanged. The restructure is purely renderer-side (routing + component composition).

## R5: Create Screen Architecture

**Decision**: Single `CreateScreen` component with internal state machine: `idle` (show ideas list + creation forms) → `workshop` (show 4-step workflow). Remplacement progressif per clarification.

**Rationale**: The current `WorkshopScreen` already manages its 4-step state via `useWorkshopFlow(ideaId)`. The `CreateScreen` wraps it: when no idea is selected, it renders the ideas panel (ported from `IdeasScreen`). When an idea is selected, it renders the workshop panel. A "Changer d'idée" button resets to idle state.

**Reuse**: `useWorkshopFlow` hook, all workshop sub-components (CadragePanel, StructurePanel, HookPanel, DraftPanel, WorkshopGuide), and idea creation logic from IdeasScreen. No new IPC channels needed.

## R6: Gemini CLI and Claude Code CLI Detection

**Decision**: Follow the same pattern as `find-codex-binary.ts` — check PATH, then platform-specific standard install locations.

**Detection commands**:
- Codex: `codex --version` (existence) + `codex login status` (auth)
- Claude Code: `claude --version` (existence) + `claude auth status` (auth — returns exit 0 if logged in)
- Gemini CLI: `gemini --version` (existence) + `gemini auth status` (auth)

**Binary locations**:
- macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `~/.local/bin`
- Linux: `/usr/local/bin`, `/usr/bin`, `~/.local/bin`
- Windows: `%ProgramFiles%\<name>\bin`, `%LOCALAPPDATA%\Programs\<name>`

**Caveats**: Gemini CLI exact command format needs runtime verification. The adapter will gracefully degrade if invocation fails.
