// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutionScreen } from "../../app/renderer/src/features/execution/ExecutionScreen";

describe("ExecutionScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders runner diagnostics and recent runs", async () => {
    window.linkedinPoster = {
      platform: "darwin",
      appName: "GhostwrAIter",
      strategy: { getActiveBundle: vi.fn(), saveBundle: vi.fn() },
      ideas: {
        listIdeas: vi.fn(),
        createIdea: vi.fn(),
        createFromNewsSource: vi.fn(),
        generateFromStrategy: vi.fn()
      },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      },
      library: { listEntries: vi.fn() },
      calendar: { listItems: vi.fn(), scheduleDraft: vi.fn() },
      execution: {
        getDiagnostics: vi.fn().mockResolvedValue({
          runnerMode: "unavailable",
          codexAvailable: false,
          message: "Codex indisponible. Aucune generation n'est autorisee tant que le runner n'est pas disponible.",
          availableSkills: ["linkedin-post-writer", "linkedin-post-editor"]
        }),
        listRuns: vi.fn().mockResolvedValue([
          {
            id: "run_1",
            skillName: "linkedin-post-writer",
            status: "succeeded",
            summary: "Draft generated",
            createdAt: new Date().toISOString()
          }
        ])
      }
    };

    render(<ExecutionScreen />);

    expect(await screen.findByText("Comprendre ce que fait le runner")).toBeTruthy();
    expect(screen.getByText("Mode actuel")).toBeTruthy();
    expect(screen.getByText("unavailable")).toBeTruthy();
    expect(screen.getByText("Codex indisponible.")).toBeTruthy();
    expect(screen.getByText("Capacites detectees")).toBeTruthy();
    expect(screen.getAllByText("Rediger un post").length).toBeGreaterThan(0);
    expect(screen.getByText("Draft generated")).toBeTruthy();
    expect(screen.getByText("Ce que cela veut dire")).toBeTruthy();
  });
});
