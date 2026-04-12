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
    render(<StrategyScreen />);

    expect(await screen.findByDisplayValue("Philippe")).toBeTruthy();
    expect(screen.getByDisplayValue("Consultant IA PME")).toBeTruthy();
  });

  it("shows offers when switching to the Offres tab", async () => {
    const user = userEvent.setup();
    mockStrategy();
    render(<StrategyScreen />);
    await screen.findByDisplayValue("Philippe");

    await user.click(screen.getByRole("button", { name: "Offres" }));
    expect(await screen.findByDisplayValue("Audit IA PME")).toBeTruthy();
  });

  it("saves the edited profile through the preload API", async () => {
    const user = userEvent.setup();
    const saveBundle = vi.fn().mockImplementation(async (p: unknown) => p);
    mockStrategy({ saveBundle });
    render(<StrategyScreen />);

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
    render(<StrategyScreen />);

    await user.click(await screen.findByRole("button", { name: "Socle éditorial" }));
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
    render(<StrategyScreen />);

    await user.click(await screen.findByRole("button", { name: "Socle éditorial" }));
    await user.click(screen.getByRole("button", { name: "Générer le socle éditorial" }));

    expect(await screen.findByText(/Invalid contract/)).toBeTruthy();
  });
});
