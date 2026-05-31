import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EditorialDoctrineParseError,
  loadEditorialDoctrineFromFile,
  parseEditorialDoctrine
} from "../../scripts/eval-editorial-doctrine-parser.mjs";

// docs/editorial-doctrine.md est un document editorial STRATEGIQUE local-only
// (gitignore : "never published") ; il est absent du checkout CI. La logique du
// parseur est entierement couverte par les fixtures inline ci-dessous ; le test
// d integration sur le vrai fichier ne s execute donc que la ou il existe.
const REAL_DOCTRINE_PATH = resolve(process.cwd(), "docs", "editorial-doctrine.md");
const hasRealDoctrine = existsSync(REAL_DOCTRINE_PATH);

const wellFormed = `# Editorial doctrine

Some prose paragraph that should be ignored by the parser.

## Banned Openings

- Dans beaucoup de PME
- En réalité
- Le vrai problème avec

## Banned Meta Phrases

- Structure retenue
- Version revue

## Voice Rules

- Phrases courtes
- Une idée centrale par post

## Concrete-Element Heuristics

The number regex is hardcoded in the parser source. The three keyword categories below are editable.

### Operational Cost Keywords

- supervision
- cadrage
- audit

### Business Consequence Keywords

- retard
- perte
- bloque

### Arbitrage Keywords

- plutôt que
- au lieu de
- versus
`;

describe("parseEditorialDoctrine — happy path", () => {
  const doctrine = parseEditorialDoctrine(wellFormed);

  it("returns the banned openings list", () => {
    expect(doctrine.bannedOpenings).toEqual([
      "Dans beaucoup de PME",
      "En réalité",
      "Le vrai problème avec"
    ]);
  });

  it("returns the banned meta phrases list", () => {
    expect(doctrine.bannedMetaPhrases).toEqual(["Structure retenue", "Version revue"]);
  });

  it("returns the voice rules list", () => {
    expect(doctrine.voiceRules).toEqual(["Phrases courtes", "Une idée centrale par post"]);
  });

  it("returns the three concrete-element keyword categories", () => {
    expect(doctrine.concreteHeuristics.operationalCostKeywords).toEqual([
      "supervision",
      "cadrage",
      "audit"
    ]);
    expect(doctrine.concreteHeuristics.businessConsequenceKeywords).toEqual([
      "retard",
      "perte",
      "bloque"
    ]);
    expect(doctrine.concreteHeuristics.arbitrageKeywords).toEqual([
      "plutôt que",
      "au lieu de",
      "versus"
    ]);
  });

  it("provides a hardcoded number regex", () => {
    expect(doctrine.concreteHeuristics.numberRegex).toBeInstanceOf(RegExp);
  });
});

describe("parseEditorialDoctrine — error paths", () => {
  it("throws when ## Banned Openings is missing", () => {
    const broken = wellFormed.replace("## Banned Openings", "## Something Else");
    try {
      parseEditorialDoctrine(broken);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(EditorialDoctrineParseError);
      expect((err as EditorialDoctrineParseError).missingSections).toContain("## Banned Openings");
    }
  });

  it("throws and lists every missing top-level section", () => {
    const broken = "# Title\n\nNo sections at all.\n";
    try {
      parseEditorialDoctrine(broken);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(EditorialDoctrineParseError);
      const missing = (err as EditorialDoctrineParseError).missingSections ?? [];
      expect(missing).toEqual(
        expect.arrayContaining([
          "## Banned Openings",
          "## Banned Meta Phrases",
          "## Voice Rules",
          "## Concrete-Element Heuristics"
        ])
      );
    }
  });

  it("throws when a required ### sub-heading under Concrete-Element Heuristics is missing", () => {
    const broken = wellFormed.replace("### Operational Cost Keywords", "### Something Else");
    try {
      parseEditorialDoctrine(broken);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(EditorialDoctrineParseError);
      expect((err as EditorialDoctrineParseError).missingSections).toContain(
        "### Operational Cost Keywords"
      );
    }
  });
});

describe("parseEditorialDoctrine — tolerant parsing", () => {
  it("returns an empty array for an empty section list (no error)", () => {
    const empty = wellFormed.replace(
      "- Dans beaucoup de PME\n- En réalité\n- Le vrai problème avec",
      ""
    );
    const doctrine = parseEditorialDoctrine(empty);
    expect(doctrine.bannedOpenings).toEqual([]);
  });

  it("recognises both - and * bullet markers", () => {
    const starBullets = wellFormed.replace("- Dans beaucoup de PME", "* Dans beaucoup de PME");
    const doctrine = parseEditorialDoctrine(starBullets);
    expect(doctrine.bannedOpenings).toContain("Dans beaucoup de PME");
  });
});

describe("parseEditorialDoctrine — number regex behavior", () => {
  const { numberRegex } = parseEditorialDoctrine(wellFormed).concreteHeuristics;

  it("matches digits with optional units", () => {
    for (const sample of ["42", "3,5%", "12 jours", "1500€", "2 FTE", "85 %", "30 mois"]) {
      const fresh = new RegExp(numberRegex.source, numberRegex.flags);
      expect(fresh.test(sample)).toBe(true);
    }
  });

  it("does not match plain text", () => {
    for (const sample of ["ABC", "no number here", "lorem ipsum"]) {
      const fresh = new RegExp(numberRegex.source, numberRegex.flags);
      expect(fresh.test(sample)).toBe(false);
    }
  });
});

describe("loadEditorialDoctrineFromFile — sanity loop", () => {
  it.skipIf(!hasRealDoctrine)("loads the real docs/editorial-doctrine.md and returns a valid structure", () => {
    const doctrine = loadEditorialDoctrineFromFile();
    expect(doctrine.bannedOpenings.length).toBeGreaterThan(0);
    expect(doctrine.bannedMetaPhrases.length).toBeGreaterThan(0);
    expect(doctrine.voiceRules.length).toBeGreaterThan(0);
    expect(doctrine.concreteHeuristics.operationalCostKeywords.length).toBeGreaterThan(0);
    expect(doctrine.concreteHeuristics.businessConsequenceKeywords.length).toBeGreaterThan(0);
    expect(doctrine.concreteHeuristics.arbitrageKeywords.length).toBeGreaterThan(0);
  });
});
