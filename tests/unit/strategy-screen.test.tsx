// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrategyScreen } from "../../app/renderer/src/features/strategy/StrategyScreen";
import { ToastProvider } from "../../app/renderer/src/feedback/ToastProvider";

function renderStrategyScreen() {
  return render(
    <ToastProvider>
      <StrategyScreen />
    </ToastProvider>
  );
}

const baseBundle = {
  profile: {
    id: "profile_active",
    name: "Philippe",
    positioning: "Consultant IA PME",
    bio: "Approche terrain",
    expertiseSummary: "ROI"
  },
  offers: [
    {
      id: "offer_1",
      name: "Audit IA PME",
      promise: "Cadrer les cas d'usage prioritaires",
      problems: "Manque de priorisation",
      proofPoints: "3 missions",
      ctaModes: "Appel diagnostic"
    }
  ],
  icps: [
    {
      id: "icp_1",
      segment: "Dirigeants PME",
      pains: "Trop de bruit et peu de resultats",
      objections: "Peur du gadget",
      desiredOutcomes: "ROI rapide",
      languageCues: "Concret, rentable",
      linkedinBehavior: "Lit des retours terrain"
    }
  ],
  pillars: [
    {
      id: "pillar_1",
      label: "Adoption IA",
      description: "Conduite du changement",
      position: 0,
      isDefault: true
    }
  ],
  voiceRules: [
    {
      id: "voice_1",
      category: "Anti-style",
      ruleText: "Pas de hype",
      ruleType: "anti_style"
    }
  ]
};

function mockStrategy(overrides: Record<string, unknown> = {}) {
  window.linkedinPoster = {
    platform: "darwin",
    appName: "GhostwrAIter",
    strategy: {
      getActiveBundle: vi.fn().mockResolvedValue(baseBundle),
      saveBundle: vi.fn().mockImplementation(async (p: unknown) => p),
      generateFoundation: vi.fn(),
      ...overrides
    },
    settings: {
      getPreference: vi.fn().mockResolvedValue({ key: "foundation_summary", value: null }),
      setPreference: vi.fn().mockResolvedValue({ key: "foundation_summary", value: "", updated_at: "" }),
      getAllPreferences: vi.fn().mockResolvedValue({}),
      exportWorkspace: vi.fn(),
      countExecutionLogs: vi.fn(),
      purgeExecutionLogs: vi.fn(),
      detectEngines: vi.fn().mockResolvedValue({ engines: [] }),
      getActiveEngine: vi.fn().mockResolvedValue({ engine: "codex", status: {} }),
      setActiveEngine: vi.fn()
    }
  };
}

