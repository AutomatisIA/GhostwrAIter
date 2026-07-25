import { describe, expect, it } from "vitest";
import { tokenizeTags } from "../../app/main/domains/workshop/tokenize-tags";

describe("tokenizeTags", () => {
  it("retient les mots porteurs de sens", () => {
    const tags = tokenizeTags("Automatisation des workflows commerciaux en entreprise");
    expect(tags).toContain("automatisation");
    expect(tags).toContain("workflows");
    expect(tags).toContain("entreprise");
  });

  it("rejette les parasites reellement observes en base", () => {
    // Ces tags existent dans la base de l utilisateur et n apprennent rien.
    const bruit = "donner aujourd envisagent laisse desormais faire generer creer exemple";
    expect(tokenizeTags(bruit)).toEqual([]);
  });

  it("rejette les mots de moins de six lettres", () => {
    // La tranche de cinq lettres est dominee par des formes verbales.
    expect(tokenizeTags("usage cadre offre")).toEqual([]);
  });

  it("rejette les nombres", () => {
    expect(tokenizeTags("202600 123456")).toEqual([]);
  });

  it("conserve les accents", () => {
    expect(tokenizeTags("prospection téléphonique")).toContain("téléphonique");
  });

  it("dedoublonne et borne a six tags", () => {
    const tags = tokenizeTags(
      "adoption adoption gouvernance priorisation deploiement formation integration supervision"
    );
    expect(tags.length).toBe(6);
    expect(new Set(tags).size).toBe(6);
  });

  it("tolere une entree vide", () => {
    expect(tokenizeTags("")).toEqual([]);
  });
});
