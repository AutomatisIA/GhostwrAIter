// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryScreen } from "../../app/renderer/src/features/library/LibraryScreen";

describe("LibraryScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders persisted drafts from the local library, filters them and creates a variant", async () => {
    const user = userEvent.setup();
    const listEntries = vi
      .fn()
      .mockResolvedValueOnce([
        {
          draftId: "draft_1",
          headline: "Pourquoi cadrer avant de prompter",
          bodyPreview: "Le process prime sur l'outil.",
          qualityScore: 0.89,
          createdAt: new Date().toISOString(),
          status: "draft",
          pillarLabel: "Methodes",
          tags: ["cadrage", "prompter"],
          sourceDraftId: null
        }
      ])
      .mockResolvedValueOnce([
        {
          draftId: "draft_1",
          headline: "Pourquoi cadrer avant de prompter",
          bodyPreview: "Le process prime sur l'outil.",
          qualityScore: 0.89,
          createdAt: new Date().toISOString(),
          status: "draft",
          pillarLabel: "Methodes",
          tags: ["cadrage", "prompter"],
          sourceDraftId: null
        }
      ]);
    const searchEntries = vi.fn().mockResolvedValue([
      {
        draftId: "draft_1",
        headline: "Pourquoi cadrer avant de prompter",
        bodyPreview: "Le process prime sur l'outil.",
        qualityScore: 0.89,
        createdAt: new Date().toISOString(),
        status: "draft",
        pillarLabel: "Methodes",
        tags: ["cadrage", "prompter"],
        sourceDraftId: null
      }
    ]);
    const createVariantFromDraft = vi.fn().mockResolvedValue({
      draftId: "draft_2",
      headline: "Variante - Pourquoi cadrer avant de prompter",
      bodyPreview: "Variante du draft source.",
      qualityScore: 0.84,
      createdAt: new Date().toISOString(),
      status: "variant",
      pillarLabel: "Methodes",
      tags: ["cadrage", "prompter", "variante"],
      sourceDraftId: "draft_1"
    });

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: { getActiveBundle: vi.fn(), saveBundle: vi.fn() },
      ideas: { listIdeas: vi.fn(), createIdea: vi.fn() },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      },
      library: {
        listEntries,
        searchEntries,
        createVariantFromDraft
      },
      calendar: {
        listItems: vi.fn(),
        scheduleDraft: vi.fn()
      }
    };

    render(<LibraryScreen />);

    expect(await screen.findByText("Pourquoi cadrer avant de prompter")).toBeTruthy();
    await user.type(screen.getByLabelText("Recherche"), "prompter");

    await waitFor(() => {
      expect(searchEntries).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "Creer une variante" }));

    await waitFor(() => {
      expect(createVariantFromDraft).toHaveBeenCalledWith("draft_1");
    });
  });
});
