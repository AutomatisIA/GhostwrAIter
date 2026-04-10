// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdeasScreen } from "../../app/renderer/src/features/ideas/IdeasScreen";

function renderIdeasScreen() {
  return render(
    <MemoryRouter>
      <IdeasScreen />
    </MemoryRouter>
  );
}

describe("IdeasScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("loads existing ideas on mount", async () => {
    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn(),
        saveBundle: vi.fn()
      },
      ideas: {
        listIdeas: vi.fn().mockResolvedValue([
          {
            id: "idea_1",
            title: "Pourquoi les PME echouent sur l'IA",
            angle: "Elles commencent par l'outil",
            pillarLabel: "Adoption IA",
            createdAt: new Date().toISOString()
          }
        ]),
        createIdea: vi.fn()
      },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      }
    };

    renderIdeasScreen();

    expect(await screen.findByText("Pourquoi les PME echouent sur l'IA")).toBeTruthy();
  });

  it("creates an idea and refreshes the backlog", async () => {
    const user = userEvent.setup();
    const listIdeas = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "idea_2",
          title: "Les 3 cas d'usage a prioriser",
          angle: "Commencer petit mais utile",
          pillarLabel: "ROI",
          createdAt: new Date().toISOString()
        }
      ]);
    const createIdea = vi.fn().mockResolvedValue({
      id: "idea_2"
    });

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn(),
        saveBundle: vi.fn()
      },
      ideas: {
        listIdeas,
        createIdea
      },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      }
    };

    renderIdeasScreen();

    await user.type(screen.getByLabelText("Titre du sujet"), "Les 3 cas d'usage a prioriser");
    await user.type(screen.getByLabelText("Angle"), "Commencer petit mais utile");
    await user.type(screen.getByLabelText("Pilier"), "ROI");
    await user.click(screen.getByRole("button", { name: "Ajouter l'idee" }));

    await waitFor(() => {
      expect(createIdea).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("Les 3 cas d'usage a prioriser")).toBeTruthy();
  });
});
