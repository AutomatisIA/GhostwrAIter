import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export class SkillRegistryService {
  constructor(private readonly skillsDirectories: string | string[]) {}

  listInstalledSkills(): string[] {
    const directories = Array.isArray(this.skillsDirectories)
      ? this.skillsDirectories
      : [this.skillsDirectories];

    return Array.from(
      new Set(
        directories.flatMap((skillsDirectory) => {
          if (!existsSync(skillsDirectory)) {
            return [];
          }

          return readdirSync(skillsDirectory, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .filter((entry) => existsSync(join(skillsDirectory, entry.name, "SKILL.md")))
            .map((entry) => entry.name);
        })
      )
    ).sort((left, right) => left.localeCompare(right));
  }
}
