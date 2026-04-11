# Contract — `SkillPromptLoader`

This document defines the API contract that the `SkillPromptLoader` module must satisfy. The contract is enforced by `tests/unit/skill-prompt-loader.test.ts`.

## Module location

`app/main/domains/execution/skill-prompt-loader.ts`

## Public types

```ts
export type SkillPromptLoader = {
  loadPrompt(skillName: string): string;
};

export class SkillPromptNotFoundError extends Error {
  readonly code: "SKILL_PROMPT_NOT_FOUND";
  readonly skillName: string;
}
```

## Public functions

```ts
export function createDefaultSkillPromptLoader(
  skillsRoot?: string  // defaults to <repo>/skills
): SkillPromptLoader;
```

## Behavior contract

### `loadPrompt(skillName)` — happy path

- **Given** `skillName === "linkedin-post-writer"` and the file `${skillsRoot}/linkedin-post-writer/SKILL.md` exists, contains a `## Prompt` section, and that section has a non-empty body,
- **Then** the function returns the trimmed content of the `## Prompt` section as a string.

### `loadPrompt(skillName)` — file does not exist

- **Given** the file `${skillsRoot}/${skillName}/SKILL.md` does not exist,
- **Then** the function throws `SkillPromptNotFoundError` with `code === "SKILL_PROMPT_NOT_FOUND"` and `skillName` set to the requested skill, and a message that names the missing file path.

### `loadPrompt(skillName)` — file exists but no `## Prompt` section

- **Given** the file exists but contains no line matching `^## Prompt\s*$`,
- **Then** the function throws `SkillPromptNotFoundError` with `code === "SKILL_PROMPT_NOT_FOUND"`, `skillName` set, and a message indicating the missing section.

### `loadPrompt(skillName)` — file exists, section exists, body is empty whitespace

- **Given** the `## Prompt` section is present but its body (between the heading and the next `## ` heading or EOF) contains only whitespace,
- **Then** the function throws `SkillPromptNotFoundError` exactly as if the section were missing — empty whitespace is treated as missing.

### `loadPrompt(skillName)` — file is read on every call

- **Given** two consecutive calls with the same `skillName`,
- **And** the file content is changed between the two calls,
- **Then** the second call returns the new content. The loader MUST NOT cache the file content across calls. This is the runtime guarantee that powers SC-001 (edit a SKILL.md and see the change on the very next invocation, no rebuild).

### `loadPrompt(skillName)` — section detection

- The loader recognises the prompt section by an exact line match `## Prompt` (case-sensitive, no leading or trailing spaces other than the trailing newline).
- The body is everything from the line after `## Prompt` up to either the next line matching `^## ` or EOF.
- Sub-headings under the prompt section (e.g., `### Examples`) are part of the prompt body and returned verbatim.

### `loadPrompt(skillName)` — security boundary

- The loader rejects any `skillName` containing path-traversal characters (`..`, `/`, `\`, null bytes). On rejection it throws a generic `Error` (not `SkillPromptNotFoundError`) so the caller distinguishes between "missing prompt" and "malformed input".

## Constructor contract

`createDefaultSkillPromptLoader(skillsRoot?)` returns a loader that resolves files relative to:

- The provided `skillsRoot` if explicitly passed.
- Otherwise `path.resolve(__dirname, "..", "..", "..", "..", "skills")` — the repo's `skills/` directory.

The constructor itself does not touch the filesystem; it only creates the loader closure.

## Test fixtures expected by `tests/unit/skill-prompt-loader.test.ts`

Cases 1 through 8 use a temporary directory created with `mkdtempSync` to control the filesystem state. They write synthetic `SKILL.md` files into that directory and instantiate the loader with `createDefaultSkillPromptLoader(tmpDir)`. Case 9 is the "real-repo sanity loop" that exercises every shipped skill against the repo's actual `skills/` directory and is the test that satisfies FR-006 from the spec.

1. Valid SKILL.md with `## Prompt` section returns trimmed body.
2. Missing file throws `SkillPromptNotFoundError`.
3. File without `## Prompt` section throws `SkillPromptNotFoundError`.
4. File with `## Prompt` section followed by only whitespace throws `SkillPromptNotFoundError`.
5. Two reads after editing the file in between return the new content.
6. Sub-headings inside the prompt section are part of the returned body.
7. Multi-section file (other `## ` headings before and after) only returns the body of `## Prompt`.
8. Path-traversal `skillName` throws a generic error, not `SkillPromptNotFoundError`.
9. **FR-006 sanity loop** — `it.each([...8 skill names])` iterates over the eight skill names enumerated in spec FR-001, instantiates the loader with `createDefaultSkillPromptLoader()` (no override, points at the real repo), calls `loadPrompt(skillName)` for each, and asserts the returned string is non-empty (length > 0). This case is the contract that ties the spec's "every registered skill has a real prompt file" requirement to a single executable assertion.

## Integration with `CodexCliRunner`

The runner constructor signature changes from:

```ts
constructor(
  executor: CodexCliCommandExecutor = defaultExecutor,
  filesystem: CodexCliFilesystem = defaultFilesystem()
)
```

to:

```ts
constructor(
  executor: CodexCliCommandExecutor = defaultExecutor,
  filesystem: CodexCliFilesystem = defaultFilesystem(),
  promptLoader: SkillPromptLoader = createDefaultSkillPromptLoader()
)
```

`buildSkillPrompt(invocation)` is removed. `buildPrompt(invocation)` calls `this.promptLoader.loadPrompt(invocation.skillName)` to obtain the per-skill prompt body and splices it into the existing envelope at the same position the inline switch result occupied (the `skillPrompt` variable in the existing code).

## Negative tests in `codex-cli-runner.test.ts`

Two new test cases:

1. Runner instantiated with a stub loader that throws `SkillPromptNotFoundError` returns a `SkillRunnerResult` with status `failed` and error code `SKILL_PROMPT_NOT_FOUND`.
2. Runner instantiated with a stub loader that returns `""` (empty string after the loader's own validation, theoretically impossible but defensive) raises the same error path.
