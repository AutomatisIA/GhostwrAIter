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
        saveBundle: vi.fn(),
        generateFoundation: vi.fn()
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
        createIdea: vi.fn(),
        createFromNewsSource: vi.fn(),
        generateFromStrategy: vi.fn()
      },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      }
    };

    renderIdeasScreen();

    expect(await screen.findByText("Pourquoi les PME echouent sur l'IA")).toBeTruthy();
    expect(screen.getByText("1 idee visible")).toBeTruthy();
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
        saveBundle: vi.fn(),
        generateFoundation: vi.fn()
      },
      ideas: {
        listIdeas,
        createIdea,
        createFromNewsSource: vi.fn(),
        generateFromStrategy: vi.fn()
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
    await user.type(screen.getByLabelText("Pilier editorial"), "ROI");
    await user.click(screen.getByRole("button", { name: "Ajouter l'idee" }));

    await waitFor(() => {
      expect(createIdea).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("Les 3 cas d'usage a prioriser")).toBeTruthy();
  });

  it("creates a draft from a pasted news source", async () => {
    const user = userEvent.setup();
    const listIdeas = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "idea_news",
          title: "Une PME industrialise ses copilotes IA",
          angle: "Le sujet central est l'adoption terrain",
          pillarLabel: "Veille",
          createdAt: new Date().toISOString()
        }
      ]);
    const createFromNewsSource = vi.fn().mockResolvedValue({
      idea: {
        id: "idea_news",
        title: "Une PME industrialise ses copilotes IA",
        angle: "Le sujet central est l'adoption terrain",
        pillarLabel: "Veille",
        createdAt: new Date().toISOString()
      },
      draft: {
        id: "draft_news",
        headline: "Une PME industrialise ses copilotes IA",
        bodyMarkdown: "Brouillon veille",
        qualityScore: 0.85
      },
      hooks: [],
      run: {
        id: "run_news",
        skillName: "linkedin-news-to-post",
        status: "succeeded",
        summary: "News transformed into editorial draft"
      },
      versions: [],
      contextUsed: {
        pillarLabel: "Veille",
        voiceGuardrail: "Pas de hype, du terrain.",
        activeSkills: ["linkedin-news-to-post"]
      }
    });

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn(),
        saveBundle: vi.fn(),
        generateFoundation: vi.fn()
      },
      ideas: {
        listIdeas,
        createIdea: vi.fn(),
        createFromNewsSource,
        generateFromStrategy: vi.fn()
      },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      }
    };

    renderIdeasScreen();

    await user.type(screen.getByLabelText("Titre source"), "Une PME industrialise ses copilotes IA");
    await user.type(
      screen.getByLabelText("Resume source"),
      "Le sujet central est l'adoption terrain"
    );
    await user.click(screen.getByRole("button", { name: "Transformer la veille en draft" }));

    await waitFor(() => {
      expect(createFromNewsSource).toHaveBeenCalledWith({
        sourceTitle: "Une PME industrialise ses copilotes IA",
        sourceSummary: "Le sujet central est l'adoption terrain"
      });
    });

    expect(await screen.findByText("Une PME industrialise ses copilotes IA")).toBeTruthy();
    expect(await screen.findByText("Draft veille cree depuis la source collee.")).toBeTruthy();
  });

  it("surfaces a visible error when transforming a news source fails", async () => {
    const user = userEvent.setup();

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn(),
        saveBundle: vi.fn(),
        generateFoundation: vi.fn()
      },
      ideas: {
        listIdeas: vi.fn().mockResolvedValue([]),
        createIdea: vi.fn(),
        createFromNewsSource: vi
          .fn()
          .mockRejectedValue(new Error("Codex unavailable or usage limit reached")),
        generateFromStrategy: vi.fn()
      },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      }
    };

    renderIdeasScreen();

    await user.type(screen.getByLabelText("Titre source"), "Titre");
    await user.type(screen.getByLabelText("Resume source"), "Resume");
    await user.click(screen.getByRole("button", { name: "Transformer la veille en draft" }));

    expect(
      await screen.findByText(
        "Erreur lors de la transformation de la veille : Codex unavailable or usage limit reached"
      )
    ).toBeTruthy();
  });

  it("generates scored ideas from the active strategy", async () => {
    const user = userEvent.setup();
    const listIdeas = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "idea_strategy_1",
          title: "Pourquoi l'adoption IA bloque en PME",
          angle: "Le frein principal est le cadrage",
          pillarLabel: "Adoption IA",
          createdAt: new Date().toISOString()
        }
      ]);
    const generateFromStrategy = vi.fn().mockResolvedValue([
      {
        id: "idea_strategy_1",
        title: "Pourquoi l'adoption IA bloque en PME",
        angle: "Le frein principal est le cadrage",
        pillarLabel: "Adoption IA",
        createdAt: new Date().toISOString()
      }
    ]);

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn(),
        saveBundle: vi.fn(),
        generateFoundation: vi.fn()
      },
      ideas: {
        listIdeas,
        createIdea: vi.fn(),
        createFromNewsSource: vi.fn(),
        generateFromStrategy
      },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      }
    };

    renderIdeasScreen();

    await user.click(screen.getByRole("button", { name: "Generer des sujets depuis la strategie" }));

    await waitFor(() => {
      expect(generateFromStrategy).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("Pourquoi l'adoption IA bloque en PME")).toBeTruthy();
  });

  it("shows a clear in-progress state while generating ideas from the strategy", async () => {
    let resolveGeneration: ((value: unknown) => void) | undefined;
    const generateFromStrategy = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      })
    );

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn(),
        saveBundle: vi.fn(),
        generateFoundation: vi.fn()
      },
      ideas: {
        listIdeas: vi.fn().mockResolvedValue([]),
        createIdea: vi.fn(),
        createFromNewsSource: vi.fn(),
        generateFromStrategy
      },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      }
    };

    renderIdeasScreen();

    const button = await screen.findByRole("button", {
      name: "Generer des sujets depuis la strategie"
    });
    button.click();

    expect(await screen.findByText("Generation des sujets en cours...")).toBeTruthy();

    resolveGeneration?.([]);
  });

  it("filters ideas by keyword and pillar locally", async () => {
    const user = userEvent.setup();
    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn(),
        saveBundle: vi.fn(),
        generateFoundation: vi.fn()
      },
      ideas: {
        listIdeas: vi.fn().mockResolvedValue([
          {
            id: "idea_1",
            title: "Pourquoi les PME echouent sur l'IA",
            angle: "Commencer par l'outil",
            pillarLabel: "Adoption IA",
            createdAt: new Date().toISOString()
          },
          {
            id: "idea_2",
            title: "Comment mesurer le ROI d'un copilote",
            angle: "Piloter avant d'etendre",
            pillarLabel: "ROI",
            createdAt: new Date().toISOString()
          }
        ]),
        createIdea: vi.fn(),
        createFromNewsSource: vi.fn(),
        generateFromStrategy: vi.fn()
      },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      }
    };

    renderIdeasScreen();

    expect(await screen.findByText("Pourquoi les PME echouent sur l'IA")).toBeTruthy();
    expect(screen.getByText("Comment mesurer le ROI d'un copilote")).toBeTruthy();

    await user.type(screen.getByLabelText("Filtrer les idees"), "ROI");
    await user.selectOptions(screen.getByLabelText("Filtrer par pilier"), "ROI");

    expect(await screen.findByText("Comment mesurer le ROI d'un copilote")).toBeTruthy();
    expect(screen.queryByText("Pourquoi les PME echouent sur l'IA")).toBeNull();
  });
});
