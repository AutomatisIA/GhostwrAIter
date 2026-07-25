import { describe, expect, it } from "vitest";
import type { LibraryEntry } from "@shared/types/library";
import {
  MAX_ROWS_PER_GROUP,
  TRIAGE_BUCKETS,
  compareByAchievement,
  countByTriage,
  flattenGroups,
  formatHiddenCount,
  formatLastModified,
  formatNeverReviewed,
  formatRelativeDay,
  formatShownCount,
  formatVariantCount,
  formatVersionHistory,
  groupBySubject,
  isNeverReviewed
} from "./triage";

/**
 * Regles de triage, mesurees hors de React.
 *
 * Le sujet de ce fichier est ce qui a echoue trois fois : « jamais relu » n a
 * jamais atteint l ecran parce que le signal etait cherche dans `drafts` alors
 * qu il vit dans `draft_versions`. Il arrive maintenant par `versionCount`, et
 * la regle se verifie ici sans rendre une seule ligne de DOM.
 */

const NOW = new Date("2026-07-25T10:00:00");

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    draftId: "draft_1",
    ideaId: "idea_1",
    headline: "Un brouillon",
    bodyPreview: "Apercu",
    bodyMarkdown: "Corps",
    qualityScore: 0.8,
    createdAt: "2026-07-20T09:00:00",
    status: "draft",
    pillarLabel: "Adoption IA",
    tags: [],
    sourceDraftId: null,
    ideaTitle: "Devis et valeur perçue",
    versionCount: 3,
    lastVersionAt: "2026-07-24T09:00:00",
    triage: "pret",
    ...overrides
  };
}

describe("countByTriage", () => {
  it("compte chaque entree de triage a partir du champ derive", () => {
    const counts = countByTriage([
      entry({ draftId: "a", triage: "a-relire" }),
      entry({ draftId: "b", triage: "a-relire" }),
      entry({ draftId: "c", triage: "pret" }),
      entry({ draftId: "d", triage: "planifie" })
    ]);

    expect(counts).toEqual({ "a-relire": 2, pret: 1, planifie: 1 });
  });

  it("rend trois compteurs a zero sur une bibliotheque vide", () => {
    expect(countByTriage([])).toEqual({ "a-relire": 0, pret: 0, planifie: 0 });
  });

  it("couvre exactement les trois entrees declarees", () => {
    expect(TRIAGE_BUCKETS.map((bucket) => bucket.id)).toEqual(["a-relire", "pret", "planifie"]);
  });
});

describe("compareByAchievement", () => {
  it("place le plus abouti en tete : une date posee devance une reprise", () => {
    const planifie = entry({ draftId: "p", triage: "planifie", versionCount: 2 });
    const pret = entry({ draftId: "r", triage: "pret", versionCount: 9 });

    expect([pret, planifie].sort(compareByAchievement)[0]).toBe(planifie);
  });

  it("departage deux brouillons de meme etat par le nombre de versions", () => {
    const repris = entry({ draftId: "a", versionCount: 4 });
    const brut = entry({ draftId: "b", versionCount: 1 });

    expect([brut, repris].sort(compareByAchievement)[0]).toBe(repris);
  });

  it("departe les egalites completes par l identifiant, pour que l ordre ne bouge pas", () => {
    const a = entry({ draftId: "aaa" });
    const b = entry({ draftId: "bbb" });

    expect([b, a].sort(compareByAchievement).map((item) => item.draftId)).toEqual(["aaa", "bbb"]);
  });
});

