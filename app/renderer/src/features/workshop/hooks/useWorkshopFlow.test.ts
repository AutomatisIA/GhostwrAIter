// @vitest-environment jsdom
/*
 * Deux proprietes du parcours d atelier, toutes deux invisibles a la relecture
 * du composant parce qu elles vivent dans le hook.
 *
 * 1. Une session illisible doit se DIRE. Sans branche d erreur, l atelier
 *    retombait sur son etat initial, c est-a-dire l etape 1 avec un cadrage
 *    vierge : exactement ce que voit quelqu un qui ouvre une idee neuve. Un
 *    utilisateur qui rouvre un brouillon existant refaisait donc tout le
 *    parcours et l ecrasait a la generation suivante.
 *
 * 2. Le verdict de la correction premium doit decrire la correction QUI VIENT
 *    DE TOURNER. Il etait lu dans la session precedente, donc decale d un tour :
 *    la premiere correction sans effet s annoncait « Draft corrige », et la
 *    suivante, qui changeait vraiment le texte, s annoncait « n a pas
 *    ameliore ». Le drapeau concerne 37 % des corrections reelles (cf. le
 *    commentaire de `WorkshopSession.correctionApplied`), ce n est pas un cas
 *    limite.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkshopSession } from "@shared/types/workshop";
import { useWorkshopFlow } from "./useWorkshopFlow";

function session(overrides: Partial<WorkshopSession> = {}): WorkshopSession {
  return {
    idea: {
      id: "i1",
      title: "Un sujet",
      angle: "Un angle",
      pillarLabel: "Pédagogie",
      createdAt: "2026-07-25T09:00:00.000Z",
      targetIcpSegment: null
    },
    draft: { id: "d1", headline: "Un titre", bodyMarkdown: "Un corps.", qualityScore: 0 },
    hooks: [],
    run: { id: "r1", skillName: "linkedin-draft", status: "succeeded", summary: "" },
    versions: [],
    contextUsed: { pillarLabel: "Pédagogie", voiceGuardrail: "Voix directe", activeSkills: [] },
    ...overrides
  };
}

function installApi(workshop: Record<string, unknown>) {
  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = { workshop };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWorkshopFlow, lecture de session", () => {
  it("annonce l echec de lecture au lieu de rendre un cadrage vierge", async () => {
    installApi({
      getSessionByIdeaId: vi.fn().mockRejectedValue(new Error("database is locked"))
    });

    const { result } = renderHook(() => useWorkshopFlow("i1"));

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error?.message).toContain("database is locked");
    // L etape ne bouge pas : on ne fait pas croire que le brouillon a ete lu.
    expect(result.current.step).toBe(1);
  });

  it("ne signale rien quand l idee n a simplement pas encore de session", async () => {
    // `null` est une reponse valide, pas une panne : une idee du backlog qui n a
    // jamais ete passee a l atelier. La confondre avec un echec afficherait un
    // bandeau rouge sur le parcours nominal.
    //
    // La lecture est denouee A LA MAIN, et non attendue par `waitFor` sur
    // « le mock a ete appele ». Cette derniere forme se resout des l appel,
    // c est-a-dire AVANT que la chaine `.then`/`.catch` n ait pu poser quoi que
    // ce soit : la version precedente de ce test restait verte alors meme qu on
    // faisait poser une erreur sur ce chemin. Elle affirmait sur un etat pas
    // encore atteint. Ici la promesse est resolue dans `act`, dont la sortie
    // vide la file de microtaches et rejoue les effets : ce qui est lu ensuite
    // est l etat final.
    let resoudre!: (valeur: null) => void;
    const lecture = new Promise<null>((r) => {
      resoudre = r;
    });
    installApi({ getSessionByIdeaId: vi.fn().mockReturnValue(lecture) });

    const { result } = renderHook(() => useWorkshopFlow("i1"));

    await act(async () => {
      resoudre(null);
      await lecture;
    });

    expect(result.current.error).toBeNull();
    expect(result.current.step).toBe(1);
  });
});

describe("useWorkshopFlow, verdict de la correction premium", () => {
  async function corriger(precedente: boolean | undefined, rendue: boolean | undefined) {
    installApi({
      getSessionByIdeaId: vi.fn().mockResolvedValue(
        session({ correctionApplied: precedente })
      ),
      correctDraft: vi.fn().mockResolvedValue(
        session({
          correctionApplied: rendue,
          draft: { id: "d1", headline: "Un titre", bodyMarkdown: "Corps corrigé.", qualityScore: 0 }
        })
      )
    });

    const { result } = renderHook(() => useWorkshopFlow("i1"));
    await waitFor(() => expect(result.current.session).not.toBeNull());
    await act(async () => {
      await result.current.correct();
    });
    return result.current.status;
  }

  it("dit que rien n a change quand la correction rendue n a rien change", async () => {
    // La session PRECEDENTE ne porte pas le drapeau : lue a sa place, elle
    // ferait annoncer un succes sur un texte inchange.
    expect(await corriger(undefined, false)).toBe(
      "La correction n'a pas amélioré le brouillon. Texte d'origine conservé."
    );
  });

  it("dit que le brouillon est corrige quand la correction rendue a change le texte", async () => {
    // Cas symetrique : la session precedente porte `false`, la nouvelle `true`.
    // C est celui qui faisait annoncer un echec sur une correction reussie.
    expect(await corriger(false, true)).toBe("Draft corrigé.");
  });
});
