// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrategyScreen } from "../../app/renderer/src/features/strategy/StrategyScreen";

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

describe("StrategyScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("loads the active strategy bundle on mount", async () => {
    const getActiveBundle = vi.fn().mockResolvedValue(baseBundle);
    const saveBundle = vi.fn();

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle,
        saveBundle,
        generateFoundation: vi.fn()
      }
    };

    render(<StrategyScreen />);

    expect(await screen.findByDisplayValue("Philippe")).toBeTruthy();
    expect(screen.getByDisplayValue("Consultant IA PME")).toBeTruthy();
    expect(screen.getByDisplayValue("Audit IA PME")).toBeTruthy();
    expect(screen.getByDisplayValue("Dirigeants PME")).toBeTruthy();
    expect(screen.getByDisplayValue("Adoption IA")).toBeTruthy();
    expect(screen.getByDisplayValue("Pas de hype")).toBeTruthy();
    expect(getActiveBundle).toHaveBeenCalledTimes(1);
  });

  it("shows guided examples and actionable placeholders for a first-time user", async () => {
    const getActiveBundle = vi.fn().mockResolvedValue({
      profile: {
        id: "profile_active",
        name: "",
        positioning: "",
        bio: "",
        expertiseSummary: ""
      },
      offers: [],
      icps: [],
      pillars: [],
      voiceRules: []
    });

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle,
        saveBundle: vi.fn(),
        generateFoundation: vi.fn()
      }
    };

    render(<StrategyScreen />);

    expect(await screen.findByText("Comment bien remplir cette page")).toBeTruthy();
    expect(screen.getByText("Exemple de bon positionnement")).toBeTruthy();
    expect(screen.getByPlaceholderText("Ex. Consultant IA generative pour PME industrielles")).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        "Ex. Audit IA, cadrage des cas d'usage, copilotes metier, adoption terrain."
      )
    ).toBeTruthy();
    expect(screen.getByText("Ce que l'utilisateur doit comprendre en sortant de cette page")).toBeTruthy();
  });

  it("saves the edited strategy bundle through the preload API", async () => {
    const user = userEvent.setup();
    const getActiveBundle = vi.fn().mockResolvedValue(baseBundle);
    const saveBundle = vi.fn().mockImplementation(async (payload) => payload);

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle,
        saveBundle,
        generateFoundation: vi.fn()
      }
    };

    render(<StrategyScreen />);

    const positioningInput = await screen.findByLabelText("Positionnement");
    await user.clear(positioningInput);
    await user.type(positioningInput, "Consultant IA generative pour PME");
    await user.click(screen.getByRole("button", { name: "Enregistrer la strategie" }));

    await waitFor(() => {
      expect(saveBundle).toHaveBeenCalledTimes(1);
    });

    expect(saveBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({
          name: "Philippe",
          positioning: "Consultant IA generative pour PME"
        })
      })
    );

    expect(await screen.findByText("Strategie enregistree localement.")).toBeTruthy();
  });

  it("lets the user add strategic blocks beyond the profile before saving", async () => {
    const user = userEvent.setup();
    const getActiveBundle = vi.fn().mockResolvedValue(baseBundle);
    const saveBundle = vi.fn().mockImplementation(async (payload) => payload);

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle,
        saveBundle,
        generateFoundation: vi.fn()
      }
    };

    render(<StrategyScreen />);

    await user.click(screen.getByRole("button", { name: "Ajouter une offre" }));
    await user.type(screen.getByLabelText("Nom de l'offre 2"), "Sprint IA");
    await user.type(
      screen.getByLabelText("Promesse de l'offre 2"),
      "Passer de l idee au pilote"
    );
    await user.type(
      screen.getByLabelText("Problemes traites par l'offre 2"),
      "Aucun cadre de pilotage"
    );

    await user.click(screen.getByRole("button", { name: "Ajouter un pilier" }));
    await user.type(screen.getByLabelText("Label du pilier 2"), "ROI IA");

    await user.click(screen.getByRole("button", { name: "Ajouter une regle de voix" }));
    await user.type(screen.getByLabelText("Texte de la regle 2"), "Une idee forte par post");

    await user.click(screen.getByRole("button", { name: "Enregistrer la strategie" }));

    await waitFor(() => {
      expect(saveBundle).toHaveBeenCalledTimes(1);
    });

    expect(saveBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        offers: expect.arrayContaining([
          expect.objectContaining({ name: "Sprint IA" })
        ]),
        pillars: expect.arrayContaining([
          expect.objectContaining({ label: "ROI IA" })
        ]),
        voiceRules: expect.arrayContaining([
          expect.objectContaining({ ruleText: "Une idee forte par post" })
        ])
      })
    );
  });

  it("provides prefilled examples when adding an offer, an ICP, a pillar and a voice rule", async () => {
    const user = userEvent.setup();
    const getActiveBundle = vi.fn().mockResolvedValue({
      profile: {
        id: "profile_active",
        name: "",
        positioning: "",
        bio: "",
        expertiseSummary: ""
      },
      offers: [],
      icps: [],
      pillars: [],
      voiceRules: []
    });

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle,
        saveBundle: vi.fn(),
        generateFoundation: vi.fn()
      }
    };

    render(<StrategyScreen />);

    await user.click(await screen.findByRole("button", { name: "Ajouter une offre" }));
    await user.click(screen.getByRole("button", { name: "Ajouter un ICP" }));
    await user.click(screen.getByRole("button", { name: "Ajouter un pilier" }));
    await user.click(screen.getByRole("button", { name: "Ajouter une regle de voix" }));

    expect(screen.getByPlaceholderText("Ex. Audit IA PME")).toBeTruthy();
    expect(screen.getByPlaceholderText("Ex. Dirigeant de PME de 20 a 200 personnes")).toBeTruthy();
    expect(screen.getByPlaceholderText("Ex. Adoption IA")).toBeTruthy();
    expect(screen.getByPlaceholderText("Ex. Pas de jargon, pas de promesse miracle")).toBeTruthy();
  });

  it("generates an editorial foundation summary from the active strategy", async () => {
    const user = userEvent.setup();
    const getActiveBundle = vi.fn().mockResolvedValue(baseBundle);
    const saveBundle = vi.fn();
    const generateFoundation = vi.fn().mockResolvedValue({
      summaryMarkdown:
        "Positionnement: Consultant IA PME\nPilier central: Adoption IA\nVoix: pas de hype."
    });

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle,
        saveBundle,
        generateFoundation
      }
    };

    render(<StrategyScreen />);

    await user.click(screen.getByRole("button", { name: "Generer le socle editorial" }));

    await waitFor(() => {
      expect(generateFoundation).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText(/Consultant IA PME/)).toBeTruthy();
  });

  it("surfaces a visible error when foundation generation fails", async () => {
    const user = userEvent.setup();

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn().mockResolvedValue(baseBundle),
        saveBundle: vi.fn(),
        generateFoundation: vi.fn().mockRejectedValue(new Error("Codex returned an invalid contract"))
      }
    };

    render(<StrategyScreen />);

    await user.click(await screen.findByRole("button", { name: "Generer le socle editorial" }));

    expect(
      await screen.findByText(
        "Erreur lors de la generation du socle editorial : Codex returned an invalid contract"
      )
    ).toBeTruthy();
  });
});
