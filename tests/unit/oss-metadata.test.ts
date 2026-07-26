import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

// Verifie uniquement la presence des fichiers de metadonnees open source.
// Le contenu texte (LICENSE, README, CONTRIBUTING...) evolue independamment
// de ce test et n'a aucune valeur de regression a etre fige ici.
const REQUIRED_FILES = [
  ".gitattributes",
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/dependabot.yml"
];

describe("OSS metadata files", () => {
  it.each(REQUIRED_FILES)("%s exists at repo root", (relativePath) => {
    expect(existsSync(join(REPO_ROOT, relativePath))).toBe(true);
  });
});
