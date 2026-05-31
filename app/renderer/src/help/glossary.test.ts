import { describe, expect, it } from "vitest";
import { GLOSSARY, TERM_KEYS, getTerm, type TermKey } from "./glossary";

// Liste explicite des termes que la feature 010 (data-model §3) impose de
// couvrir. On l'enumere a la main : iterer sur Object.keys(GLOSSARY) ne pourrait
// jamais detecter un terme oublie, seule une liste attendue le peut.
const REQUIRED_TERMS: TermKey[] = [
  "pilier",
  "icp",
  "accroche",
  "structure",
  "typologie",
  "objectif",
  "socle-editorial",
  "draft",
  "variante",
  "repurpose",
  "moteur-ia",
  "oauth",
  "cadrage",
  "score-qualite"
];

describe("glossary", () => {
  it("couvre tous les termes requis par la feature 010", () => {
    for (const term of REQUIRED_TERMS) {
      expect(GLOSSARY[term], `terme manquant : ${term}`).toBeDefined();
    }
  });

  it("expose une definition non vide en langage clair pour chaque terme", () => {
    for (const term of TERM_KEYS) {
      const entry = GLOSSARY[term];
      expect(typeof entry.definition).toBe("string");
      expect(entry.definition.trim().length, `definition vide : ${term}`).toBeGreaterThan(0);
    }
  });

  it("expose un label non vide pour chaque terme", () => {
    for (const term of TERM_KEYS) {
      expect(GLOSSARY[term].label.trim().length, `label vide : ${term}`).toBeGreaterThan(0);
    }
  });

  it("ne contient aucun em-dash dans les definitions, labels et exemples", () => {
    for (const term of TERM_KEYS) {
      const entry = GLOSSARY[term];
      const example = "example" in entry ? entry.example : "";
      const text = `${entry.label} ${entry.definition} ${example}`;
      expect(text.includes("—"), `em-dash detecte dans ${term}`).toBe(false);
    }
  });

  describe("getTerm", () => {
    it("renvoie l'entree correspondant a une cle connue", () => {
      const entry = getTerm("icp");
      expect(entry).toBeDefined();
      expect(entry).toBe(GLOSSARY.icp);
      expect(entry?.definition.trim().length).toBeGreaterThan(0);
    });

    it("renvoie undefined pour une cle inconnue (lookup runtime)", () => {
      expect(getTerm("inconnu" as TermKey)).toBeUndefined();
    });
  });
});
