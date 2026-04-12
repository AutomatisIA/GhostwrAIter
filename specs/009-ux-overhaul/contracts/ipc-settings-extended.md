# IPC Contract: Extended Settings API

**Date**: 2026-04-12  
**Scope**: New channels added to `window.linkedinPoster.settings`

## New Channels

### `settings:get-preference`

**Input**: `{ key: string }` (Zod: `z.object({ key: z.string().min(1) })`)  
**Output**: `{ key: string, value: string | null }`  
**Behavior**: Returns the stored value for the given key from `app_settings` table, or `null` if not set.

### `settings:set-preference`

**Input**: `{ key: string, value: string }` (Zod: `z.object({ key: z.string().min(1), value: z.string() })`)  
**Output**: `{ key: string, value: string, updated_at: string }`  
**Behavior**: Upserts the key-value pair in `app_settings`. Returns the stored row.

### `settings:get-all-preferences`

**Input**: none  
**Output**: `Record<string, string>` (all key-value pairs as flat object)  
**Behavior**: Returns all settings as a dictionary.

## New Channels: Engine Management

### `settings:detect-engines`

**Input**: none  
**Output**: `{ engines: CliEngineStatus[] }`  
**Behavior**: Runs binary detection + auth check for all supported CLI engines. Returns current status for each.

### `settings:get-active-engine`

**Input**: none  
**Output**: `{ engine: string, status: CliEngineStatus }`  
**Behavior**: Returns the currently selected engine name and its live status.

### `settings:set-active-engine`

**Input**: `{ engine: "codex" | "gemini" | "claude" }`  
**Output**: `{ engine: string, status: CliEngineStatus }`  
**Behavior**: Sets the active engine preference. Validates that the engine is at least installed (not necessarily authenticated). Returns updated status.

## Modified Channel

### `execution:get-diagnostics` (breaking change)

**Old output**: `{ runnerMode, codexAvailable, message, availableSkills }`  
**New output**: `{ activeEngine, engines: CliEngineStatus[], availableSkills, message }`  
**Migration**: Renderer code referencing `codexAvailable` or `runnerMode` must be updated. The `activeEngine` field replaces `runnerMode`, and `engines[].installState === "authenticated"` replaces `codexAvailable`.

## Unchanged Channels

All existing settings channels remain unchanged:
- `settings:export-workspace`
- `settings:count-execution-logs`
- `settings:purge-execution-logs`
