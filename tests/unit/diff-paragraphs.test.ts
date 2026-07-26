import { describe, expect, it } from "vitest";
import { countChanged, diffParagraphs } from "../../app/shared/diff-paragraphs";

describe("diffParagraphs", () => {
  it("repere un paragraphe reecrit", () => {
    // Cas reel : la correction premium reformule une phrase sur place.
    const changes = diffParagraphs(
      "Intro.\n\nLa conséquence est immédiate : les tests s'accumulent.",
      "Intro.\n\nLes tests s'accumulent alors sans usage métier défini."
    );

    expect(changes[0]).toEqual({ kind: "unchanged", text: "Intro." });
    expect(changes[1]!.kind).toBe("modified");
    expect(countChanged(changes)).toBe(1);
  });

  it("repere un ajout et une suppression", () => {
    expect(diffParagraphs("A", "A\n\nB")[1]).toEqual({ kind: "added", text: "B" });
    expect(diffParagraphs("A\n\nB", "A")[1]).toEqual({ kind: "removed", text: "B" });
  });

  it("ne signale rien sur deux textes identiques", () => {
    const changes = diffParagraphs("A\n\nB", "A\n\nB");
    expect(countChanged(changes)).toBe(0);
  });

  it("ignore les differences d espacement autour des paragraphes", () => {
    // Le texte affiche peut porter des espaces de fin sans que rien n ait change.
    expect(countChanged(diffParagraphs("A\n\nB", "  A  \n\n\n  B  "))).toBe(0);
  });

  it("tolere une entree vide", () => {
    expect(diffParagraphs("", "")).toEqual([]);
    expect(diffParagraphs("", "A")).toEqual([{ kind: "added", text: "A" }]);
  });
});
