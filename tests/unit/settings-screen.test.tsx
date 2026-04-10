// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "../../app/renderer/src/features/settings/SettingsScreen";

describe("SettingsScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("exports the workspace and purges logs from settings", async () => {
    const user = userEvent.setup();
    const exportWorkspace = vi.fn().mockResolvedValue({
      exportPath: "/tmp/workspace-export-1.json"
    });
    const purgeExecutionLogs = vi.fn().mockResolvedValue({
      deletedCount: 2
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
      library: { listEntries: vi.fn() },
      calendar: { listItems: vi.fn(), scheduleDraft: vi.fn() },
      execution: {
        listRuns: vi.fn(),
        getDiagnostics: vi.fn()
      },
      settings: {
        exportWorkspace,
        purgeExecutionLogs
      }
    };

    render(<SettingsScreen />);

    await user.click(screen.getByRole("button", { name: "Exporter le workspace" }));

    await waitFor(() => {
      expect(exportWorkspace).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("/tmp/workspace-export-1.json")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Purger les logs" }));

    await waitFor(() => {
      expect(purgeExecutionLogs).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("2 logs supprimes localement.")).toBeTruthy();
  });
});
