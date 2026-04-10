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
  offers: [],
  icps: [],
  pillars: [],
  voiceRules: []
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
    expect(getActiveBundle).toHaveBeenCalledTimes(1);
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
});
