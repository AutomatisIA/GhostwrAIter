// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdeaSelector } from "../../app/renderer/src/features/create/components/IdeaSelector";
import { ToastProvider } from "../../app/renderer/src/feedback/ToastProvider";

/*
 * Ecran « Creer », correctifs v2.
 *
 * `IdeaSelector` est rendu directement plutot que `CreateScreen` : l ecran de
 * selection est exactement ce composant, et le passer en direct evite d avoir a
 * monter un routeur pour observer une mise en page.
 */

const IDEAS = [
  {
    id: "idea_1",
    title: "Les agents IA ne sont pas prets a devenir un outil de l entreprise",
    angle: "Retour de terrain",
    pillarLabel: "Adoption et changement",
    createdAt: "2026-07-20T12:00:00.000Z",
    targetIcpSegment: "Dirigeant de PME, 20 à 100 salariés"
  },
  {
    id: "idea_2",
    title: "   ",
    angle: "",
    pillarLabel: "Veille",
    createdAt: "2026-07-22T12:00:00.000Z",
    targetIcpSegment: null
  },
  {
    id: "idea_3",
    title: "",
    angle: "",
    pillarLabel: "",
    createdAt: "2026-07-23T12:00:00.000Z",
    targetIcpSegment: null
  }
];

const CIBLES = ["Dirigeant de PME, 20 à 100 salariés", "Responsable des opérations"];

const BUNDLE = {
  profile: { name: "Philippe", positioning: "Conseil IA", bio: "", expertiseSummary: "" },
  offers: [],
  icps: CIBLES.map((segment) => ({ segment, pains: "Manque de temps" })),
  pillars: [
    { label: "Cas d'usage concrets metier", position: 0 },
    { label: "Adoption et changement", position: 1 }
  ],
  voiceRules: []
};

// Meme socle, sans aucune cible : c est l etat d une strategie dont l onglet
// Cibles n a jamais ete rempli.
const BUNDLE_SANS_CIBLE = { ...BUNDLE, icps: [] };

function mockPreload(ideas: unknown[] = IDEAS, bundle: unknown = BUNDLE) {
  const api = {
    platform: "darwin",
    appName: "GhostwrAIter",
    ideas: {
      listIdeas: vi.fn().mockResolvedValue(ideas),
      createIdea: vi.fn().mockResolvedValue(IDEAS[0]),
      // Le double rend la FORME reelle du contrat : `handleNewsSubmit` lit
      // `result.idea.id`. Un `vi.fn()` nu renvoie `undefined` et fait passer le
      // test par sa branche d erreur, ou l assertion sur l appel resterait vraie
      // pour la mauvaise raison.
      createFromNewsSource: vi.fn().mockResolvedValue({ idea: IDEAS[0] }),
      generateFromStrategy: vi.fn().mockResolvedValue([])
    },
    strategy: {
      getActiveBundle: vi.fn().mockResolvedValue(bundle),
      saveBundle: vi.fn(),
      generateFoundation: vi.fn()
    }
  };
  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = api;
  return api;
}

/**
 * Menu de la cible visee.
 *
 * Une liste deroulante et non des etiquettes : les segments reels sont des
 * phrases de 60 a 95 caracteres qui se ressemblent par leur debut, donc en
 * etiquettes elles passaient a deux lignes et les tronquer les rendait
 * indiscernables.
 */
function menuDeCible(): HTMLSelectElement {
  return screen.getByLabelText("Cible visée") as HTMLSelectElement;
}

function optionsDeCible(): string[] {
  return [...menuDeCible().options].map((option) => option.textContent ?? "");
}

function renderSelector() {
  const onSelect = vi.fn();
  const view = render(
    <ToastProvider>
      <IdeaSelector onSelect={onSelect} />
    </ToastProvider>
  );
  return { ...view, onSelect };
}