describe("groupBySubject", () => {
  it("regroupe par titre d idee et met le sujet le plus prolifique en tete", () => {
    const groups = groupBySubject([
      entry({ draftId: "1", ideaTitle: "Agents IA" }),
      entry({ draftId: "2", ideaTitle: "Devis" }),
      entry({ draftId: "3", ideaTitle: "Devis" }),
      entry({ draftId: "4", ideaTitle: "Devis" })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.title).toBe("Devis");
    expect(groups[0]!.entries).toHaveLength(3);
    expect(groups[1]!.title).toBe("Agents IA");
  });

  it("ouvre chaque groupe sur son brouillon le plus abouti", () => {
    const groups = groupBySubject([
      entry({ draftId: "brut", triage: "a-relire", versionCount: 1 }),
      entry({ draftId: "planifie", triage: "planifie", versionCount: 2 }),
      entry({ draftId: "repris", triage: "pret", versionCount: 5 })
    ]);

    expect(groups[0]!.entries.map((item) => item.draftId)).toEqual(["planifie", "repris", "brut"]);
  });

  it("retombe sur l identifiant d idee quand le titre est vide", () => {
    const groups = groupBySubject([entry({ ideaTitle: "  ", ideaId: "idea_7" })]);

    expect(groups[0]!.key).toBe("idea_7");
    expect(groups[0]!.title).toBe("Sujet sans titre");
  });

  /*
   * Cas reel et non theorique : deux idees portent un titre vide en base, et la
   * couche de donnees expose la chaine vide telle quelle plutot que de fabriquer
   * un libelle. Une cle posee sur le seul titre les aurait fondues en un sujet
   * unique, et le regroupement aurait affirme une parente qui n existe pas. La
   * cle retombe donc sur l identifiant, qui, lui, distingue.
   */
  it("ne fond pas deux idees distinctes sous un meme titre vide", () => {
    const groups = groupBySubject([
      entry({ draftId: "a", ideaTitle: "", ideaId: "idea_1" }),
      entry({ draftId: "b", ideaTitle: "", ideaId: "idea_2" })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.key)).toEqual(["idea_1", "idea_2"]);
    // Aucune mention de variantes : ce ne sont pas des variantes l une de
    // l autre, et l ecran ne doit pas le laisser croire.
    expect(formatVariantCount(groups[0]!.entries.length)).toBeNull();
  });

  it("aplatit les groupes dans l ordre d affichage", () => {
    const groups = groupBySubject([
      entry({ draftId: "seul", ideaTitle: "Outils" }),
      entry({ draftId: "a", ideaTitle: "Devis", versionCount: 5 }),
      entry({ draftId: "b", ideaTitle: "Devis", versionCount: 2 })
    ]);

    expect(flattenGroups(groups).map((item) => item.draftId)).toEqual(["a", "b", "seul"]);
  });
});

describe("isNeverReviewed", () => {
  it("repere le brouillon qui n a que sa version de generation", () => {
    expect(isNeverReviewed(entry({ versionCount: 1 }))).toBe(true);
  });

  /*
   * Verifie contre l ECRITURE et non contre l intention : la requete de
   * `library.service.ts` compte les lignes de `draft_versions` avec un
   * `COALESCE(..., 0)`. Un brouillon sans aucune version rend ZERO, et c est le
   * moins relu de tous. Une egalite stricte a un l aurait tu sur celui-la.
   */
  it("repere aussi le brouillon qui n a aucune version enregistree", () => {
    expect(isNeverReviewed(entry({ versionCount: 0 }))).toBe(true);
    expect(formatNeverReviewed(entry({ versionCount: 0 }))).toBe("Aucune version, jamais relu");
    expect(formatNeverReviewed(entry({ versionCount: 1 }))).toBe("1 version, jamais relu");
  });

  it("laisse tranquille un brouillon deja repris", () => {
    expect(isNeverReviewed(entry({ versionCount: 3 }))).toBe(false);
  });

  /*
   * Le champ manquant ne vaut PAS « jamais relu ». Le jour ou il cesserait
   * d arriver, une valeur de repli poserait le marqueur sur la totalite de la
   * bibliotheque, ce qui est exactement le mensonge que ce chantier corrige.
   */
  it("ne conclut rien quand le compte de versions n arrive pas", () => {
    const sansCompte = { ...entry(), versionCount: undefined } as unknown as LibraryEntry;
    expect(isNeverReviewed(sansCompte)).toBe(false);
  });
});

describe("libelles de groupe", () => {
  it("ne signale les variantes qu au pluriel", () => {
    expect(formatVariantCount(1)).toBeNull();
    expect(formatVariantCount(5)).toBe("5 variantes du même sujet");
  });

  it("accorde la ligne de repli", () => {
    expect(formatHiddenCount(1)).toBe("Une variante de plus, repliée");
    expect(formatHiddenCount(2)).toBe("Deux variantes de plus, repliées");
    expect(formatShownCount(1)).toBe("Une variante de plus, affichée");
    expect(formatShownCount(4)).toBe("Quatre variantes de plus, affichées");
  });

  it("montre trois variantes avant de replier", () => {
    expect(MAX_ROWS_PER_GROUP).toBe(3);
  });
});

describe("dates relatives", () => {
  it("dit aujourd'hui, hier, puis compte les jours", () => {
    expect(formatRelativeDay("2026-07-25T08:00:00", NOW)).toBe("aujourd'hui");
    expect(formatRelativeDay("2026-07-24T23:30:00", NOW)).toBe("hier");
    expect(formatRelativeDay("2026-07-21T09:00:00", NOW)).toBe("il y a 4 j");
  });

  /* Passe une semaine, « il y a 23 j » ne se reconvertit pas de tete. */
  it("bascule sur la date absolue au-dela d une semaine", () => {
    expect(formatRelativeDay("2026-07-02T09:00:00", NOW)).toBe(
      `le ${new Date("2026-07-02T09:00:00").toLocaleDateString("fr-FR")}`
    );
  });

  it("compte en jours de calendrier et non en tranches de vingt-quatre heures", () => {
    // Vingt heures d ecart, mais la veille : c est « hier », pas
    // « aujourd'hui ».
    expect(formatRelativeDay("2026-07-24T14:00:00", NOW)).toBe("hier");
  });

  it("ne rend rien d une date illisible", () => {
    expect(formatRelativeDay("", NOW)).toBeNull();
    expect(formatRelativeDay(undefined, NOW)).toBeNull();
  });
});

describe("historique des versions", () => {
  it("tient en une ligne : combien, et la derniere quand", () => {
    expect(formatVersionHistory(entry({ versionCount: 3, lastVersionAt: "2026-07-24" }), NOW)).toBe(
      "3 versions, la dernière hier"
    );
  });

  it("se tait quand il n y a pas d historique a raconter", () => {
    expect(formatVersionHistory(entry({ versionCount: 1 }), NOW)).toBeNull();
  });

  it("rend le compte seul quand la date de derniere version est illisible", () => {
    expect(formatVersionHistory(entry({ versionCount: 2, lastVersionAt: "" }), NOW)).toBe(
      "2 versions"
    );
  });

  it("prefixe la date de liste par le verbe", () => {
    expect(formatLastModified(entry({ lastVersionAt: "2026-07-24" }), NOW)).toBe("modifié hier");
  });
});
