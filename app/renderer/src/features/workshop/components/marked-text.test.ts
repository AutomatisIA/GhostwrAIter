import { describe, expect, it } from "vitest";
import { detectTells } from "../../../../../shared/ai-tells";
import { buildMarkedParagraphs, describeFamilies } from "./marked-text";

describe("buildMarkedParagraphs", () => {
  it("rend un paragraphe par ligne non vide", () => {
    const paragraphs = buildMarkedParagraphs("Premier.\n\nSecond.\n", []);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.segments.map((s) => s.text).join("")).toBe("Premier.");
    expect(paragraphs[1]?.segments.map((s) => s.text).join("")).toBe("Second.");
  });

  it("restitue le texte d origine, apostrophes courbes comprises", () => {
    const body = "L’outil n’est pas un gadget, c’est une methode.";
    const { hits } = detectTells(body);
    const rendered = buildMarkedParagraphs(body, hits)
      .flatMap((paragraph) => paragraph.segments)
      .map((segment) => segment.text)
      .join("");
    expect(rendered).toBe(body);
  });

  it("marque une portion du texte reel, pas du texte normalise", () => {
    const body = "Voici le contexte.\nL’outil sert a ceci, n’est pas un gadget, c’est une methode.";
    const { hits } = detectTells(body);
    const negatif = hits.find((hit) => hit.family === "parallelisme-negatif");
    expect(negatif).toBeDefined();

    const paragraphs = buildMarkedParagraphs(body, [negatif!]);
    const marked = paragraphs
      .flatMap((paragraph) => paragraph.segments)
      .filter((segment) => segment.families.length > 0);

    // Aucun caractere perdu ni ajoute : chaque paragraphe restitue sa ligne.
    expect(paragraphs.map((p) => p.segments.map((s) => s.text).join(""))).toEqual(
      body.split("\n")
    );
    expect(marked).toHaveLength(1);
    // Apostrophes courbes conservees : la position vient du texte normalise,
    // le rendu vient du texte d origine.
    expect(marked[0]!.text).toBe("n’est pas un gadget, c’est une methode");
  });

  it("survit a un texte en CRLF sans decaler le soulignement", () => {
    const body = "Voici le contexte.\r\nL’outil sert a ceci, n’est pas un gadget, c’est une methode.";
    const { hits } = detectTells(body);
    const negatif = hits.find((hit) => hit.family === "parallelisme-negatif");
    expect(negatif).toBeDefined();

    const paragraphs = buildMarkedParagraphs(body, [negatif!]);
    const marked = paragraphs
      .flatMap((paragraph) => paragraph.segments)
      .filter((segment) => segment.families.length > 0);

    expect(paragraphs[0]?.segments.every((segment) => segment.families.length === 0)).toBe(true);
    expect(marked).toHaveLength(1);
    expect(marked[0]!.text).toBe("n’est pas un gadget, c’est une methode");
  });

  it("fusionne les recouvrements plutot que d imbriquer les segments", () => {
    const body = "Alpha beta gamma delta.";
    const hits = [
      { family: "vocabulaire" as const, excerpt: "beta gamma", index: 6 },
      { family: "pivot" as const, excerpt: "gamma delta", index: 11 }
    ];
    const segments = buildMarkedParagraphs(body, hits).flatMap((p) => p.segments);
    const marked = segments.filter((segment) => segment.families.length > 0);

    expect(marked).toHaveLength(1);
    expect(marked[0]!.text).toBe("beta gamma delta");
    expect(marked[0]!.families).toEqual(["vocabulaire", "pivot"]);
    expect(segments.map((s) => s.text).join("")).toBe(body);
  });

  it("ignore une position hors du texte au lieu de casser le rendu", () => {
    const body = "Texte court.";
    const segments = buildMarkedParagraphs(body, [
      { family: "meta", excerpt: "absent", index: 999 }
    ]).flatMap((paragraph) => paragraph.segments);

    expect(segments.map((s) => s.text).join("")).toBe(body);
    expect(segments.every((segment) => segment.families.length === 0)).toBe(true);
  });
});

describe("describeFamilies", () => {
  it("rend les libelles lisibles des familles", () => {
    expect(describeFamilies(["vocabulaire"])).toBe("Vocabulaire gonflé");
    expect(describeFamilies(["pivot", "meta"])).toBe("Pivot dramatique, Commentaire méta");
  });
});
