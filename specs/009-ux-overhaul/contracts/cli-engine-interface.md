# Contract: CLI Engine Interface

**Date**: 2026-04-12  
**Scope**: Abstraction layer for multi-CLI engine support

## Interface: `CliEngine`

Each supported CLI engine implements this interface. The `SkillRunnerService` delegates to the active engine.

### `isInstalled(): Promise<boolean>`

Check if the CLI binary exists on the system (PATH or known locations).

### `isAuthenticated(): Promise<boolean>`

Check if the user is logged in / has valid credentials for the CLI.

### `getStatus(): Promise<CliEngineStatus>`

Full status check: install state, binary path, version, auth state. Returns the `CliEngineStatus` entity from data-model.

### `executeSkill(invocation: SkillRunnerInvocation, promptMarkdown: string): Promise<SkillRunnerResult>`

Execute a skill with the given invocation context and prompt. Returns the standard `SkillRunnerResult` contract (unchanged from current Codex implementation).

**Responsibility of each implementation**:
1. Resolve binary path
2. Construct CLI-specific arguments
3. Pass prompt (stdin or arg depending on CLI)
4. Parse CLI-specific output format into `SkillRunnerResult`
5. Handle timeouts and errors, mapping to standard error codes

## Implementations

### `CodexEngine`

- Binary: `codex`
- Invocation: `codex exec --skip-git-repo-check --ephemeral --output-last-message <tmpFile> -` (stdin)
- Auth check: `codex login status`
- Output: JSON file at `--output-last-message` path
- Subscription: ChatGPT Plus ou Team
- Install: `npm install -g @openai/codex`
- Login: `codex login`

### `ClaudeEngine`

- Binary: `claude`
- Invocation: `claude --print --output-format json -` (stdin)
- Auth check: `claude auth status` (exit code 0 = authenticated)
- Output: JSON on stdout
- Subscription: Claude Pro ou Team
- Install: `npm install -g @anthropic-ai/claude-code`
- Login: `claude login`

### `GeminiEngine`

- Binary: `gemini`
- Invocation: `gemini --json -` (stdin, to be verified at runtime)
- Auth check: `gemini auth status` (to be verified)
- Output: JSON on stdout
- Subscription: Google AI Premium (Gemini Advanced)
- Install: `npm install -g @anthropic-ai/gemini-cli` (to be verified)
- Login: `gemini login`

## Engine Resolution Order

At startup, the app:
1. Reads `active_engine` from `app_settings`
2. Checks if that engine is available (installed + authenticated)
3. If not, falls back to the first available engine in order: Codex → Claude → Gemini
4. If none available, sets `activeEngine` to the stored preference but marks status as unavailable

## Prompt Strategy

All engines receive the same prompt markdown. The prompt is constructed by `SkillRunnerService.buildSkillPrompt()` (unchanged). Each engine adapter is responsible only for:
- How to pass the prompt to the CLI (stdin vs argument)
- How to read the response (file vs stdout)
- How to parse the response into `SkillRunnerResult`