describe("Ecran Creer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("n affiche aucune phrase d aide dans le flux et donne un bouton d aide a chaque champ", async () => {
    mockPreload();
    const { container } = renderSelector();

    await screen.findByRole("button", { name: "Aide : Titre du sujet" });
    expect(screen.getByRole("button", { name: "Aide : Angle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aide : Pilier" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aide : Cible visée" })).toBeTruthy();

    // Motif unique : plus aucune phrase d aide posee dans le flux sous un champ.
    expect(container.querySelectorAll(".create-hint")).toHaveLength(0);
    expect(screen.queryByText(/tel que vous le présenteriez à voix haute/)).toBeNull();
  });

  it("revele l aide du champ seulement quand elle est demandee", async () => {
    const user = userEvent.setup();
    mockPreload();
    renderSelector();

    const trigger = await screen.findByRole("button", { name: "Aide : Titre du sujet" });
    await user.hover(trigger);

    const bubble = await screen.findByRole("tooltip");
    expect(bubble.textContent).toContain("tel que vous le présenteriez à voix haute");

    await user.unhover(trigger);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("applique le meme motif d aide au mode Transformer une veille", async () => {
    const user = userEvent.setup();
    mockPreload();
    const { container } = renderSelector();

    await screen.findByRole("button", { name: "Aide : Titre du sujet" });
    await user.click(screen.getByRole("tab", { name: "Transformer une veille" }));

    expect(await screen.findByRole("button", { name: "Aide : Titre source" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aide : Résumé source" })).toBeTruthy();
    expect(container.querySelectorAll(".create-hint")).toHaveLength(0);
  });

  it("replie une idee sans titre sur une etiquette explicite et une provenance datee", async () => {
    mockPreload();
    const { container } = renderSelector();

    const untitled = await screen.findAllByText("Idée sans titre");
    expect(untitled).toHaveLength(2);

    // Le repli n usurpe pas la graisse d un vrai titre.
    for (const node of untitled) {
      expect(node.className).toContain("create-backlog__title--untitled");
    }

    // Provenance datee : d ou vient la ligne, quand elle est arrivee, et ce
    // qu il reste a faire. La date est formatee dans le fuseau local, donc
    // seule sa forme est verifiee.
    const provenances = Array.from(
      container.querySelectorAll(".create-backlog__pillar")
    ).map((node) => node.textContent ?? "");

    expect(provenances.some((text) => /^Veille du \d{1,2} \S+, à nommer$/.test(text))).toBe(
      true
    );
    expect(provenances.some((text) => /^Idée du \d{1,2} \S+, à nommer$/.test(text))).toBe(true);

    // Une idee titree garde son pilier seul, sans mention de provenance.
    expect(provenances).toContain("Adoption et changement");
  });

  it("laisse « Ajouter au backlog » actionnable des que les trois champs sont remplis", async () => {
    const user = userEvent.setup();
    mockPreload();
    renderSelector();

    const backlogButton = await screen.findByRole("button", { name: "Ajouter au backlog" });
    expect(backlogButton).toHaveProperty("disabled", true);

    await user.type(screen.getByLabelText("Titre du sujet"), "Deleguer trop tot");
    await user.type(screen.getByLabelText("Angle"), "Retour chiffre");
    await user.click(screen.getByRole("button", { name: "Adoption et changement" }));

    await waitFor(() => expect(backlogButton).toHaveProperty("disabled", false));
  });

  /*
   * Rangee « Cible visee ».
   *
   * La doctrine editoriale exige une cible unique par post. Sans ce champ,
   * l application envoyait toutes les cibles de la strategie au modele.
   *
   * Ces tests ne pretendent rien mesurer de visuel : jsdom n evalue pas
   * `:focus-within` et vitest n applique aucune feuille de style. Ce qui est
   * verifie ici est la selection unique et la charge utile envoyee a
   * `createIdea`, deux choses qui ne dependent d aucun rendu.
   */
  it("pose une option par cible de la strategie et presente la premiere", async () => {
    mockPreload();
    renderSelector();

    await screen.findByLabelText("Cible visée");

    expect(optionsDeCible()).toEqual(CIBLES);
    expect(menuDeCible().value).toBe(CIBLES[0]);
    expect(screen.getByText("Une seule, jamais toutes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aide : Cible visée" })).toBeTruthy();
  });

  it("deplace la selection sur la cible choisie, une seule a la fois", async () => {
    const user = userEvent.setup();
    mockPreload();
    renderSelector();

    await screen.findByLabelText("Cible visée");
    await user.selectOptions(menuDeCible(), CIBLES[1] as string);

    await waitFor(() => expect(menuDeCible().value).toBe(CIBLES[1]));
    // Un menu ne peut pas porter deux valeurs, mais l assertion ci-dessus le
    // dirait aussi d une rangee de cases a cocher : on mesure donc qu une seule
    // option est retenue, pas seulement que la derniere l est.
    expect([...menuDeCible().selectedOptions]).toHaveLength(1);
  });

  it("envoie a createIdea le segment de la cible selectionnee", async () => {
    const user = userEvent.setup();
    const api = mockPreload();
    renderSelector();

    await screen.findByLabelText("Cible visée");
    await user.type(screen.getByLabelText("Titre du sujet"), "Deleguer trop tot");
    await user.type(screen.getByLabelText("Angle"), "Retour chiffre");
    await user.selectOptions(menuDeCible(), CIBLES[1] as string);
    await user.click(screen.getByRole("button", { name: "Ajouter au backlog" }));

    await waitFor(() => expect(api.ideas.createIdea).toHaveBeenCalledTimes(1));
    expect(api.ideas.createIdea).toHaveBeenCalledWith({
      title: "Deleguer trop tot",
      angle: "Retour chiffre",
      pillarLabel: "Cas d'usage concrets metier",
      targetIcpSegment: CIBLES[1]
    });
  });

  it("envoie a createFromNewsSource le segment choisi dans le mode veille", async () => {
    // La doctrine ne distingue pas selon la porte d entree : une veille produit
    // un post, donc elle vise une personne. Sans cette rangee, la promesse ne
    // tiendrait que sur la saisie manuelle.
    const user = userEvent.setup();
    const api = mockPreload();
    renderSelector();

    await screen.findByLabelText("Cible visée");
    await user.click(screen.getByRole("tab", { name: "Transformer une veille" }));

    await user.type(screen.getByLabelText("Titre source"), "Un rapport sur l adoption");
    await user.type(screen.getByLabelText("Résumé source"), "Soixante pour cent freinent");
    await user.selectOptions(menuDeCible(), CIBLES[1] as string);
    await user.click(screen.getByRole("button", { name: /Transformer|Générer|Créer/ }));

    await waitFor(() => expect(api.ideas.createFromNewsSource).toHaveBeenCalledTimes(1));
    expect(api.ideas.createFromNewsSource).toHaveBeenCalledWith({
      sourceTitle: "Un rapport sur l adoption",
      sourceSummary: "Soixante pour cent freinent",
      targetIcpSegment: CIBLES[1]
    });
  });

  it("envoie a generateFromStrategy la cible choisie dans le troisieme onglet", async () => {
    // Troisieme et derniere porte d entree qui cree des idees. C est la seule
    // ou l utilisateur n a aucun moment ulterieur pour designer une cible : une
    // idee generee sans cible le resterait pour toujours.
    const user = userEvent.setup();
    const api = mockPreload();
    renderSelector();

    await screen.findByLabelText("Cible visée");
    await user.click(screen.getByRole("tab", { name: "Depuis la stratégie" }));
    await user.selectOptions(menuDeCible(), CIBLES[1] as string);
    await user.click(screen.getByRole("button", { name: /Générer|Proposer|sujets/i }));

    await waitFor(() => expect(api.ideas.generateFromStrategy).toHaveBeenCalledTimes(1));
    expect(api.ideas.generateFromStrategy).toHaveBeenCalledWith({
      targetIcpSegment: CIBLES[1]
    });
  });

  it("distingue une strategie illisible d une strategie sans cible", async () => {
    // Les deux donnent une liste vide, les deux ne disent pas la meme chose.
    // Envoyer creer une cible quelqu un qui en a six, parce que la base etait
    // verrouillee, le fait chercher un probleme qui n existe pas.
    const api = mockPreload();
    api.strategy.getActiveBundle.mockRejectedValue(new Error("base verrouillee"));
    renderSelector();

    await screen.findByRole("button", { name: "Aide : Cible visée" });

    expect(screen.queryByLabelText("Cible visée")).toBeNull();
    expect(screen.getByText(/La stratégie n'a pas pu être lue/)).toBeTruthy();
    expect(screen.queryByText(/Aucune cible définie/)).toBeNull();
  });

  it("n affiche aucune rangee et oriente vers la strategie quand aucune cible n existe", async () => {
    const user = userEvent.setup();
    const api = mockPreload(IDEAS, BUNDLE_SANS_CIBLE);
    renderSelector();

    await screen.findByRole("button", { name: "Aide : Cible visée" });
    expect(screen.queryByLabelText("Cible visée")).toBeNull();
    expect(
      screen.getByText(
        "Aucune cible définie. Créez-en une dans l'écran Stratégie, onglet Cibles."
      )
    ).toBeTruthy();

    // La cle ne part pas a vide : `ideaInputSchema` est `.strict()` et
    // `targetIcpSegment` y refuse la chaine vide. `toHaveBeenCalledWith`
    // ignorerait une cle posee a `undefined`, d ou la lecture des cles reelles.
    await user.type(screen.getByLabelText("Titre du sujet"), "Deleguer trop tot");
    await user.type(screen.getByLabelText("Angle"), "Retour chiffre");
    await user.click(screen.getByRole("button", { name: "Ajouter au backlog" }));

    await waitFor(() => expect(api.ideas.createIdea).toHaveBeenCalledTimes(1));
    const payload = api.ideas.createIdea.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["angle", "pillarLabel", "title"]);
  });
});
