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
      appName: "LinkedIn Poster",
      strategy: { getActiveBundle: vi.fn(), saveBundle: vi.fn() },
      ideas: { listIdeas: vi.fn(), createIdea: vi.fn() },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      },
      library: { listEntries: vi.fn() },
      calendar: { listItems: vi.fn(), scheduleDraft: vi.fn() },
      execution: {
        getDiagnostics: vi.fn().mockResolvedValue({
          runnerMode: "local-simulated",
          codexAvailable: true,
          message: "Runner operationnel en mode local-simulated.",
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

    expect(await screen.findByText("Runner operationnel en mode local-simulated.")).toBeTruthy();
    expect((await screen.findAllByText("linkedin-post-writer")).length).toBeGreaterThan(0);
    expect(screen.getByText("Draft generated")).toBeTruthy();
    expect(screen.getByText("linkedin-post-editor")).toBeTruthy();
  });
});
