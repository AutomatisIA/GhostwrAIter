# Data Model: 009 UX Overhaul

**Date**: 2026-04-12

## New Table: `app_settings`

Key-value store for user preferences. Used by theme and engine selection.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| key | TEXT | PRIMARY KEY | Setting identifier (e.g., "theme", "active_engine") |
| value | TEXT | NOT NULL | JSON-encoded value |
| updated_at | TEXT | NOT NULL | ISO 8601 timestamp |

**Initial keys**:
- `theme` → `"system"` | `"light"` | `"dark"` (default: `"system"`)
- `active_engine` → `"codex"` | `"gemini"` | `"claude"` (default: first available)

## New Entity: `CliEngineStatus`

Runtime-only (not persisted). Computed at startup and on demand.

| Field | Type | Description |
|-------|------|-------------|
| name | `"codex"` \| `"gemini"` \| `"claude"` | Engine identifier |
| displayName | string | Human-readable name (e.g., "Codex (ChatGPT)") |
| binaryPath | string \| null | Resolved absolute path or null if not found |
| installState | `"not-installed"` \| `"installed"` \| `"authenticated"` | Three-state detection per FR-037 |
| version | string \| null | Version string from `--version` output |
| subscriptionLabel | string | E.g., "Abonnement ChatGPT Plus ou Team" |
| installCommand | string | E.g., "npm install -g @openai/codex" |
| loginCommand | string | E.g., "codex login" |

## Modified Entity: `ExecutionDiagnostics`

Current shape:
```
{ runnerMode, codexAvailable, message, availableSkills }
```

New shape:
```
{
  activeEngine: string           // "codex" | "gemini" | "claude"
  engines: CliEngineStatus[]     // All detected engines
  availableSkills: string[]      // Skills from registry
  message: string                // Human-readable status
}
```

## Unchanged Entities

All existing tables (`ideas`, `drafts`, `draft_versions`, `hooks`, `tags`, `tag_links`, `calendar_items`, `execution_runs`, strategy tables) remain unchanged. The UX overhaul does not modify any existing data structures.

## Navigation Routes (compile-time, not persisted)

| Path | Label | Replaces |
|------|-------|----------|
| `/` | Cockpit | Dashboard (`/`) |
| `/strategie` | Strategie | Strategy (`/strategie`) |
| `/creer` | Creer | Ideas (`/idees`) + Workshop (`/atelier`) |
| `/bibliotheque` | Bibliotheque | Library (`/bibliotheque`) + Calendar (`/calendrier`) |
| `/parametres` | Parametres | Settings (`/parametres`) + Runner (`/runner`) |

## Redirect Aliases (compile-time)

| Old Path | New Target |
|----------|------------|
| `/idees` | `/creer` |
| `/atelier` | `/creer` (preserves `?ideaId=` query param) |
| `/calendrier` | `/bibliotheque?view=planning` |
| `/runner` | `/parametres?section=diagnostics` |
