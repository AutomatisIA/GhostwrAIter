import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOWS_DIR = join(__dirname, "..", "..", ".github", "workflows");

// Assertions de securite uniquement. La structure YAML (ordre des etapes,
// libelles, matrices) n'a aucune valeur de regression : elle suit l'evolution
// naturelle des workflows sans jamais rien detecter. Toutes les assertions ci-
// dessous portent sur le texte brut, pas sur un YAML parse.
function readWorkflow(name: string): string {
  return readFileSync(join(WORKFLOWS_DIR, name), "utf-8");
}

describe("ci.yml", () => {
  const raw = readWorkflow("ci.yml");

  it("never uses continue-on-error", () => {
    expect(raw).not.toMatch(/continue-on-error/);
  });

  it("never references any secret", () => {
    expect(raw).not.toMatch(/secrets\./);
  });
});

describe("package.yml", () => {
  const raw = readWorkflow("package.yml");

  it("never uses continue-on-error", () => {
    expect(raw).not.toMatch(/continue-on-error/);
  });

  it("references only the expected mac code-signing secrets", () => {
    // Le build macOS est signe (Developer ID) + notarise : les secrets de
    // signature sont attendus. On verrouille l'ensemble exact pour forcer une
    // revue si la liste change.
    const used = [...new Set([...raw.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]))].sort();
    expect(used).toEqual([
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_ID",
      "APPLE_TEAM_ID",
      "MAC_CSC_KEY_PASSWORD",
      "MAC_CSC_LINK"
    ]);
  });

  it("never interpolates a secret inside a run: command (anti-injection)", () => {
    // Les secrets ne doivent apparaitre que dans des blocs env:, jamais
    // splices dans une commande shell run:.
    for (const line of raw.split(/\r?\n/)) {
      if (/^\s*run:/.test(line)) {
        expect(line).not.toMatch(/secrets\./);
      }
    }
  });
});

describe("release.yml", () => {
  const raw = readWorkflow("release.yml");

  it("only references the GITHUB_TOKEN secret (no other secrets)", () => {
    const secretRefs = raw.match(/secrets\.[A-Z_]+/g) ?? [];
    const unique = Array.from(new Set(secretRefs));
    expect(unique).toEqual(["secrets.GITHUB_TOKEN"]);
  });

  it("never uses continue-on-error", () => {
    expect(raw).not.toMatch(/continue-on-error/);
  });
});
