// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "../../app/renderer/src/features/settings/SettingsScreen";

function mockLinkedinPoster(overrides: {
  exportWorkspace: ReturnType<typeof vi.fn>;
  countExecutionLogs: ReturnType<typeof vi.fn>;
  purgeExecutionLogs: ReturnType<typeof vi.fn>;
}) {
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
      getDiagnostics: vi.fn(),
      openRunLog: vi.fn()
    },
    settings: overrides
  };
}

describe("SettingsScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("exports the workspace from settings", async () => {
    const user = userEvent.setup();
    const exportWorkspace = vi.fn().mockResolvedValue({
      exportPath: "/tmp/workspace-export-1.json"
    });

    mockLinkedinPoster({
      exportWorkspace,
      countExecutionLogs: vi.fn().mockResolvedValue({ count: 0 }),
      purgeExecutionLogs: vi.fn()
    });

    render(<SettingsScreen />);

    await user.click(screen.getByRole("button", { name: "Exporter le workspace" }));

    await waitFor(() => {
      expect(exportWorkspace).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("/tmp/workspace-export-1.json")).toBeTruthy();
  });

  it("requires inline confirmation before purging logs", async () => {
    const user = userEvent.setup();
    const countExecutionLogs = vi.fn().mockResolvedValue({ count: 7 });
    const purgeExecutionLogs = vi.fn().mockResolvedValue({ deletedCount: 7 });

    mockLinkedinPoster({
      exportWorkspace: vi.fn().mockResolvedValue({ exportPath: "" }),
      countExecutionLogs,
      purgeExecutionLogs
    });

    render(<SettingsScreen />);

    await user.click(screen.getByRole("button", { name: "Purger les logs" }));

    await waitFor(() => {
      expect(countExecutionLogs).toHaveBeenCalledTimes(1);
    });

    expect(purgeExecutionLogs).not.toHaveBeenCalled();

    const confirmButton = await screen.findByRole("button", {
      name: /Confirmer la suppression des 7 logs/
    });
    expect(confirmButton).toBeTruthy();

    expect(screen.getByRole("button", { name: "Annuler" })).toBeTruthy();

    await user.click(confirmButton);

    await waitFor(() => {
      expect(purgeExecutionLogs).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("7 logs supprimes localement.")).toBeTruthy();
  });

  it("cancels the purge when clicking Annuler", async () => {
    const user = userEvent.setup();
    const countExecutionLogs = vi.fn().mockResolvedValue({ count: 3 });
    const purgeExecutionLogs = vi.fn();

    mockLinkedinPoster({
      exportWorkspace: vi.fn().mockResolvedValue({ exportPath: "" }),
      countExecutionLogs,
      purgeExecutionLogs
    });

    render(<SettingsScreen />);

    await user.click(screen.getByRole("button", { name: "Purger les logs" }));

    await waitFor(() => {
      expect(countExecutionLogs).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(purgeExecutionLogs).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Purger les logs" })).toBeTruthy();
  });
});
