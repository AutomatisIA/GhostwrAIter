import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { SkillRegistryService } from "../../app/main/domains/execution/skill-registry.service";

describe("skill registry service", () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    while (tempDirectories.length > 0) {
      const directory = tempDirectories.pop();
      if (directory) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it("lists installed skill slugs from the local skills directory", () => {
    const root = mkdtempSync(join(tmpdir(), "ghostwraiter-skills-"));
    const skillsDirectory = join(root, "skills");
    tempDirectories.push(root);

    mkdirSync(join(skillsDirectory, "linkedin-post-writer"), { recursive: true });
    mkdirSync(join(skillsDirectory, "linkedin-post-editor"), { recursive: true });
    writeFileSync(join(skillsDirectory, "linkedin-post-writer", "SKILL.md"), "# Writer");
    writeFileSync(join(skillsDirectory, "linkedin-post-editor", "SKILL.md"), "# Editor");

    const service = new SkillRegistryService(skillsDirectory);

    expect(service.listInstalledSkills()).toEqual([
      "linkedin-post-editor",
      "linkedin-post-writer"
    ]);
  });
});
