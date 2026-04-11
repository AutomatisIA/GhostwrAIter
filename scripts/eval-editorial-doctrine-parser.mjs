// Editorial doctrine parser — feature 006.
// Reads docs/editorial-doctrine.md (the single source of truth for banned
// openings, banned meta phrases, voice rules, and concrete-element heuristics)
// and exposes a structured EditorialDoctrine object to the grader and the
// unit tests. Lives under scripts/ rather than app/ because the doctrine is
// only consumed by the local-only eval bench, never by the Electron runtime.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class EditorialDoctrineParseError extends Error {
  constructor(message, missingSections = []) {
    super(message);
    this.name = "EditorialDoctrineParseError";
    this.code = "EDITORIAL_DOCTRINE_INVALID";
    this.missingSections = missingSections;
  }
}

const REQUIRED_TOP_SECTIONS = [
  "## Banned Openings",
  "## Banned Meta Phrases",
  "## Voice Rules",
  "## Concrete-Element Heuristics"
];

const REQUIRED_SUB_SECTIONS = [
  "### Operational Cost Keywords",
  "### Business Consequence Keywords",
  "### Arbitrage Keywords"
];

const NUMBER_UNITS = [
  "%",
  "€",
  "M€",
  "k€",
  "K€",
  "jours?",
  "heures?",
  "semaines?",
  "mois",
  "an",
  "ans",
  "FTE",
  "personnes",
  "clients",
  "projets",
  "euros?"
];

function buildNumberRegex() {
  const unitGroup = NUMBER_UNITS.join("|");
  return new RegExp(`\\b\\d+(?:[.,]\\d+)?\\s*(?:${unitGroup})?\\b`, "iu");
}

function tokenize(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length === 2 ? 2 : 3;
      current = {
        heading: `${"#".repeat(level)} ${headingMatch[2]}`,
        level,
        bullets: []
      };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const bulletMatch = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (bulletMatch) {
      current.bullets.push(bulletMatch[1]);
    }
  }

  return sections;
}

function findSection(sections, heading) {
  return sections.find((s) => s.heading === heading);
}

export function parseEditorialDoctrine(markdown) {
  const sections = tokenize(markdown);

  const missing = [];
  for (const required of REQUIRED_TOP_SECTIONS) {
    if (!findSection(sections, required)) {
      missing.push(required);
    }
  }

  const concreteIndex = sections.findIndex((s) => s.heading === "## Concrete-Element Heuristics");
  if (concreteIndex >= 0) {
    const subSectionsAfter = sections.slice(concreteIndex + 1);
    const nextTopSectionIdx = subSectionsAfter.findIndex((s) => s.level === 2);
    const inScope =
      nextTopSectionIdx === -1 ? subSectionsAfter : subSectionsAfter.slice(0, nextTopSectionIdx);
    for (const required of REQUIRED_SUB_SECTIONS) {
      if (!inScope.find((s) => s.heading === required)) {
        missing.push(required);
      }
    }
  }

  if (missing.length > 0) {
    throw new EditorialDoctrineParseError(
      `Editorial doctrine markdown is missing required sections: ${missing.join(", ")}`,
      missing
    );
  }

  return {
    bannedOpenings: findSection(sections, "## Banned Openings")?.bullets ?? [],
    bannedMetaPhrases: findSection(sections, "## Banned Meta Phrases")?.bullets ?? [],
    voiceRules: findSection(sections, "## Voice Rules")?.bullets ?? [],
    concreteHeuristics: {
      numberRegex: buildNumberRegex(),
      operationalCostKeywords:
        findSection(sections, "### Operational Cost Keywords")?.bullets ?? [],
      businessConsequenceKeywords:
        findSection(sections, "### Business Consequence Keywords")?.bullets ?? [],
      arbitrageKeywords: findSection(sections, "### Arbitrage Keywords")?.bullets ?? []
    }
  };
}

export function loadEditorialDoctrineFromFile(path) {
  const filePath = path ?? resolve(__dirname, "..", "docs", "editorial-doctrine.md");
  const raw = readFileSync(filePath, "utf-8");
  return parseEditorialDoctrine(raw);
}
