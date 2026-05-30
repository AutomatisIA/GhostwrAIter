// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SettingsScreen } from "../../app/renderer/src/features/settings/SettingsScreen";
import { ToastProvider } from "../../app/renderer/src/feedback/ToastProvider";
import { TourContext } from "../../app/renderer/src/help";

function renderScreen() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TourContext.Provider value={{ open: vi.fn() }}>
          <SettingsScreen />
        </TourContext.Provider>
      </ToastProvider>
    </MemoryRouter>
  );
}

function mockLinkedinPoster(overrides: {
  exportWorkspace: ReturnType<typeof vi.fn>;
  countExecutionLogs: ReturnType<typeof vi.fn>;
  purgeExecutionLogs: ReturnType<typeof vi.fn>;
}) {
  window.linkedinPoster = {
    platform: "darwin",
    appName: "GhostwrAIter",
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
      listRuns: vi.fn().mockResolvedValue([]),
      getDiagnostics: vi.fn().mockResolvedValue({ activeEngine: "codex", engines: [], availableSkills: [], message: "" }),
      openRunLog: vi.fn()
    },
    settings: {
      ...overrides,
      getPreference: vi.fn().mockResolvedValue({ key: "theme", value: null }),
      setPreference: vi.fn().mockResolvedValue({ key: "theme", value: "system", updated_at: "" }),
      getAllPreferences: vi.fn().mockResolvedValue({}),
      detectEngines: vi.fn().mockResolvedValue({ engines: [] }),
      getActiveEngine: vi.fn().mockResolvedValue({ engine: "codex", status: {} }),
      setActiveEngine: vi.fn().mockResolvedValue({ engine: "codex", status: {} })
    }
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

    renderScreen();

    await user.click(screen.getByRole("button", { name: "Exporter l'espace de travail" }));

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

    renderScreen();

    await user.click(screen.getByRole("button", { name: "Purger les journaux" }));

    await waitFor(() => {
      expect(countExecutionLogs).toHaveBeenCalledTimes(1);
    });

    // La purge ne doit jamais partir sans confirmation explicite.
    expect(purgeExecutionLogs).not.toHaveBeenCalled();

    // Un dialogue de confirmation s'ouvre et indique le nombre de logs concernes.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(await screen.findByText(/7 journaux techniques/)).toBeTruthy();

    expect(screen.getByRole("button", { name: "Annuler" })).toBeTruthy();

    const confirmButton = screen.getByRole("button", { name: "Purger définitivement" });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(purgeExecutionLogs).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("7 journaux techniques supprimés de votre ordinateur.")).toBeTruthy();
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

    renderScreen();

    await user.click(screen.getByRole("button", { name: "Purger les journaux" }));

    await waitFor(() => {
      expect(countExecutionLogs).toHaveBeenCalledTimes(1);
    });

    await user.click(await screen.findByRole("button", { name: "Annuler" }));

    expect(purgeExecutionLogs).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Purger les journaux" })).toBeTruthy();
  });
});