describe("StrategyScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("loads profile fields on mount in the default Profil tab", async () => {
    mockStrategy();
    renderStrategyScreen();

    expect(await screen.findByDisplayValue("Philippe")).toBeTruthy();
    expect(screen.getByDisplayValue("Consultant IA PME")).toBeTruthy();
  });

  it("shows offers when switching to the Offres tab", async () => {
    const user = userEvent.setup();
    mockStrategy();
    renderStrategyScreen();
    await screen.findByDisplayValue("Philippe");

    await user.click(screen.getByRole("tab", { name: "Offres" }));
    expect(await screen.findByDisplayValue("Audit IA PME")).toBeTruthy();
  });

  it("saves the edited profile through the preload API", async () => {
    const user = userEvent.setup();
    const saveBundle = vi.fn().mockImplementation(async (p: unknown) => p);
    mockStrategy({ saveBundle });
    renderStrategyScreen();

    const positioningInput = await screen.findByLabelText("Positionnement");
    await user.clear(positioningInput);
    await user.type(positioningInput, "Consultant IA generative pour PME");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(saveBundle).toHaveBeenCalledTimes(1);
    });

    expect(saveBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({
          positioning: "Consultant IA generative pour PME"
        })
      })
    );
  });

  it("navigates to the Socle tab and generates the foundation", async () => {
    const user = userEvent.setup();
    const generateFoundation = vi.fn().mockResolvedValue({
      summaryMarkdown: "Positionnement: Consultant IA PME\nPilier: Adoption IA"
    });
    mockStrategy({ generateFoundation });
    renderStrategyScreen();

    await user.click(await screen.findByRole("tab", { name: /Socle éditorial/ }));
    await user.click(screen.getByRole("button", { name: "Générer le socle éditorial" }));

    await waitFor(() => {
      expect(generateFoundation).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText(/Consultant IA PME/)).toBeTruthy();
  });

  it("shows an error when foundation generation fails", async () => {
    const user = userEvent.setup();
    mockStrategy({
      generateFoundation: vi.fn().mockRejectedValue(new Error("Invalid contract"))
    });
    renderStrategyScreen();

    await user.click(await screen.findByRole("tab", { name: /Socle éditorial/ }));
    await user.click(screen.getByRole("button", { name: "Générer le socle éditorial" }));

    expect(await screen.findByText(/Invalid contract/)).toBeTruthy();
  });

  // Le vert est reserve au terminal, c est a dire au post publie. Six onglets
  // portaient une coche verte des qu ils contenaient quelque chose : la couleur
  // ne signalait plus rien et les six marques ne hierarchisaient rien.
  it("marks tabs with a plain count, never a green check", async () => {
    mockStrategy();
    const { container } = renderStrategyScreen();
    await screen.findByDisplayValue("Philippe");

    expect(container.querySelectorAll('[data-state="ok"]')).toHaveLength(0);

    const marks = Array.from(container.querySelectorAll(".strategy-tab-mark")).map(
      (node) => node.textContent
    );
    // Quatre champs de profil, une offre, un ICP, un pilier, une regle de voix.
    // Le socle n a jamais ete genere : cet onglet ne porte donc aucune marque.
    expect(marks).toEqual(["4", "1", "1", "1", "1"]);
  });

  // Le compte porte sur ce qui est SAISI, pas sur les lignes presentes. Une
  // offre ajoutee mais laissee vide ferait sinon afficher « 1 » a l onglet
  // au-dessus d un indicateur disant « 0 offre sur 2 » : deux compteurs voisins
  // qui se contredisent, le defaut meme que ce lot corrige.
  it("counts filled items in the tab mark, not empty rows", async () => {
    mockStrategy({
      getActiveBundle: vi.fn().mockResolvedValue({
        ...baseBundle,
        offers: [
          ...baseBundle.offers,
          { id: "offer_2", name: "", promise: "", problems: "", proofPoints: "", ctaModes: "" }
        ]
      })
    });
    const { container } = renderStrategyScreen();
    await screen.findByDisplayValue("Philippe");

    const offersMark = container.querySelectorAll(".strategy-tab-mark")[1];
    expect(offersMark?.textContent).toBe("1");
  });

  // Le nom accessible de l onglet doit rester son seul libelle : « Offres 1 »
  // enonce a la lecture n apprend rien, et casserait toute selection par nom.
  it("keeps the tab accessible name free of the count", async () => {
    mockStrategy();
    renderStrategyScreen();
    await screen.findByDisplayValue("Philippe");

    expect(screen.getByRole("tab", { name: "Offres" })).toBeTruthy();
  });

  // L indicateur affichait cinq segments sous « 4 sur 4 », dont un restait
  // gris : il se contredisait lui-meme. Un segment par champ obligatoire.
  it("draws one completeness segment per profile field", async () => {
    mockStrategy();
    const { container } = renderStrategyScreen();
    await screen.findByDisplayValue("Philippe");

    expect(container.querySelectorAll(".strategy-completeness__segment")).toHaveLength(4);
    expect(screen.getByText("4 champs sur 4")).toBeTruthy();
  });

  // Un seul bouton plein par ecran, et c est l enregistrement. « Régénérer le
  // socle » siegeait a cote de lui, en plein lui aussi, et c est la
  // regeneration qui portait le remplissage bleu.
  it("keeps a single filled button on the default state, and it saves", async () => {
    mockStrategy();
    const { container } = renderStrategyScreen();
    await screen.findByDisplayValue("Philippe");

    const filled = Array.from(container.querySelectorAll('[data-variant="primary"]'));
    expect(filled).toHaveLength(1);
    expect(filled[0]?.textContent).toBe("Enregistrer");
  });

  // La generation descend dans le panneau de droite, en bouton borde, et reste
  // atteignable depuis les six onglets : c est le seul endroit d ou la lancer.
  it("offers the foundation generation from the Profil tab, unfilled", async () => {
    const user = userEvent.setup();
    const generateFoundation = vi.fn().mockResolvedValue({ summaryMarkdown: "Socle" });
    mockStrategy({ generateFoundation });
    renderStrategyScreen();
    await screen.findByDisplayValue("Philippe");

    const generate = screen.getByRole("button", { name: "Générer le socle éditorial" });
    expect(generate.getAttribute("data-variant")).toBe("secondary");

    await user.click(generate);
    await waitFor(() => {
      expect(generateFoundation).toHaveBeenCalledTimes(1);
    });
  });

  // Un positionnement utile depasse 90 caracteres : sur une seule ligne, sa fin
  // sortait du champ et l utilisateur ne pouvait plus se relire.
  it("renders Positionnement as a two-line text area", async () => {
    mockStrategy();
    renderStrategyScreen();

    const positioning = await screen.findByLabelText("Positionnement");
    expect(positioning.tagName).toBe("TEXTAREA");
    expect(positioning.getAttribute("rows")).toBe("2");
  });
});
