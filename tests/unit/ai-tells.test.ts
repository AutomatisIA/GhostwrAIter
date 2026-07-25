import { describe, expect, it } from "vitest";
import {
  ALL_TELL_FAMILIES,
  TELL_FAMILIES,
  buildTellConstraints,
  detectTells
} from "../../app/shared/ai-tells";

describe("detectTells", () => {
  it("repere le parallelisme negatif, marqueur dominant", () => {
    // Forme reellement observee dans les brouillons de la base.
    const report = detectTells(
      "Le problème n'est pas la compétence technique. Le problème, c'est l'absence de méthode."
    );
    expect(report.families).toContain("parallelisme-negatif");
  });

  it("repere le pivot, y compris avec un adverbe intercale", () => {
    // « c'est souvent là que » echappait a la premiere version du detecteur.
    expect(detectTells("C'est souvent là que tout se joue.").families).toContain("pivot");
    expect(detectTells("C'est là que ça casse.").families).toContain("pivot");
  });

  it("repere les cadratins et les emojis", () => {
    const report = detectTells("Une phrase — coupée. Et un emoji 🚀 en prime.");
    expect(report.families).toContain("typographie");
    expect(report.hits.filter((hit) => hit.family === "typographie").length).toBe(2);
  });

  it("repere l autorite vague", () => {
    expect(detectTells("Beaucoup pensent que l'IA remplace les équipes.").families).toContain(
      "autorite-vague"
    );
  });

  it("ne signale rien sur un texte direct", () => {
    const report = detectTells(
      "Un devis part sans explication. Le client compare des prix au lieu de comparer des réponses. Ajoutez une page qui relie chaque ligne à son besoin."
    );
    expect(report.hits).toEqual([]);
    expect(report.density).toBe(0);
  });

  it("restreint la detection aux familles surveillees", () => {
    const texte = "Une phrase — coupée. C'est là que ça casse.";

    expect(detectTells(texte, ["typographie"]).families).toEqual(["typographie"]);
    expect(detectTells(texte, ["pivot"]).families).toEqual(["pivot"]);
    expect(detectTells(texte, []).hits).toEqual([]);
  });

  it("pondere la densite par la gravite et la longueur", () => {
    const court = detectTells("C'est là que ça casse. " + "mot ".repeat(20));
    const long = detectTells("C'est là que ça casse. " + "mot ".repeat(200));

    // Meme faute, texte dix fois plus long : densite bien plus basse.
    expect(court.density).toBeGreaterThan(long.density);
  });

  it("rend une position exploitable pour situer l occurrence", () => {
    const report = detectTells("Début neutre. C'est là que ça casse.");
    expect(report.hits[0]?.index).toBeGreaterThan(0);
  });

  it("tolere une entree vide", () => {
    const report = detectTells("");
    expect(report.hits).toEqual([]);
    expect(report.words).toBe(0);
    expect(report.density).toBe(0);
  });
});

describe("buildTellConstraints", () => {
  it("rend une consigne par famille interdite", () => {
    const bloc = buildTellConstraints(["parallelisme-negatif", "pivot"]);
    expect(bloc).toContain("Structural constraints");
    expect(bloc.split("\n- ").length - 1).toBe(2);
  });

  it("ne cite aucune formule francaise a imiter", () => {
    // Nommer une tournure pour l'interdire revient a la donner en exemple.
    const bloc = buildTellConstraints(ALL_TELL_FAMILIES);
    expect(bloc).not.toMatch(/c'est là que|le problème n'est pas|en réalité/i);
  });

  it("rend une chaine vide quand rien n est interdit", () => {
    expect(buildTellConstraints([])).toBe("");
  });

  it("couvre les neuf familles declarees", () => {
    expect(TELL_FAMILIES.length).toBe(9);
    expect(buildTellConstraints(ALL_TELL_FAMILIES).split("\n- ").length - 1).toBe(9);
  });
});
