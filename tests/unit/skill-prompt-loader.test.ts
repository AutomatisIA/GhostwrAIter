import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SkillPromptNotFoundError,
  createDefaultSkillPromptLoader
} from "../../app/main/domains/execution/skill-prompt-loader";

const KNOWN_SKILLS = [
  "linkedin-strategy-foundation",
  "linkedin-topic-generator",
  "linkedin-structure-selector",
  "linkedin-hook-engine",
  "linkedin-post-writer",
  "linkedin-post-editor",
  "linkedin-repurpose",
  "linkedin-news-to-post"
] as const;

function writeSkillFile(root: string, skillName: string, content: string): string {
  const skillDir = join(root, skillName);
  mkdirSync(skillDir, { recursive: true });
  const filePath = join(skillDir, "SKILL.md");
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("SkillPromptLoader — synthetic filesystem", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ghostwraiter-loader-test-"));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns the trimmed body of the ## Prompt section", () => {
    writeSkillFile(
      tmpRoot,
      "linkedin-post-writer",
      "# linkedin-post-writer\n\n## Purpose\nDoc\n\n## Prompt\n\nWrite a sharp post.\nNo fluff.\n"
    );
    const loader = createDefaultSkillPromptLoader(tmpRoot);
    const prompt = loader.loadPrompt("linkedin-post-writer");
    expect(prompt).toBe("Write a sharp post.\nNo fluff.");
  });

  it("throws SkillPromptNotFoundError when the file is missing", () => {
    const loader = createDefaultSkillPromptLoader(tmpRoot);
    try {
      loader.loadPrompt("linkedin-post-writer");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SkillPromptNotFoundError);
      expect((err as SkillPromptNotFoundError).code).toBe("SKILL_PROMPT_NOT_FOUND");
      expect((err as SkillPromptNotFoundError).skillName).toBe("linkedin-post-writer");
    }
  });

  it("throws SkillPromptNotFoundError when the ## Prompt section is missing", () => {
    writeSkillFile(
      tmpRoot,
      "linkedin-post-writer",
      "# linkedin-post-writer\n\n## Purpose\nDoc\n\n## Inputs\n- foo\n"
    );
    const loader = createDefaultSkillPromptLoader(tmpRoot);
    expect(() => loader.loadPrompt("linkedin-post-writer")).toThrow(SkillPromptNotFoundError);
  });

  it("throws SkillPromptNotFoundError when the prompt body is empty whitespace", () => {
    writeSkillFile(
      tmpRoot,
      "linkedin-post-writer",
      "# linkedin-post-writer\n\n## Prompt\n\n   \n\n"
    );
    const loader = createDefaultSkillPromptLoader(tmpRoot);
    expect(() => loader.loadPrompt("linkedin-post-writer")).toThrow(SkillPromptNotFoundError);
  });

  it("returns the new content after the file is edited between two reads", () => {
    const filePath = writeSkillFile(
      tmpRoot,
      "linkedin-post-writer",
      "# linkedin-post-writer\n\n## Prompt\n\nFirst version.\n"
    );
    const loader = createDefaultSkillPromptLoader(tmpRoot);
    expect(loader.loadPrompt("linkedin-post-writer")).toBe("First version.");

    writeFileSync(filePath, "# linkedin-post-writer\n\n## Prompt\n\nSecond version.\n", "utf-8");
    expect(loader.loadPrompt("linkedin-post-writer")).toBe("Second version.");
  });

  it("includes sub-headings inside the prompt section in the returned body", () => {
    writeSkillFile(
      tmpRoot,
      "linkedin-post-writer",
      "# linkedin-post-writer\n\n## Prompt\n\nWrite a post.\n\n### Examples\n\n- one\n- two\n"
    );
    const loader = createDefaultSkillPromptLoader(tmpRoot);
    const prompt = loader.loadPrompt("linkedin-post-writer");
    expect(prompt).toContain("Write a post.");
    expect(prompt).toContain("### Examples");
    expect(prompt).toContain("- one");
  });

  it("returns only the prompt body when other ## sections exist before and after", () => {
    writeSkillFile(
      tmpRoot,
      "linkedin-post-writer",
      "# linkedin-post-writer\n\n## Purpose\nFoo\n\n## Prompt\n\nReal prompt body.\n\n## Outputs\n- bar\n"
    );
    const loader = createDefaultSkillPromptLoader(tmpRoot);
    expect(loader.loadPrompt("linkedin-post-writer")).toBe("Real prompt body.");
  });

  it("rejects path-traversal characters in skillName with a generic Error (not SkillPromptNotFoundError)", () => {
    const loader = createDefaultSkillPromptLoader(tmpRoot);
    for (const bad of ["../etc/passwd", "linkedin/../escape", "linkedin\\escape", "linkedin\u0000"]) {
      try {
        loader.loadPrompt(bad);
        throw new Error(`should have thrown for ${bad}`);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(SkillPromptNotFoundError);
      }
    }
  });
});

describe("SkillPromptLoader — FR-006 sanity loop against the real repo", () => {
  const loader = createDefaultSkillPromptLoader();

  it.each(KNOWN_SKILLS)("loads a non-empty prompt for %s from the repo skills directory", (skillName) => {
    const prompt = loader.loadPrompt(skillName);
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });
});
