import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type SkillPromptLoader = {
  loadPrompt(skillName: string): string;
};

// Walk parent directories from `startDir` until a `package.json` is found.
// Returns the repo root regardless of whether the caller is the source layout
// (`app/main/domains/execution/`) or the compiled CJS bundle
// (`dist-electron/main/`).
function findRepoRoot(startDir: string): string {
  let current = startDir;
  for (let depth = 0; depth < 12; depth++) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Could not locate repo root from ${startDir} (no package.json in any ancestor)`);
}

export class SkillPromptNotFoundError extends Error {
  readonly code = "SKILL_PROMPT_NOT_FOUND" as const;
  readonly skillName: string;

  constructor(skillName: string, message: string) {
    super(message);
    this.name = "SkillPromptNotFoundError";
    this.skillName = skillName;
  }
}

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const PROMPT_HEADING = /^## Prompt\s*$/;
const NEXT_HEADING = /^## /;

function extractPromptBody(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let inPromptSection = false;
  const collected: string[] = [];

  for (const line of lines) {
    if (PROMPT_HEADING.test(line)) {
      inPromptSection = true;
      continue;
    }
    if (inPromptSection) {
      if (NEXT_HEADING.test(line)) {
        break;
      }
      collected.push(line);
    }
  }

  if (!inPromptSection) return null;

  const body = collected.join("\n").trim();
  return body.length > 0 ? body : null;
}

export function createDefaultSkillPromptLoader(skillsRoot?: string): SkillPromptLoader {
  const baseDir = skillsRoot ?? join(findRepoRoot(__dirname), "skills");

  return {
    loadPrompt(skillName: string): string {
      if (!SKILL_NAME_PATTERN.test(skillName)) {
        throw new Error(
          `Invalid skill name "${skillName}": skill names must match ${SKILL_NAME_PATTERN}`
        );
      }

      const filePath = join(baseDir, skillName, "SKILL.md");

      let raw: string;
      try {
        raw = readFileSync(filePath, "utf-8");
      } catch {
        throw new SkillPromptNotFoundError(
          skillName,
          `Skill prompt file not found at ${filePath}. Create skills/${skillName}/SKILL.md with a "## Prompt" section.`
        );
      }

      const body = extractPromptBody(raw);
      if (body === null) {
        throw new SkillPromptNotFoundError(
          skillName,
          `Skill prompt section missing or empty in ${filePath}. Add a "## Prompt" heading followed by the prompt body.`
        );
      }

      return body;
    }
  };
}
